import { WebSocketServer, WebSocket } from 'ws';
import { Downloader, ensureBinaries } from '@aio-downloader/core';
import * as path from 'path';
import * as fs from 'fs';

const OUTPUT_DIR = 'E:\\\\FrameVault Downloader Test\\\\Stress Test YT';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  console.log('--- FRAMEVAULT ANTI-BOT RESILIENCE TEST (YOUTUBE: 40 VIDEOS) ---');
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
  
  console.log('Fetching JIT Cookies for YouTube...');
  const scrapeUrl = 'https://www.youtube.com/';
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

  const ytUrls = [
    // Long-Form Videos (Under 10 Minutes):
    'https://www.youtube.com/watch?v=A7lyvgnDuDE',
    'https://www.youtube.com/watch?v=pKD5M0JAH3w',
    'https://www.youtube.com/watch?v=1zip1rNaNYs',
    'https://www.youtube.com/watch?v=AKo37XycIaE',
    'https://www.youtube.com/watch?v=zdpxBdtBL4w',
    'https://www.youtube.com/watch?v=T-s1CPpyDdo',
    'https://www.youtube.com/watch?v=EKOU3JWDNLI',
    'https://www.youtube.com/watch?v=uswU1s3M2VE',
    'https://www.youtube.com/watch?v=jmmW0F0biz0',
    'https://www.youtube.com/watch?v=bAyrObl7TYE',
    'https://www.youtube.com/watch?v=ad79nYk2keg',
    'https://www.youtube.com/watch?v=X3paOmcrTjQ',
    'https://www.youtube.com/watch?v=Reza8udb47Y',
    'https://www.youtube.com/watch?v=KbjRYez_me0',
    'https://www.youtube.com/watch?v=Wf2sb1ur0pI',
    'https://www.youtube.com/watch?v=wbftlDzIALA',
    'https://www.youtube.com/watch?v=qzR62JJCMBQ',
    'https://www.youtube.com/watch?v=MttW2lFnhKw',
    'https://www.youtube.com/watch?v=fm4rS7wigj4',
    'https://www.youtube.com/watch?v=Tz9d7By2ytQ',
    // YouTube Shorts:
    'https://www.youtube.com/shorts/hwYOe5nU5d4',
    'https://www.youtube.com/shorts/avJE9hN5sy4',
    'https://www.youtube.com/shorts/mxb2sBLNK5Y',
    'https://www.youtube.com/shorts/TOWgfAj136A',
    'https://www.youtube.com/shorts/IC24FxUCPmY',
    'https://www.youtube.com/shorts/dioC4sSuJUE',
    'https://www.youtube.com/shorts/9TKxHUqWAo4',
    'https://www.youtube.com/shorts/hE6xmg9Mmkc',
    'https://www.youtube.com/shorts/35q2HcdYlek',
    'https://www.youtube.com/shorts/Gb8_plPdJgc',
    'https://www.youtube.com/shorts/IEUuuA878dw',
    'https://www.youtube.com/shorts/iYUdK6dgPLE',
    'https://www.youtube.com/shorts/RPsVvyihj48',
    'https://www.youtube.com/shorts/IxRyNko-71g',
    'https://www.youtube.com/shorts/nI9s2QEWuOU',
    'https://www.youtube.com/shorts/SHP9JFr0yKg',
    'https://www.youtube.com/shorts/9dMFxnpEkKc',
    'https://www.youtube.com/shorts/Pxx-8yZRCqI',
    'https://www.youtube.com/shorts/PTelAW-QYVI',
    'https://www.youtube.com/shorts/Fvl-hyb4tV4'
  ];

  for (let u = 0; u < ytUrls.length; u++) {
    const url = ytUrls[u];
    const attemptNum = u + 1;
    console.log(`\n========================================`);
    console.log(`[Attempt ${attemptNum}/${ytUrls.length}] Testing URL: ${url}`);
    
    // Use the cookies we already have
    const cookies = initialCookies;

    console.log('Starting Download...');
    try {
      const fileName = `yt_test_video_${attemptNum}`;
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
  console.log(`No bot detection triggered after ${ytUrls.length} unique sequential YouTube downloads.`);
  process.exit(0);
}

runTest().catch(err => {
  console.error(err);
  process.exit(1);
});
