import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { BIN_PATHS } from './provisioner';
import * as path from 'path';
import * as fs from 'fs';

export interface DownloadOptions {
  url: string;
  outputFolder: string;
  quality?: 'best' | '1080' | '720';
  format?: 'mp4' | 'mp3';
  startTime?: string;
  endTime?: string;
  fileName?: string;
}

export interface VideoMetadata {
  duration: number;
  title: string;
}

export async function getMetadata(url: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const yt = spawn(BIN_PATHS.ytDlp, ['--dump-json', '--no-check-certificates', '--extractor-args', 'youtube:player_client=android', url]);
    let output = '';
    let errOutput = '';
    yt.stdout.on('data', (d) => { output += d.toString(); });
    yt.stderr.on('data', (d) => { errOutput += d.toString(); });
    yt.on('close', (code) => {
      if (code === 0) {
        try {
          const data = JSON.parse(output);
          resolve({ duration: data.duration || 0, title: data.title || '' });
        } catch (e) {
          reject(e);
        }
      } else {
        const cleanErr = errOutput.split('\n').find(l => l.includes('ERROR:')) || errOutput.trim();
        reject(new Error(cleanErr || `yt-dlp exited with code ${code}`));
      }
    });
  });
}

function parseTime(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  if (parts.length === 3) {
    return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseFloat(parts[2]);
  }
  return 0;
}

export class Downloader extends EventEmitter {
  constructor() {
    super();
  }

  public download(options: DownloadOptions): Promise<{ filePath: string, alreadyExists: boolean }> {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(options.outputFolder)) {
        fs.mkdirSync(options.outputFolder, { recursive: true });
      }

      const args = [
        '-N', '8',
        '--concurrent-fragments', '10',
        '--no-check-certificates',
        '--extractor-args', 'youtube:player_client=android',
        '--ffmpeg-location', BIN_PATHS.ffmpeg,
        '--trim-filenames', '100',
        '--windows-filenames',
        '--restrict-filenames',
        '--exec', 'echo AIO_DOWNLOADER_FILE_PATH: {}',
        '--newline'
      ];

      const baseDir = path.join('All in one Downloader', '%(extractor_key)s');

