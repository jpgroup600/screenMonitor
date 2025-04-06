const { contextBridge, ipcRenderer } = require("electron");

// Expose a method to get the BACKEND_URL from the main process.
contextBridge.exposeInMainWorld("backend", {
  getBackendUrl: async () => await ipcRenderer.invoke("get-backend-url"),
});

// Expose window controls and additional session-related functions.
contextBridge.exposeInMainWorld("electronAPI", {
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-close"),
  sessionStart: () => ipcRenderer.send("session-start"),
  sessionEnd: () => ipcRenderer.send('session-end'),
  userActivity: () => ipcRenderer.send("user-activity"),
  captureScreenshot: () => ipcRenderer.invoke('capture-screenshot'),
});
