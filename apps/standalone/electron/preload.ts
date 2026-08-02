import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
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
  }
});
