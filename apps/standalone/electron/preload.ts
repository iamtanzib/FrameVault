import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  ensureBinaries: () => ipcRenderer.invoke('ensure-binaries'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  download: (options: any) => ipcRenderer.invoke('download', options),
  getMetadata: (url: string) => ipcRenderer.invoke('get-metadata', url),
  onProgress: (callback: (payload: any) => void) => {
    ipcRenderer.on('download-progress', (_event, value) => callback(value));
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
  setWindowHeight: (height: number) => ipcRenderer.send('set-window-height', height),
  openFolder: (path: string) => ipcRenderer.send('open-folder', path),
  showItemInFolder: (path: string) => ipcRenderer.send('show-item-in-folder', path),
  getHistory: () => ipcRenderer.invoke('get-history'),
  addHistory: (entry: any) => ipcRenderer.invoke('add-history', entry),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  onLog: (callback: (line: string) => void) => {
    ipcRenderer.on('download-log', (_event, value) => callback(value));
  },
  onExtensionDownload: (callback: (data: any) => void) => {
    ipcRenderer.on('extension-download', (_event, value) => callback(value));
  },
  onUpdateAvailable: (callback: (info: any) => void) => {
    ipcRenderer.on('update-available', (_event, value) => callback(value));
  },
  onUpdateProgress: (callback: (progressObj: any) => void) => {
    ipcRenderer.on('update-progress', (_event, value) => callback(value));
  },
  onUpdateStarted: (callback: (info: any) => void) => {
    ipcRenderer.on('update-started', (_event, value) => callback(value));
  },
  onUpdateDownloadedReady: (callback: (info: any) => void) => {
    ipcRenderer.on('update-downloaded-ready', (_event, value) => callback(value));
  },
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (settings: any) => ipcRenderer.invoke('update-settings', settings),
  installUpdate: () => ipcRenderer.send('install-update')
});
