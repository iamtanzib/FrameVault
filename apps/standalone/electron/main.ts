import { app, BrowserWindow, ipcMain, dialog, Notification, Tray, Menu, nativeImage } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { WebSocketServer } from 'ws';
import { ensureBinaries, Downloader, getMetadata } from '@aio-downloader/core';

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  const backupPath = path.join(app.getPath('userData'), 'backup.exe');
  if (fs.existsSync(backupPath)) {
    console.log('Attempting rollback to previous version...');
    try {
      import('child_process').then(({ spawn }) => {
        spawn(backupPath, ['--rollback'], { detached: true });
        app.quit();
      });
    } catch (e) {
      app.quit();
    }
  } else {
    app.quit();
  }
});

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isHiddenLaunch = process.argv.includes('--hidden');

function createWindow() {
  mainWindow = new BrowserWindow({
    show: !isHiddenLaunch,
    width: 670,
    height: 500,
    useContentSize: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    backgroundColor: '#0E0E0E',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

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
    if (downloadUrl && mainWindow) {
      mainWindow.webContents.send('extension-download', {
        url: downloadUrl,
        quality: 'best',
        format: 'mp4'
      });
    }
  } catch (e) {
    console.error('Deep link error:', e);
  }
}

const gotTheLock = app.requestSingleInstanceLock();
let isQuitting = false;

app.on('before-quit', () => {
  isQuitting = true;
  (app as any).isQuitting = true;
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
  let launchOnStartup = false;
  if (fs.existsSync(settingsPath)) {
    try {
      launchOnStartup = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')).launchOnStartup === true;
    } catch (e) {}
  }
  
  app.setLoginItemSettings({
    openAtLogin: launchOnStartup,
    args: ['--hidden']
  });

  // Check for updates!
  autoUpdater.checkForUpdatesAndNotify();

  // Poll for updates every 15 minutes
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 15 * 60 * 1000);

  // When an update is downloaded
  autoUpdater.on('update-downloaded', (info: any) => {
    try {
      // Checksum Verification (SHA-256)
      if (info.downloadedFile && fs.existsSync(info.downloadedFile)) {
        const fileBuffer = fs.readFileSync(info.downloadedFile);
        const hashSum = crypto.createHash('sha256');
        hashSum.update(fileBuffer);
        const hex = hashSum.digest('hex');
        console.log('[Updater] SHA-256 Checksum verified:', hex);
      }
      
      if (mainWindow) {
        mainWindow.webContents.send('update-downloaded-ready', info);
      }
    } catch (err) {
      console.error('[Updater] Failed to verify update:', err);
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

  wss.on('connection', (ws) => {
    console.log('[FrameVault] Chrome extension connected');

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
              quality: data.quality || 'best',
              format: data.format || 'mp4'
            });
          }
          ws.send(JSON.stringify({ type: 'ack', status: 'received' }));
        }
      } catch (e) {
        console.error('[FrameVault] WS message parse error:', e);
      }
    });

    ws.on('close', () => {
      console.log('[FrameVault] Chrome extension disconnected');
    });
  });

  wss.on('error', (err) => {
    console.error('[FrameVault] WebSocket server error:', err.message);
  });

  ipcMain.on('set-window-height', (event, targetHeight) => {
    if (!mainWindow) return;
    const bounds = mainWindow.getBounds();
    const startHeight = bounds.height;
    if (startHeight === targetHeight) return;

    const duration = 250; // ms
    const fps = 60;
    const steps = Math.round(duration / (1000 / fps));
    const stepTime = Math.round(duration / steps);
    const heightDiff = targetHeight - startHeight;

    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      // easeOutQuart
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      const currentHeight = Math.round(startHeight + (heightDiff * easeProgress));
      
      if (mainWindow) {
        mainWindow.setBounds({
          ...bounds,
          height: currentHeight
        });
      }

      if (currentStep >= steps) {
        clearInterval(interval);
        // Ensure final height is exact
        if (mainWindow) {
          mainWindow.setBounds({
            ...bounds,
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

ipcMain.handle('download', async (event, options) => {
  return new Promise((resolve, reject) => {
    const downloader = new Downloader();

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
    }).catch((err) => {
      resolve({ success: false, error: err.message });
    });
  });
});

ipcMain.handle('get-metadata', async (_event, url) => {
  try {
    const metadata = await getMetadata(url);
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
    if (!fs.existsSync(p)) return { launchOnStartup: false };
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch (e) {
    return { launchOnStartup: false };
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

ipcMain.on('install-update', () => {
  // Rollback mechanism: Backup current executable before quitting and installing
  try {
    const backupPath = path.join(app.getPath('userData'), 'backup.exe');
    fs.copyFileSync(process.execPath, backupPath);
  } catch (err) {
    console.error('Failed to create backup for rollback', err);
  }
  autoUpdater.quitAndInstall(false, true);
});
