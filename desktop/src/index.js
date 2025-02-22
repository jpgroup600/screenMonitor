const { app, BrowserWindow, ipcMain, powerMonitor } = require('electron');
const path = require('path');
const started = require('electron-squirrel-startup');
const axios = require('axios');
const screenshot = require('screenshot-desktop');
const { Blob } = require('buffer');
require('dotenv').config(); // Load .env here

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
    console.log(`${type} request sent for ${appName}:`, response.data);
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
    console.log("Active window result:", result);
    // If idle, force app name to "idle"; otherwise, use the active window's owner name.
    let newApp = isIdle ? "idle" : (result && result.owner ? result.owner.name : "unknown");
    console.log("Determined new foreground app as:", newApp);

    // If the foreground app has changed, end the previous session (if any) and start a new one.
    if (newApp !== currentForegroundApp) {
      if (currentForegroundApp !== null) {
        console.log(`Foreground app changed from ${currentForegroundApp} to ${newApp}. Ending previous session.`);
        await sendSessionRequest("end", currentForegroundApp);
      }
      currentForegroundApp = newApp;
      console.log(`Starting new session for foreground app: ${currentForegroundApp}`);
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
  console.log("Idle time:", idleTime);
  // You can adjust the idle threshold as needed (here it's set to 15 seconds for testing).
  if (idleTime >= 15 && !isIdle) {
    console.log("System idle threshold reached, marking as idle.");
    isIdle = true;
    updateForegroundApp();
  } else if (idleTime < 15 && isIdle) {
    console.log("User activity detected; clearing idle state.");
    isIdle = false;
    updateForegroundApp();
  }
}



async function captureAndSendScreenshot() {
  if (!sessionActive) return;

  console.log("Capturing screenshot...");
  try {
    const imgBuffer = await screenshot({ format: 'png' });
    
    // Create Blob from Buffer
    const blob = new Blob([imgBuffer], { type: 'image/png' });
    
    const formData = new FormData();
    formData.append('image', blob, 'screenshot.png');

    const token = await mainWindow.webContents.executeJavaScript(
      'localStorage.getItem("token")'
    );

    const response = await axios.post(
      `${BACKEND_URL}/screenshots/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log("Screenshot uploaded successfully:", response.data);
  } catch (error) {
    console.error("Error capturing or uploading screenshot:", error);
  }
}

// Start background tasks for monitoring the active window, idle detection, and screenshot capture.
function startBackgroundTasks() {
  console.log("Starting background tasks for monitoring foreground app, idle detection, and screenshot capture.");
  // Check the active application every 5 seconds.
  setInterval(updateForegroundApp, 5000);
  // Check idle time every second.
  setInterval(checkIdleTime, 1000);
  // Capture and send screenshot every 5 minutes (300,000 milliseconds).
  setInterval(captureAndSendScreenshot, 10000);
  // Perform an initial update.
  updateForegroundApp();
  // Immediately capture and send the first screenshot.
  captureAndSendScreenshot();
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false, // Removes default title bar.
    titleBarStyle: 'hidden', // Hides native title bar on macOS.
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
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
    if (!sessionActive) return; // Only update if session is active.
    if (isIdle) {
      isIdle = false;
    }
    updateForegroundApp();
  });

  // Listen for session start command from the renderer.
  ipcMain.on("session-start", () => {
    console.log("Received session-start event from renderer.");
    if (mainWindow) {
      mainWindow.minimize(); // Minimize the window when the session starts.
    }
    sessionActive = true; // Mark the session as active.
    startBackgroundTasks();
  });

  mainWindow.loadURL(`file://${path.join(__dirname, 'dist', 'index.html')}`);
};

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
