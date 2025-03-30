const { app, BrowserWindow, ipcMain, powerMonitor } = require('electron');
const path = require('path');
const fs = require('fs');
const FormData = require('form-data'); 
const started = require('electron-squirrel-startup');
const axios = require('axios');
const screenshot = require('screenshot-desktop');
const PImage = require('pureimage');
const { Readable } = require('stream');

// Determine if we're running in production (packaged) by checking NODE_ENV or if __dirname contains "app.asar"
const isProd = process.env.NODE_ENV === 'production' || __dirname.includes('app.asar');
// In production, the .env file should be located in the resources folder; in development, it's in the current directory.
const envPath = isProd ? path.join(process.resourcesPath, '.env') : path.join(__dirname, '.env');
console.log(`Loading .env from: ${envPath}`);
require('dotenv').config({ path: envPath });

if (started) {
  app.quit();
}

let mainWindow;
const BACKEND_URL = process.env.BACKEND_URL;

// Global flag to track whether a session has been started.
let sessionActive = false;

// Helper function to send session start/end requests to the backend.
// The request body is exactly: { "appName": "string" }
async function sendSessionRequest(type, appName) {
  // type should be "start" or "end"
  const endpoint = `${BACKEND_URL}/sessionForegroundApp/${type}`;
  const body = { appName: String(appName) };

  // Retrieve the token from renderer's localStorage.
  let token = await mainWindow.webContents.executeJavaScript('localStorage.getItem("token")');
  
  console.log(`Sending ${type} request to ${endpoint} with body:`, body, 'and token:', token);
  
  try {
    const response = await axios.post(endpoint, body, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    // console.log(`${type} request sent for ${appName}:`, response.data);
  } catch (error) {
    console.error(`Error sending ${type} request for ${appName}:`, error);
  }
}

let currentForegroundApp = null;
let isIdle = false;

// Check and update the foreground application only if session is active.
async function updateForegroundApp() {
  if (!sessionActive) return; // Only update when session is active.
  
  const activeWin = require('active-win');
  console.log("Calling updateForegroundApp...");
  try {
    const result = await activeWin();
    // If idle, force app name to "idle"; otherwise, use the active window's owner name.
    let newApp = isIdle ? "idle" : (result && result.owner ? result.owner.name : "unknown");

    // If the foreground app has changed, end the previous session (if any) and start a new one.
    if (newApp !== currentForegroundApp) {
      if (currentForegroundApp !== null) {
        await sendSessionRequest("end", currentForegroundApp);
      }
      currentForegroundApp = newApp;
      await sendSessionRequest("start", currentForegroundApp);
    }
  } catch (error) {
    console.error("Error fetching active window info:", error);
  }
}

// Check system idle time (in seconds) and update idle state (only if session is active).
function checkIdleTime() {
  if (!sessionActive) return;
  
  const idleTime = powerMonitor.getSystemIdleTime();
  // Adjust the idle threshold as needed (here it's set to 15 seconds for testing).
  if (idleTime >= 15 && !isIdle) {
    isIdle = true;
    updateForegroundApp();
  } else if (idleTime < 15 && isIdle) {
    isIdle = false;
    updateForegroundApp();
  }
}

async function captureAndSendScreenshot() {
  if (!sessionActive) return;

  console.log("Capturing screenshot...");
  try {
    // Capture screenshot as PNG buffer.
    const imgBuffer = await screenshot({ format: "png" });
    
    // Decode the PNG buffer using PureImage.
    const img = await PImage.decodePNGFromStream(Readable.from(imgBuffer));
    
    // Calculate new dimensions to fit within 1280x720 while preserving aspect ratio.
    const originalWidth = img.width;
    const originalHeight = img.height;
    const maxWidth = 1280;
    const maxHeight = 720;
    const ratio = Math.min(maxWidth / originalWidth, maxHeight / originalHeight);
    const destWidth = Math.round(originalWidth * ratio);
    const destHeight = Math.round(originalHeight * ratio);
    
    // Create a new image canvas with the target dimensions.
    const outImg = PImage.make(destWidth, destHeight);
    const ctx = outImg.getContext('2d');
    // Draw the original image scaled to the new dimensions.
    ctx.drawImage(img, 0, 0, originalWidth, originalHeight, 0, 0, destWidth, destHeight);

    // Write the resized image to a temporary file.
    const tempFilePath = path.join(app.getPath('temp'),'screenshot.png')
    //const tempFilePath = path.join(app.getPath('temp'), 'screenshot.png');
    console.log('Temp File Path:', tempFilePath);
    
    await new Promise((resolve, reject) => {
      const outStream = fs.createWriteStream(tempFilePath);
      PImage.encodePNGToStream(outImg, outStream)
        .then(resolve)
        .catch(reject);
    });

    // Prepare FormData for upload.
    const formData = new FormData();
    formData.append("image", fs.createReadStream(tempFilePath), {
      filename: "screenshot.png",
      contentType: "image/png",
    });

    // Retrieve token from the renderer.
    const token = await mainWindow.webContents.executeJavaScript('localStorage.getItem("token")');

    // Upload the screenshot.
    const response = await axios.post(
      `${BACKEND_URL}/screenshots/upload`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${token}`,
        },
      }
    );

    console.log("Screenshot uploaded successfully:", response.data);

    // Clean up the temporary file.
    fs.unlinkSync(tempFilePath);
  } catch (error) {
    console.error("Error capturing or uploading screenshot:", error.response?.data || error);
  }
}

// Start background tasks for monitoring the active window, idle detection, and screenshot capture.
function startBackgroundTasks() {
  console.log("Starting background tasks for monitoring foreground app, idle detection, and screenshot capture.");
  // Check the active application every 1 second.
  setInterval(updateForegroundApp, 1000);
  // Check idle time every second.
  setInterval(checkIdleTime, 1000);
  // Capture and send screenshot every 10 minutes.
  setInterval(captureAndSendScreenshot, 600000);
  // Perform an initial update.
  updateForegroundApp();
  // Immediately capture and send the first screenshot.
  captureAndSendScreenshot();
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      devTools: true,
    },
  });

  // Expose the BACKEND_URL to the renderer.
  ipcMain.handle('get-backend-url', () => process.env.BACKEND_URL);

  // Window control events.
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

  // Listen for user activity events (mouse or keyboard) from the renderer.
  ipcMain.on("user-activity", () => {
    console.log("Received user-activity event from renderer.");
    if (!sessionActive) return;
    if (isIdle) {
      isIdle = false;
    }
    updateForegroundApp();
  });

  // Listen for session start command from the renderer.
  ipcMain.on("session-start", () => {
    console.log("Received session-start event from renderer.");
    if (mainWindow) {
      mainWindow.minimize();
    }
    sessionActive = true;
    startBackgroundTasks();
  });

  ipcMain.on("session-end", () => {
    console.log("Session gracefully ended");  
    sessionActive = false;
  });

  mainWindow.loadURL(`file://${path.join(__dirname, 'dist', 'index.html')}`);
};

app.setLoginItemSettings({
  openAtLogin: true,
  openAsHidden: false, 
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
