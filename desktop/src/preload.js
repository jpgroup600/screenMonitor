const { contextBridge, ipcRenderer } = require('electron');

// Expose a method to get the BACKEND_URL from the main process
contextBridge.exposeInMainWorld('backend', {
  getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),
});