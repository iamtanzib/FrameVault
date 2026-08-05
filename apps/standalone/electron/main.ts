import { app, BrowserWindow, ipcMain, dialog, Notification, Tray, Menu, nativeImage, screen } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { WebSocketServer } from 'ws';
import { ensureBinaries, Downloader, getMetadata } from '@aio-downloader/core';

// Set true once the app has loaded and survived a short window without
// crashing. The auto-rollback below only triggers while the app is NOT yet
// healthy (i.e. a crash-on-startup right after an update) — a stray runtime
// exception during normal use must never silently roll the version back.
let appHealthy = false;

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  const backupPath = path.join(app.getPath('userData'), 'backup.exe');
  // Only roll back on an early (pre-healthy) crash with a fresh backup present,
  // which indicates the just-installed update is broken on startup.
  if (!appHealthy && fs.existsSync(backupPath)) {
    console.log('Early crash detected after update — attempting rollback...');
    try {
      import('child_process').then(({ spawn }) => {
        spawn(backupPath, ['--rollback'], { detached: true });
        app.quit();
      });
    } catch (e) {
      app.quit();
    }
  }
  // Otherwise: log and keep running. A single async throw shouldn't take the
  // whole app down or revert the user's version.
});

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isHiddenLaunch = process.argv.includes('--hidden');
// Tracks the in-flight window-resize animation so a new resize request can
// cancel it before starting its own (prevents competing setBounds loops).
let resizeInterval: ReturnType<typeof setInterval> | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    show: !isHiddenLaunch,
    width: 540,
    height: 500,
    center: true,
    useContentSize: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#0A0A0B',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Once the app has loaded successfully, we consider it healthy
  // so the auto-rollback won't fire on stray async errors later.
  mainWindow.webContents.once('did-finish-load', () => {
    appHealthy = true;
    setTimeout(() => {
      try {
        const backupPath = path.join(app.getPath('userData'), 'backup.exe');
        if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
      } catch (e) {
        // Non-fatal: leaving a stale backup only affects the next early-crash check.
      }
    }, 8000);
  });

  // Completely remove the top menu bar (File, Edit, View, etc)
  mainWindow.removeMenu();

  mainWindow.on('close', (event) => {
    if (!(app as any).isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}

function handleDeepLink(urlStr: string) {
  try {
    const url = new URL(urlStr);
    const downloadUrl = url.searchParams.get('url');
    if (!downloadUrl || !mainWindow) return;

    // Validate the incoming URL: only accept well-formed http(s) links so a
    // crafted framevault:// link can't push arbitrary schemes (file:, etc.)
    // into the renderer's download flow.
    let parsed: URL;
    try {
      parsed = new URL(downloadUrl);
    } catch {
      console.warn('Deep link rejected: malformed url param');
      return;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      console.warn('Deep link rejected: non-http(s) protocol', parsed.protocol);
      return;
    }

    mainWindow.webContents.send('extension-download', {
      url: downloadUrl,
      quality: 'best',
      format: 'mp4'
    });
  } catch (e) {
    console.error('Deep link error:', e);
  }
}

const gotTheLock = app.requestSingleInstanceLock();
let isQuitting = false;

const activeDownloaders = new Set<Downloader>();

app.on('before-quit', () => {
  isQuitting = true;
  (app as any).isQuitting = true;
  activeDownloaders.forEach(d => {
    if (typeof (d as any).cancel === 'function') {
      (d as any).cancel();
    }
  });
});

ipcMain.on('cancel-download', () => {
  activeDownloaders.forEach(d => {
    if (typeof (d as any).cancel === 'function') {
      (d as any).cancel();
    }
  });
});

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.setAlwaysOnTop(true);
      mainWindow.show();
      mainWindow.focus();
      mainWindow.setAlwaysOnTop(false);
      
      const urlParam = commandLine.find(arg => arg.startsWith('framevault://'));
      if (urlParam) handleDeepLink(urlParam);
    }
  });

  app.whenReady().then(() => {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('framevault', process.execPath, [path.resolve(process.argv[1])]);
    }
  } else {
    app.setAsDefaultProtocolClient('framevault');
  }

  // Set auto-start at login based on settings
  const settingsPath = path.join(app.getPath('userData'), 'settings.json');
  let launchOnStartup = true;
  if (fs.existsSync(settingsPath)) {
    try {
      launchOnStartup = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')).launchOnStartup === true;
    } catch (e) {}
  }
  
  app.setLoginItemSettings({
    openAtLogin: launchOnStartup,
    args: ['--hidden']
  });

  // The frontend will manually trigger checkForUpdates to avoid race conditions.
  // We remove the automatic check on boot from here.

  // When an update is downloaded
  autoUpdater.on('update-downloaded', (info: any) => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) {
        // App is running silently in the background (e.g., auto-started).
        // Show a native OS notification and auto-install silently.
        new Notification({
          title: 'FrameVault Updated',
          body: `Version ${info.version || ''} has been downloaded and installed in the background.`
        }).show();
        
        autoUpdater.quitAndInstall(true, true);
      } else {
        // User is actively using the app, show them the UI modal.
        mainWindow.webContents.send('update-downloaded-ready', info);
      }
    }
  });

  autoUpdater.on('update-available', (info) => {
    if (mainWindow && mainWindow.isVisible()) {
      mainWindow.webContents.send('update-started', info);
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
    if (mainWindow) {
      mainWindow.webContents.send('update-progress', progressObj);
    }
  });

  autoUpdater.on('update-not-available', () => {
    if (mainWindow) {
      mainWindow.webContents.send('update-not-available');
    }
  });

  autoUpdater.on('error', (err) => {
    if (mainWindow) {
      mainWindow.webContents.send('update-error', err?.message || 'Unknown error');
    }
  });

  createWindow();

  // Create System Tray
  const iconBase64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAZElEQVQ4T2NkoBAwUqifYdQAhtEwYIYZ/z8D8R+QhIowzEBZkGQIQyOQG/EfI8MwQxRDGBiG/EcykGGIgY0wMEAxkKQRBgaIBnIMZBgjQhPMY4wMQwxsRBEMDAwM//G7ihQzywAAAAD//6x6xP4AAAAASUVORK5CYII=';
  const icon = nativeImage.createFromDataURL(`data:image/png;base64,${iconBase64}`);
  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open FrameVault', click: () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    }},
    { type: 'separator' },
    { label: 'Quit', click: () => {
      app.quit();
    }}
  ]);
  tray.setToolTip('FrameVault');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Check if opened via protocol (Windows/Linux)
  const urlParam = process.argv.find(arg => arg.startsWith('framevault://'));
  if (urlParam) {
    // Wait for the window to finish loading the React app before sending the URL
    mainWindow?.webContents.once('did-finish-load', () => {
      handleDeepLink(urlParam);
    });
  }

  // ---- WebSocket Server for Chrome Extension ----
  const wss = new WebSocketServer({ port: 9555 });
  console.log('[FrameVault] WebSocket server listening on ws://localhost:9555');

  wss.on('connection', (ws, req) => {
    console.log('[FrameVault] New Chrome Extension connected!');
    const origin = req.headers.origin;
    if (!origin || !origin.startsWith('chrome-extension://')) {
      ws.close();
      return;
    }
    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString());

        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }

        if (data.type === 'download' && data.url) {
          // Bring window to front
          if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.setAlwaysOnTop(true);
            mainWindow.show();
            mainWindow.focus();
            mainWindow.setAlwaysOnTop(false);

            // Send URL to renderer to auto-fill
            mainWindow.webContents.send('extension-download', {
              url: data.url,
              cookies: data.cookies || [],
              quality: data.quality || 'best',
              format: data.format || 'mp4'
            });
          }
          ws.send(JSON.stringify({ type: 'ack', status: 'received' }));
        }
        
        if (data.type === 'hello') {
          console.log(`[FrameVault Extension Debug] Hello received! Extension Version: ${data.version}`);
        }
        
        if (data.type === 'debug') {
          console.log(`[FrameVault Extension Debug] ${data.message}`);
        }
        
        if (data.type === 'cookies_response') {
          console.log(`[FrameVault] Received cookies_response for ${data.url} with ${data.cookies ? data.cookies.length : 0} cookies`);
          if (data.error) console.log(`[FrameVault] Extension Error: ${data.error}`);
          if (mainWindow) {
            mainWindow.webContents.send('extension-cookies', {
              url: data.url,
              cookies: data.cookies || []
            });
          }
        }
      } catch (e) {
        console.error('[FrameVault] WS message parse error:', e);
      }
    });

    ws.on('close', () => {
      // Intentionally empty to reduce terminal noise
    });
  });

  wss.on('error', (err: any) => {
    console.error('[FrameVault] WebSocket server error:', err.message);
    if (err.code === 'EADDRINUSE' && mainWindow) {
      mainWindow.webContents.send('ws-error', 'Port 9555 is already in use. Chrome Extension connection failed.');
    }
  });

  ipcMain.handle('request-extension-cookies', async (_event, url: string) => {
    console.log(`[FrameVault] IPC request-extension-cookies called for url: ${url}`);
    if (wss && wss.clients) {
      console.log(`[FrameVault] Broadcasting cookie request to ${wss.clients.size} connected extensions`);
      wss.clients.forEach((client) => {
        if (client.readyState === 1 /* WebSocket.OPEN */) {
          client.send(JSON.stringify({ type: 'request_cookies', url }));
        }
      });
    } else {
      console.log(`[FrameVault] No wss clients available`);
    }
    return { success: true };
  });

  ipcMain.on('set-window-height', (event, targetHeight) => {
    if (!mainWindow) return;
    const bounds = mainWindow.getBounds();
    const startHeight = bounds.height;
    if (startHeight === targetHeight) return;

    // Cancel any in-flight resize animation so rapid ResizeObserver calls
    // during progressive reveal don't spawn competing setBounds loops that
    // fight each other and cause visible jitter.
    if (resizeInterval) {
      clearInterval(resizeInterval);
      resizeInterval = null;
    }

    // Anchor the window's own center: as height changes, shift `y` so the
    // vertical midpoint stays put. Keeps the user's chosen position (no
    // snap-back to screen center) while stopping the eye from chasing the
    // bottom edge as content reveals/collapses.
    const centerY = bounds.y + startHeight / 2;

    // Keep the window fully inside the current display's work area so the
    // titlebar can never slide off the top edge on any monitor size.
    const workArea = screen.getDisplayMatching(bounds).workArea;
    const clampY = (y: number, h: number) => {
      const maxY = workArea.y + workArea.height - h;
      return Math.round(Math.max(workArea.y, Math.min(y, maxY)));
    };

    const duration = 250; // ms
    const fps = 60;
    const steps = Math.round(duration / (1000 / fps));
    const stepTime = Math.round(duration / steps);
    const heightDiff = targetHeight - startHeight;

    let currentStep = 0;
    resizeInterval = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      // easeOutQuart
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      const currentHeight = Math.round(startHeight + (heightDiff * easeProgress));

      if (mainWindow) {
        mainWindow.setBounds({
          ...bounds,
          y: clampY(centerY - currentHeight / 2, currentHeight),
          height: currentHeight
        });
      }

      if (currentStep >= steps) {
        if (resizeInterval) clearInterval(resizeInterval);
        resizeInterval = null;
        // Ensure final height is exact
        if (mainWindow) {
          mainWindow.setBounds({
            ...bounds,
            y: clampY(centerY - targetHeight / 2, targetHeight),
            height: targetHeight
          });
        }
      }
    }, stepTime);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
} // end of else block
app.on('window-all-closed', () => {
  // Do nothing, let the app run in the tray
});

