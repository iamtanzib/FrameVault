import { ensureBinaries, Downloader } from './src/index';
import * as path from 'path';
import * as fs from 'fs';

async function run() {
  console.log('Ensuring binaries...');
  await ensureBinaries();
  console.log('Ready to download.');

  const downloader = new Downloader();
  
  let lastProgress = -1;
  downloader.on('progress', (percent) => {
    if (Math.floor(percent) > lastProgress) {
      lastProgress = Math.floor(percent);
      process.stdout.write(`\rProgress: ${percent.toFixed(1)}% `);
    }
  });

  // Example short video for testing
  const url = 'https://www.instagram.com/reels/Dbgje0rvnPn/';
  const outFolder = path.join(__dirname, 'downloads');

  if (!fs.existsSync(outFolder)) {
    fs.mkdirSync(outFolder, { recursive: true });
  }

  console.log(`\nStarting download for ${url}...`);
  await downloader.download({
    url,
    outputFolder: outFolder,
    quality: '720',
    format: 'mp4'
  });

  console.log('\nDownload complete! File saved in:', outFolder);
}

run().catch(console.error);