      if (options.format === 'mp3') {
        const outName = options.fileName ? `${options.fileName} -audio only.%(ext)s` : '%(title)s -audio only.%(ext)s';
        args.push('-o', path.join(options.outputFolder, baseDir, outName));
        args.push('-x', '--audio-format', 'mp3');
      } else {
        const outName = options.fileName ? `${options.fileName}.%(ext)s` : '%(title)s.%(ext)s';
        args.push('-o', path.join(options.outputFolder, baseDir, outName));
        args.push('--merge-output-format', 'mp4');
        if (options.quality === '1080') {
          args.push('-f', 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/bestvideo+bestaudio/best');
        } else if (options.quality === '720') {
          args.push('-f', 'bestvideo[height<=720]+bestaudio/best[height<=720]/bestvideo+bestaudio/best');
        } else {
          args.push('-f', 'bestvideo+bestaudio/best');
        }
      }

      let sectionDuration = 0;
      if (options.startTime || options.endTime) {
        const startStr = options.startTime || '00:00:00';
        const endStr = options.endTime || '';
        const startSecs = parseTime(startStr);
        if (endStr && endStr !== 'inf') {
          const endSecs = parseTime(endStr);
          if (endSecs > startSecs) {
            sectionDuration = endSecs - startSecs;
          }
        }
        args.push('--download-sections', `*${startStr}-${endStr || 'inf'}`);
      }

      args.push(options.url);

      const yt = spawn(BIN_PATHS.ytDlp, args);

      let finalDestination = '';
      let alreadyExists = false;

      yt.stdout.on('data', (data) => {
        const str = data.toString();
        this.emit('log', str);
        
        const destMatch = str.match(/\[download\] Destination: (.+)/);
        if (destMatch && !destMatch[1].match(/\.f\d+/)) {
          finalDestination = destMatch[1].trim();
        }
        const mergeMatch = str.match(/\[Merger\] Merging formats into "(.+?)"/);
        if (mergeMatch) {
          finalDestination = mergeMatch[1].trim();
        }
        const extractMatch = str.match(/\[ExtractAudio\] Destination: (.+)/);
        if (extractMatch) {
          finalDestination = extractMatch[1].trim();
        }
        const alreadyMatch = str.match(/\[download\] (.*?) has already been downloaded/);
        if (alreadyMatch) {
          finalDestination = alreadyMatch[1].trim();
          alreadyExists = true;
        }

        const execMatch = str.match(/^AIO_DOWNLOADER_FILE_PATH:\s*(.+)/m);
        if (execMatch) {
          let p = execMatch[1].trim();
          if (p.startsWith('"') && p.endsWith('"')) {
            p = p.slice(1, -1);
          }
          finalDestination = p;
        }

        let percent: number | undefined;
        let eta: string | undefined;

        const percentMatch = str.match(/\[download\]\s+([\d\.]+)%/);
        if (percentMatch) {
          percent = parseFloat(percentMatch[1]);
        }

        const etaMatch = str.match(/ETA\s+([\d:]+)/);
        if (etaMatch) {
          eta = etaMatch[1];
        }

        if (percent !== undefined || eta !== undefined) {
          this.emit('progress', { percent, eta });
        }
      });

      let lastErr = '';
      yt.stderr.on('data', (data) => {
        const str = data.toString();
        this.emit('log', str);
        lastErr += str;
        if (lastErr.length > 2000) {
          lastErr = lastErr.substring(lastErr.length - 2000);
        }

        if (sectionDuration > 0) {
          const timeMatch = str.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
          if (timeMatch) {
            const hours = parseInt(timeMatch[1], 10);
            const mins = parseInt(timeMatch[2], 10);
            const secs = parseFloat(timeMatch[3]);
            const currentSecs = hours * 3600 + mins * 60 + secs;
            const percent = Math.min((currentSecs / sectionDuration) * 100, 99.9);
            
            let eta: string | undefined;
            const speedMatch = str.match(/speed=\s*([\d\.]+)x/);
            if (speedMatch) {
              const speed = parseFloat(speedMatch[1]);
              if (speed > 0) {
                const remainingSecs = Math.max(0, sectionDuration - currentSecs);
                const realEtaSecs = Math.round(remainingSecs / speed);
                
                const eH = Math.floor(realEtaSecs / 3600).toString().padStart(2, '0');
                const eM = Math.floor((realEtaSecs % 3600) / 60).toString().padStart(2, '0');
                const eS = Math.floor(realEtaSecs % 60).toString().padStart(2, '0');
                
                eta = eH === '00' ? `${eM}:${eS}` : `${eH}:${eM}:${eS}`;
              }
            }

            this.emit('progress', { percent, eta });
          }
        }
      });

      yt.on('close', (code) => {
        if (code === 0) {
          if (options.format !== 'mp3' && finalDestination && fs.existsSync(finalDestination)) {
            this.emit('progress', { percent: 100, eta: 'Checking codec...' });
            const ff = spawn(BIN_PATHS.ffmpeg, ['-i', finalDestination]);
            let probeOut = '';
            ff.stderr.on('data', d => { probeOut += d.toString(); });
            ff.on('close', () => {
              const videoStreamMatch = probeOut.match(/Stream #\d+:\d+.*?: Video: ([a-zA-Z0-9]+)/);
              const codec = videoStreamMatch ? videoStreamMatch[1].toLowerCase() : '';
              
              if (codec && codec !== 'h264' && codec !== 'avc1') {
                this.emit('progress', { percent: 0, eta: 'Converting to H.264...' });
                
                const durMatch = probeOut.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
                let totalDur = 0;
                if (durMatch) {
                  totalDur = parseInt(durMatch[1], 10)*3600 + parseInt(durMatch[2], 10)*60 + parseFloat(durMatch[3]);
                } else if (sectionDuration > 0) {
                  totalDur = sectionDuration;
                }
                
                const tempDest = finalDestination + '.temp.mp4';
                const convert = spawn(BIN_PATHS.ffmpeg, [
                  '-i', finalDestination,
                  '-c:v', 'libx264',
                  '-preset', 'fast',
                  '-crf', '23',
                  '-c:a', 'aac',
                  '-b:a', '192k',
                  '-y', tempDest
                ]);
                
                convert.stderr.on('data', cd => {
                  const s = cd.toString();
                  this.emit('log', s);
                  if (totalDur > 0) {
                    const tMatch = s.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
                    if (tMatch) {
                      const cur = parseInt(tMatch[1], 10)*3600 + parseInt(tMatch[2], 10)*60 + parseFloat(tMatch[3]);
                      let pct = (cur / totalDur) * 100;
                      if (pct > 99.9) pct = 99.9;
                      
                      let etaStr = 'Converting...';
                      const spdMatch = s.match(/speed=\s*([\d\.]+)x/);
                      if (spdMatch) {
                        const spd = parseFloat(spdMatch[1]);
                        if (spd > 0) {
                          const rem = Math.max(0, totalDur - cur) / spd;
                          const eH = Math.floor(rem / 3600).toString().padStart(2, '0');
                          const eM = Math.floor((rem % 3600) / 60).toString().padStart(2, '0');
                          const eS = Math.floor(rem % 60).toString().padStart(2, '0');
                          etaStr = eH === '00' ? `Converting ETA ${eM}:${eS}` : `Converting ETA ${eH}:${eM}:${eS}`;
                        }
                      }
                      this.emit('progress', { percent: pct, eta: etaStr });
                    }
                  }
                });
                
                convert.on('close', code2 => {
                  if (code2 === 0) {
                    try {
                      fs.unlinkSync(finalDestination);
                      fs.renameSync(tempDest, finalDestination);
                    } catch (e) {
                      // fallback if rename fails
                    }
                    resolve({ filePath: finalDestination, alreadyExists });
                  } else {
                    reject(new Error(`FFmpeg conversion failed with code ${code2}`));
                  }
                });
              } else {
                resolve({ filePath: finalDestination, alreadyExists });
              }
            });
          } else {
            resolve({ filePath: finalDestination, alreadyExists });
          }
        } else {
          reject(new Error(`yt-dlp exited with code ${code}. Last error: ${lastErr.trim()}`));
        }
      });
      
      yt.on('error', (err) => {
          reject(err);
      });
    });
  }
}
