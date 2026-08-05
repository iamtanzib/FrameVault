import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  ensureBinaries: () => ipcRenderer.invoke('ensure-binaries'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  download: (options: any) => ipcRenderer.invoke('download', options),
  cancelDownload: () => ipcRenderer.send('cancel-download'),
  getMetadata: (url: string, cookies?: any[]) => ipcRenderer.invoke('get-metadata', url, cookies),
  onProgress: (callback: (payload: any) => void) => {
    ipcRenderer.removeAllListeners('download-progress');
    ipcRenderer.on('download-progress', (_event, value) => callback(value));
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
  setWindowHeight: (height: number) => ipcRenderer.send('set-window-height', height),
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowClose: () => ipcRenderer.send('window-close'),
  openFolder: (path: string) => ipcRenderer.send('open-folder', path),
  showItemInFolder: (path: string) => ipcRenderer.send('show-item-in-folder', path),
  getHistory: () => ipcRenderer.invoke('get-history'),
  addHistory: (entry: any) => ipcRenderer.invoke('add-history', entry),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  onLog: (callback: (line: string) => void) => {
    ipcRenderer.removeAllListeners('download-log');
    ipcRenderer.on('download-log', (_event, value) => callback(value));
  },
  onExtensionDownload: (callback: (data: any) => void) => {
    ipcRenderer.removeAllListeners('extension-download');
    ipcRenderer.on('extension-download', (_event, value) => callback(value));
  },
  requestExtensionCookies: (url: string) => ipcRenderer.invoke('request-extension-cookies', url),
  onExtensionCookies: (callback: (data: any) => void) => {
    ipcRenderer.removeAllListeners('extension-cookies');
    ipcRenderer.on('extension-cookies', (_event, value) => callback(value));
  },
  onWsError: (callback: (msg: string) => void) => {
    ipcRenderer.removeAllListeners('ws-error');
    ipcRenderer.on('ws-error', (_event, value) => callback(value));
  },
  onUpdateAvailable: (callback: (info: any) => void) => {
    ipcRenderer.removeAllListeners('update-available');
    ipcRenderer.on('update-available', (_event, value) => callback(value));
  },
  onUpdateProgress: (callback: (progressObj: any) => void) => {
    ipcRenderer.removeAllListeners('update-progress');
    ipcRenderer.on('update-progress', (_event, value) => callback(value));
  },
  onUpdateStarted: (callback: (info: any) => void) => {
    ipcRenderer.removeAllListeners('update-started');
    ipcRenderer.on('update-started', (_event, value) => callback(value));
  },
  onUpdateDownloadedReady: (callback: (info: any) => void) => {
    ipcRenderer.removeAllListeners('update-downloaded-ready');
    ipcRenderer.on('update-downloaded-ready', (_event, value) => callback(value));
  },
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (settings: any) => ipcRenderer.invoke('update-settings', settings),
  installUpdate: () => ipcRenderer.send('install-update'),
  checkForUpdates: () => ipcRenderer.send('check-for-updates')
});
