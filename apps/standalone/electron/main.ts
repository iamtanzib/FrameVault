import { app, BrowserWindow, ipcMain, dialog, Notification } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import fs from 'fs';
import { WebSocketServer } from 'ws';
import { ensureBinaries, Downloader, getMetadata } from '@aio-downloader/core';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
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
}

app.whenReady().then(() => {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('aio-downloader', process.execPath, [path.resolve(process.argv[1])]);
    }
  } else {
    app.setAsDefaultProtocolClient('aio-downloader');
  }

  // Check for updates!
  autoUpdater.checkForUpdatesAndNotify();

  createWindow();

  // ---- WebSocket Server for Chrome Extension ----
  const wss = new WebSocketServer({ port: 9555 });
  console.log('[AIO] WebSocket server listening on ws://localhost:9555');

  wss.on('connection', (socket) => {
    console.log('[AIO] Chrome extension connected');

    socket.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString());

        if (data.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong' }));
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
          socket.send(JSON.stringify({ type: 'ack', status: 'received' }));
        }
      } catch (e) {
        console.error('[AIO] WS message parse error:', e);
      }
    });

    socket.on('close', () => {
      console.log('[AIO] Chrome extension disconnected');
    });
  });

  wss.on('error', (err) => {
    console.error('[AIO] WebSocket server error:', err.message);
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
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
