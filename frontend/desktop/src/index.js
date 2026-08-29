const { app, BrowserWindow, ipcMain, powerMonitor, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const FormData = require('form-data');
const started = require('electron-squirrel-startup');
const axios = require('axios');
const screenshot = require('screenshot-desktop');
const PImage = require('pureimage');
const { Readable } = require('stream');
const activeWin = require('active-win');

// Environment Configuration
const isProd = process.env.NODE_ENV === 'production' || __dirname.includes('app.asar');
const envPath = isProd ? path.join(process.resourcesPath, '.env') : path.join(__dirname, '.env');
require('dotenv').config({ path: envPath });

if (started) app.quit();

// Global Variables
let mainWindow;
let tray = null;
const BACKEND_URL = process.env.BACKEND_URL;
let sessionActive = false;
let currentForegroundApp = null;
let isIdle = false;
let backgroundIntervals = [];
global.sharedScreenshotInterval = 600000; // Default 10 minutes

// Platform detection
const isMac = process.platform === 'darwin';
const isWindows = process.platform === 'win32';
const isLinux = process.platform === 'linux';

// 1. SESSION MANAGEMENT
async function sendSessionRequest(type, appName) {
  const endpoint = `${BACKEND_URL}/sessionForegroundApp/${type}`;
  const token = await mainWindow.webContents.executeJavaScript('localStorage.getItem("token")');

  try {
    await axios.post(endpoint, { appName: String(appName) }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
  } catch (error) {
    console.error(`Error sending ${type} request for ${appName}:`, error);
  }
}

// 2. ACTIVITY MONITORING
async function updateForegroundApp() {
  if (!sessionActive) return;

  try {
    const result = await activeWin();
    const newApp = isIdle ? "idle" : (result?.owner?.name || "unknown");

    if (newApp !== currentForegroundApp) {
      if (currentForegroundApp) {
        await sendSessionRequest("end", currentForegroundApp);
      }
      currentForegroundApp = newApp;
      await sendSessionRequest("start", newApp);
    }
  } catch (error) {
    console.error("Error fetching active window info:", error);
  }
}

function checkIdleTime() {
  if (!sessionActive) return;
  
  const idleTime = powerMonitor.getSystemIdleTime();
  if (idleTime >= 15 && !isIdle) {
    isIdle = true;
    updateForegroundApp();
  } else if (idleTime < 15 && isIdle) {
    isIdle = false;
    updateForegroundApp();
  }
}

// 3. SCREENSHOT FUNCTIONALITY
async function captureAndSendScreenshot() {
  if (!sessionActive) return null;

  let tempFilePath;
  try {
    const imgBuffer = await screenshot({ format: "png" });
    const img = await PImage.decodePNGFromStream(Readable.from(imgBuffer));
    
    const { width, height } = calculateDimensions(img.width, img.height);
    const resizedImg = resizeImage(img, width, height);
    
    tempFilePath = await saveTempImage(resizedImg);
    await uploadScreenshot(tempFilePath);
    
    return { path: tempFilePath, timestamp: new Date().toISOString() };
  } catch (error) {
    console.error("Screenshot error:", error);
    return null;
  } finally {
    if (tempFilePath) {
      setTimeout(() => {
        try { fs.unlinkSync(tempFilePath); } 
        catch (e) { console.warn("Failed to delete temp file:", e); }
      }, 30000);
    }
  }
}

function calculateDimensions(originalWidth, originalHeight) {
  const maxWidth = 1280, maxHeight = 720;
  const ratio = Math.min(maxWidth / originalWidth, maxHeight / originalHeight);
  return {
    width: Math.round(originalWidth * ratio),
    height: Math.round(originalHeight * ratio)
  };
}

function resizeImage(img, width, height) {
  const outImg = PImage.make(width, height);
  const ctx = outImg.getContext('2d');
  ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, width, height);
  return outImg;
}

async function saveTempImage(image) {
  const tempPath = path.join(app.getPath('temp'), `screenshot_${Date.now()}.png`);
  await PImage.encodePNGToStream(image, fs.createWriteStream(tempPath));
  return tempPath;
}

async function uploadScreenshot(filePath) {
  const formData = new FormData();
  formData.append("image", fs.createReadStream(filePath), {
    filename: "screenshot.png",
    contentType: "image/png"
  });

  const token = await mainWindow.webContents.executeJavaScript(
    'localStorage.getItem("token")'
  );

  await axios.post(`${BACKEND_URL}/screenshots/upload`, formData, {
    headers: { 
      ...formData.getHeaders(), 
      Authorization: `Bearer ${token}`
    }
  });
}

// 4. BACKGROUND TASKS
function startBackgroundTasks() {
  stopBackgroundTasks();
  console.log("Starting background monitoring tasks");
  
  backgroundIntervals = [
    setInterval(updateForegroundApp, 1000),
    setInterval(checkIdleTime, 5000),
    setInterval(captureAndSendScreenshot, global.sharedScreenshotInterval)
  ];

  updateForegroundApp();
  captureAndSendScreenshot();
}

function stopBackgroundTasks() {
  backgroundIntervals.forEach(clearInterval);
  backgroundIntervals = [];
}

// 5. WINDOW MANAGEMENT
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      devTools: false
    },
  });

  mainWindow.on('close', (event) => {
    if (sessionActive) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  setupIPC();
  mainWindow.loadURL(`file://${path.join(__dirname, 'dist', 'index.html')}`);

  if (!isProd) {
    mainWindow.webContents.openDevTools();
  }

  // Create tray icon immediately (but it will be hidden until session starts)
  createTray();
  if (!sessionActive) {
    tray?.destroy();
    tray = null;
  }
}

// 6. TRAY MANAGEMENT
function createTray() {
  if (tray) return;

  const iconName = isMac ? 'tray-icon-mac.png' : isWindows ? 'tray-icon-win.png' : 'tray-icon-linux.png';
  const iconPath = path.join(__dirname, 'assets', iconName);
  
  try {
    const image = nativeImage.createFromPath(iconPath);
    tray = new Tray(image.isEmpty() ? path.join(__dirname, 'assets', 'icon.png') : image);
  } catch (e) {
    tray = new Tray(path.join(__dirname, 'assets', 'icon.png'));
  }

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Restore', click: () => mainWindow.show() },
    { 
      label: 'End Session & Quit', 
      click: () => {
        sessionActive = false;
        stopBackgroundTasks();
        tray?.destroy();
        tray = null;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('ETracker');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => mainWindow.show());
}

// 7. IPC COMMUNICATION
function setupIPC() {
  // Window controls
  ipcMain.on("window-minimize", () => {
    if (sessionActive) {
      mainWindow.hide();
    } else {
      mainWindow.minimize();
    }
  });

  ipcMain.on("window-maximize", () => {
    mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize();
  });

  ipcMain.on("window-close", () => {
    mainWindow?.close();
  });

  // Screenshot handling
  ipcMain.handle('capture-screenshot', captureAndSendScreenshot);
  ipcMain.on('set-screenshot-interval', (event, interval) => {
    global.sharedScreenshotInterval = interval;
    if (sessionActive) startBackgroundTasks();
  });

  // Session management
  ipcMain.on("user-activity", () => {
    if (sessionActive && isIdle) {
      isIdle = false;
      updateForegroundApp();
    }
  });

  ipcMain.on("session-start", () => {
    sessionActive = true;
    createTray();
    startBackgroundTasks();
    
    if (isMac) {
      app.dock.hide();
    }
  });

  ipcMain.on("session-end", () => {
    sessionActive = false;
    stopBackgroundTasks();
    
    if (isMac) {
      app.dock.show();
    }
    
    tray?.destroy();
    tray = null;
  });

  ipcMain.handle('get-backend-url', () => BACKEND_URL);
}

// 8. APP LIFECYCLE
app.setLoginItemSettings({
  openAtLogin: true,
  path: app.getPath('exe')
});

app.whenReady().then(() => {
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (isMac && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (!isMac || !tray) {
    app.quit();
  }
});