// IPC Handlers
ipcMain.handle('get-app-version', () => app.getVersion());

// Custom window chrome controls (frameless window)
ipcMain.on('window-minimize', () => {
  mainWindow?.minimize();
});

ipcMain.on('window-close', () => {
  // Triggers the 'close' handler above, which hides to tray unless quitting.
  mainWindow?.close();
});

ipcMain.handle('ensure-binaries', async () => {
  try {
    await ensureBinaries();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('select-folder', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.on('open-folder', (event, folderPath) => {
  import('electron').then(({ shell }) => {
    shell.openPath(folderPath);
  });
});

ipcMain.on('show-item-in-folder', (event, filePath) => {
  import('electron').then(({ shell }) => {
    shell.showItemInFolder(filePath);
  });
});

const downloadQueue: Array<() => Promise<void>> = [];
let isQueueProcessing = false;

async function processDownloadQueue() {
  if (isQueueProcessing || downloadQueue.length === 0) return;
  isQueueProcessing = true;
  while (downloadQueue.length > 0) {
    const task = downloadQueue.shift();
    if (task) {
      try {
        await task();
      } catch (e) {
        console.error('Queue task error:', e);
      }
    }
  }
  isQueueProcessing = false;
}

ipcMain.handle('download', async (event, options) => {
  return new Promise((resolve, reject) => {
    const task = async () => {
      return new Promise<void>((taskResolve) => {
        const downloader = new Downloader();
        activeDownloaders.add(downloader);

        downloader.on('progress', (payload: any) => {
          event.sender.send('download-progress', payload);
        });

        downloader.on('log', (line) => {
          if (mainWindow) {
            mainWindow.webContents.send('download-log', line);
          }
        });

        downloader.download(options).then((res) => {
          if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.setAlwaysOnTop(true);
            mainWindow.show();
            mainWindow.focus();
            mainWindow.setAlwaysOnTop(false);
          }
          
          new Notification({
            title: 'Download Complete',
            body: 'Your video has finished downloading.'
          }).show();
          
          resolve({ success: true, filePath: res.filePath, alreadyExists: res.alreadyExists });
          taskResolve();
        }).catch((err) => {
          resolve({ success: false, error: err.message });
          taskResolve();
        }).finally(() => {
          activeDownloaders.delete(downloader);
        });
      });
    };
    
    downloadQueue.push(task);
    processDownloadQueue();
  });
});

ipcMain.handle('get-metadata', async (_event, url, cookies) => {
  try {
    const metadata = await getMetadata(url, cookies);
    return { success: true, metadata };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

const getHistoryPath = () => path.join(app.getPath('userData'), 'history.json');

ipcMain.handle('get-history', () => {
  try {
    const p = getHistoryPath();
    if (!fs.existsSync(p)) return [];
    const data = fs.readFileSync(p, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
});

ipcMain.handle('add-history', (_event, entry) => {
  try {
    const p = getHistoryPath();
    let history = [];
    if (fs.existsSync(p)) {
      history = JSON.parse(fs.readFileSync(p, 'utf-8'));
    }
    // Add to front
    history.unshift(entry);
    // Keep only last 200 items to avoid infinite growth
    if (history.length > 200) history = history.slice(0, 200);
    fs.writeFileSync(p, JSON.stringify(history, null, 2), 'utf-8');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('clear-history', () => {
  try {
    const p = getHistoryPath();
    if (fs.existsSync(p)) fs.unlinkSync(p);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

const getSettingsPath = () => path.join(app.getPath('userData'), 'settings.json');

ipcMain.handle('get-settings', () => {
  try {
    const p = getSettingsPath();
    if (!fs.existsSync(p)) return { launchOnStartup: true };
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch (e) {
    return { launchOnStartup: true };
  }
});

ipcMain.handle('update-settings', (_event, newSettings) => {
  try {
    const p = getSettingsPath();
    fs.writeFileSync(p, JSON.stringify(newSettings, null, 2), 'utf-8');
    app.setLoginItemSettings({
      openAtLogin: newSettings.launchOnStartup === true,
      args: ['--hidden']
    });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

ipcMain.on('check-for-updates', () => {
  autoUpdater.checkForUpdates();
});

ipcMain.on('install-update', () => {
  // Rollback mechanism: Backup current executable before quitting and installing
  try {
    const backupPath = path.join(app.getPath('userData'), 'backup.exe');
    fs.copyFileSync(process.execPath, backupPath);
  } catch (err) {
    console.error('Failed to create backup for rollback', err);
  }
  // isSilent = true, isForceRunAfter = true (No setup wizard UI)
  autoUpdater.quitAndInstall(true, true);
});
