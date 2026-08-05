import { WebSocketServer, WebSocket } from 'ws';
import { Downloader, ensureBinaries } from '@aio-downloader/core';
import * as path from 'path';
import * as fs from 'fs';

const OUTPUT_DIR = 'E:\\\\FrameVault Downloader Test\\\\Stress Test Insta';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  console.log('--- FRAMEVAULT ANTI-BOT RESILIENCE TEST (20 UNIQUE REELS) ---');
  console.log('Ensuring binaries are ready...');
  await ensureBinaries();

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const wss = new WebSocketServer({ port: 9555 });
  console.log('Listening on ws://localhost:9555...');
  console.log('WAITING FOR CHROME EXTENSION TO CONNECT...');

  let activeWs: WebSocket | null = null;

  wss.on('connection', (ws) => {
    console.log('✅ Chrome Extension connected!');
    activeWs = ws;
  });

  while (!activeWs) {
    await sleep(500);
  }

  const downloader = new Downloader();
  
  console.log('Fetching JIT Cookies for scraping...');
  const scrapeUrl = 'https://www.instagram.com/instagram/';
  const cookiePromise = new Promise<any[]>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Cookie request timed out')), 5000);
    const listener = (data: any) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.type === 'cookies_response' && parsed.url === scrapeUrl) {
          clearTimeout(timeout);
          activeWs?.removeListener('message', listener);
          if (parsed.error) reject(new Error(parsed.error));
          else resolve(parsed.cookies || []);
        }
      } catch (e) {
        // ignore
      }
    };
    activeWs?.on('message', listener);
    activeWs?.send(JSON.stringify({ type: 'request_cookies', url: scrapeUrl }));
  });

  let initialCookies: any[] = [];
  try {
    initialCookies = await cookiePromise;
    console.log(`✅ Extracted ${initialCookies.length} cookies.`);
  } catch (err: any) {
    console.error(`❌ Failed to extract cookies: ${err.message}`);
    process.exit(1);
  }

  const scrapedUrls = [
    'https://www.instagram.com/reels/DbmXhvuI1mi/',
    'https://www.instagram.com/reels/DbklGNvy5L-/',
    'https://www.instagram.com/reels/DZXbVxqJA8C/',
    'https://www.instagram.com/reels/DVvPOgejG_J/',
    'https://www.instagram.com/reels/DZX5VnPPoeL/',
    'https://www.instagram.com/reels/DaGMF0Shu-x/',
    'https://www.instagram.com/reels/DZo1T_GC8SU/',
    'https://www.instagram.com/reels/DbdyfEVS6U5/',
    'https://www.instagram.com/reels/DY26jguRiYi/',
    'https://www.instagram.com/reels/DZYL6FCsTRM/',
    'https://www.instagram.com/reels/DbJbNWRu6JF/',
    'https://www.instagram.com/reels/DbZQpJ9S64Y/',
    'https://www.instagram.com/reels/DbX9nTmgRM-/',
    'https://www.instagram.com/reels/Dals6LWtiwg/',
    'https://www.instagram.com/reels/DaKcd5Ixoeo/',
    'https://www.instagram.com/reels/Da3TE1Sz0dA/',
    'https://www.instagram.com/reels/DacCbekkaRY/',
    'https://www.instagram.com/reels/DbocFS5KmnA/',
    'https://www.instagram.com/reels/DbnM8EeMUu7/',
    'https://www.instagram.com/reels/DblA5XPMDhs/',
    'https://www.instagram.com/reels/DbORVAlpFzd/'
  ];

  if (scrapedUrls.length === 0) {
    console.log("Failed to scrape any URLs.");
    process.exit(1);
  }

  for (let u = 0; u < scrapedUrls.length; u++) {
    const url = scrapedUrls[u];
    const attemptNum = u + 1;
    console.log(`\n========================================`);
    console.log(`[Attempt ${attemptNum}/${scrapedUrls.length}] Testing URL: ${url}`);
    
    // We already have valid cookies, we don't need to request them again for every video 
    // unless they expire, but they won't expire in 2 minutes.
    const cookies = initialCookies;

    console.log('Starting Download...');
    console.log('Starting Download...');
    try {
      const fileName = `test_video_${attemptNum}`;
      const start = Date.now();
      const res = await downloader.download({
        url,
        outputFolder: OUTPUT_DIR,
        fileName,
        cookies
      });
      const duration = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`✅ Download Success! (Took ${duration}s)`);
      
      if (fs.existsSync(res.filePath)) {
         // fs.unlinkSync(res.filePath); // Commented out to prove they actually download!
         console.log(`📂 Saved permanently to: ${res.filePath}`);
      }
    } catch (err: any) {
      console.error(`\n❌ DOWNLOAD FAILED: ${err.message}`);
      console.error(`\n--- RATE LIMIT / BOT DETECTION TRIGGERED! ---`);
      console.log(`We successfully downloaded ${attemptNum - 1} videos before being blocked.`);
      process.exit(1);
    }

    const delayMs = Math.floor(Math.random() * 3000) + 2000;
    console.log(`Sleeping for ${(delayMs / 1000).toFixed(1)}s to mimic human behavior...`);
    await sleep(delayMs);
  }

  console.log('\n🎉 TEST COMPLETED SUCCESSFULLY! 🎉');
  console.log(`No bot detection triggered after ${scrapedUrls.length} unique sequential downloads.`);
  process.exit(0);
}

runTest().catch(err => {
  console.error(err);
  process.exit(1);
});
