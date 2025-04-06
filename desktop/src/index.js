const { app, BrowserWindow, ipcMain, powerMonitor } = require('electron');
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
const BACKEND_URL = process.env.BACKEND_URL;
let sessionActive = false;
let currentForegroundApp = null;
let isIdle = false;
let backgroundIntervals = [];

// Session Management Functions
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

// Activity Monitoring
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

// Screenshot Functions
async function captureAndSendScreenshot() {
  if (!sessionActive) return null;

  let tempFilePath;
  try {
    // Capture and process screenshot
    const imgBuffer = await screenshot({ format: "png" });
    const img = await PImage.decodePNGFromStream(Readable.from(imgBuffer));
    
    // Calculate dimensions with aspect ratio
    const { width, height } = calculateDimensions(img.width, img.height);
    const resizedImg = resizeImage(img, width, height);
    
    // Save to temp file
    tempFilePath = await saveTempImage(resizedImg);
    
    // Upload to server
    await uploadScreenshot(tempFilePath);
    
    return { path: tempFilePath, timestamp: new Date().toISOString() };
  } catch (error) {
    console.error("Screenshot error:", error);
    return null;
  } finally {
    // Clean up temp file after delay
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

// Background Tasks Management
function startBackgroundTasks() {
  // Clear any existing intervals
  stopBackgroundTasks();

  console.log("Starting background monitoring tasks");
  backgroundIntervals = [
    setInterval(updateForegroundApp, 1000),
    setInterval(checkIdleTime, 1000),
    setInterval(captureAndSendScreenshot, 600000)
  ];

  // Initial updates
  updateForegroundApp();
  captureAndSendScreenshot();
}

function stopBackgroundTasks() {
  backgroundIntervals.forEach(clearInterval);
  backgroundIntervals = [];
}

// Window Management
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      devTools: !isProd
    },
  });

  setupIPC();
  mainWindow.loadURL(`file://${path.join(__dirname, 'dist', 'index.html')}`);

  // Development tools
  if (!isProd) {
    mainWindow.webContents.openDevTools();
  }
}

function setupIPC() {
  // Window controls
  ipcMain.on("window-minimize", () => mainWindow?.minimize());
  ipcMain.on("window-maximize", () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize());
  ipcMain.on("window-close", () => mainWindow?.close());

  // Screenshot handling
  ipcMain.handle('capture-screenshot', captureAndSendScreenshot);
  ipcMain.on('request-screenshot', captureAndSendScreenshot);
  ipcMain.on('signalr-screenshot-request', () => sessionActive && captureAndSendScreenshot());

  // Session management
  ipcMain.on("user-activity", () => {
    if (sessionActive && isIdle) {
      isIdle = false;
      updateForegroundApp();
    }
  });

  ipcMain.on("session-start", () => {
    mainWindow?.minimize();
    sessionActive = true;
    startBackgroundTasks();
  });

  ipcMain.on("session-end", () => {
    sessionActive = false;
    stopBackgroundTasks();
  });

  // Utility
  ipcMain.handle('get-backend-url', () => BACKEND_URL);
}

// App Lifecycle
app.setLoginItemSettings({
  openAtLogin: true,
  openAsHidden: false
});

app.whenReady().then(() => {
  createWindow();
  
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