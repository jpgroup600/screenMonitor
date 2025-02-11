const { app, BrowserWindow,ipcMain } = require('electron');
const path = require('path');
const started = require('electron-squirrel-startup');
require('dotenv').config(); // ✅ Load .env here




// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false, // Removes default title bar
    titleBarStyle: 'hidden', // Hides native title bar on macOS
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Add IPC handler for BACKEND_URL
  ipcMain.handle('get-backend-url', () => process.env.BACKEND_URL);

  ipcMain.on("window-minimize", () => {
    if (mainWindow) mainWindow.minimize();
  });
  
  ipcMain.on("window-maximize", () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });
  
  ipcMain.on("window-close", () => {
    if (mainWindow) mainWindow.close();
  });
  

  // and load the index.html of the app.
  mainWindow.loadURL(`file://${path.join(__dirname, 'dist', 'index.html')}`);

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  // On macOS, re-create a window when the dock icon is clicked
  // and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
