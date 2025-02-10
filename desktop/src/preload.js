const { contextBridge, ipcRenderer } = require("electron");

// Expose a method to get the BACKEND_URL from the main process
contextBridge.exposeInMainWorld("backend", {
  getBackendUrl: async () => await ipcRenderer.invoke("get-backend-url"), // Ensure it returns a promise
});

// Expose window controls to the renderer process
contextBridge.exposeInMainWorld("electronAPI", {
  minimize: () => ipcRenderer.send("window-minimize"), // Ensure event names match main.js
  maximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-close"),
});
