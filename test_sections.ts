import { spawn } from 'child_process';
import * as path from 'path';
import * as os from 'os';

const BIN_DIR = path.join(os.homedir(), '.aio_downloader_bin');
const ytDlp = path.join(BIN_DIR, 'yt-dlp.exe');
const ffmpeg = path.join(BIN_DIR, 'ffmpeg.exe');

const args = [
  '-N', '8',
  '--concurrent-fragments', '10',
  '--no-check-certificates',
  '--ffmpeg-location', ffmpeg,
  '--newline',
  '-o', 'test_out.mp4',
  '--merge-output-format', 'mp4',
  '-f', 'bestvideo+bestaudio/best',
  '--download-sections', '*00:00:00-00:01:00',
  'https://www.youtube.com/watch?v=jNQXAC9IVRw'
];

const yt = spawn(ytDlp, args);

yt.stdout.on('data', (d) => process.stdout.write(`STDOUT: ${d.toString()}`));
yt.stderr.on('data', (d) => process.stderr.write(`STDERR: ${d.toString()}`));
yt.on('close', (code) => console.log('EXIT', code));
