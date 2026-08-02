import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import { execSync, exec } from 'child_process';

const BIN_DIR = path.join(os.homedir(), '.aio_downloader_bin');
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

const isWin = os.platform() === 'win32';
const isMac = os.platform() === 'darwin';

export const BIN_PATHS = {
  ytDlp: path.join(BIN_DIR, isWin ? 'yt-dlp.exe' : 'yt-dlp'),
  ffmpeg: path.join(BIN_DIR, isWin ? 'ffmpeg.exe' : 'ffmpeg')
};

const URLS = {
  ytDlp: {
    win32: 'https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp.exe',
    darwin: 'https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp_macos',
    linux: 'https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp'
  },
  ffmpeg: {
    win32: 'https://github.com/eugeneware/ffmpeg-static/releases/download/b5.0.1/win32-x64',
    darwin_x64: 'https://github.com/eugeneware/ffmpeg-static/releases/download/b5.0.1/darwin-x64',
    darwin_arm64: 'https://github.com/eugeneware/ffmpeg-static/releases/download/b5.0.1/darwin-arm64',
    linux: 'https://github.com/eugeneware/ffmpeg-static/releases/download/b5.0.1/linux-x64'
  }
};

function getFfmpegUrl(): string {
  if (isWin) return URLS.ffmpeg.win32;
  if (isMac) return os.arch() === 'arm64' ? URLS.ffmpeg.darwin_arm64 : URLS.ffmpeg.darwin_x64;
  return URLS.ffmpeg.linux;
}

function getYtDlpUrl(): string {
  if (isWin) return URLS.ytDlp.win32;
  if (isMac) return URLS.ytDlp.darwin;
  return URLS.ytDlp.linux;
}

async function downloadFile(url: string, dest: string): Promise<void> {
  console.log(`Downloading ${path.basename(dest)} from ${url}...`);
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream'
  });

  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(dest);
    response.data.pipe(writer);
    let error: Error | null = null;
    writer.on('error', err => {
      error = err;
      writer.close();
      reject(err);
    });
    writer.on('close', () => {
      if (!error) resolve();
    });
  });
}

function needsUpdate(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return true;
  const stats = fs.statSync(filePath);
  const age = Date.now() - stats.mtimeMs;
  return age > SEVEN_DAYS;
}

export async function ensureBinaries(): Promise<void> {
  if (!fs.existsSync(BIN_DIR)) {
    fs.mkdirSync(BIN_DIR, { recursive: true });
  }

  const tasks: Promise<void>[] = [];

  if (!fs.existsSync(BIN_PATHS.ytDlp)) {
    tasks.push(downloadFile(getYtDlpUrl(), BIN_PATHS.ytDlp).then(() => {
      if (!isWin) execSync(`chmod +x "${BIN_PATHS.ytDlp}"`);
    }));
  } else {
    const stats = fs.statSync(BIN_PATHS.ytDlp);
    const ONE_DAY = 24 * 60 * 60 * 1000;
    if (Date.now() - stats.mtimeMs > ONE_DAY) {
      exec(`"${BIN_PATHS.ytDlp}" --update-to nightly`, (error) => {
        if (!error) {
          const now = new Date();
          fs.utimesSync(BIN_PATHS.ytDlp, now, now);
        }
      });
    }
  }

  if (!fs.existsSync(BIN_PATHS.ffmpeg)) {
    tasks.push(downloadFile(getFfmpegUrl(), BIN_PATHS.ffmpeg).then(() => {
      if (!isWin) execSync(`chmod +x "${BIN_PATHS.ffmpeg}"`);
    }));
  }

  if (tasks.length > 0) {
    console.log('Provisioning required binaries...');
    await Promise.all(tasks);
    console.log('Binaries provisioned successfully.');
  }
}
