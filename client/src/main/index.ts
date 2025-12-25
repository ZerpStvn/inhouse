const {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  session,
  powerSaveBlocker,
} = require('electron');
const path = require('path');
import { setupLockdown, cleanupLockdown } from './lockdown';
import { ProcessMonitor } from './processMonitor';

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

// Disable hardware acceleration for stability
app.disableHardwareAcceleration();

// Prevent the app from being closed via command line
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling');

let mainWindow: any = null;
let examWindow: any = null;
let processMonitor: ProcessMonitor | null = null;
let powerSaveBlockerId: number | null = null;
let isInExamMode = false;
let allowedUrls: string[] = [];
let attemptId: string | null = null;
let focusInterval: NodeJS.Timeout | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 600,
    minHeight: 400,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    autoHideMenuBar: true,
    title: 'Secure Exam Browser',
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5174');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createExamWindow(urls: string[]) {
  // Close main window
  if (mainWindow) {
    mainWindow.close();
    mainWindow = null;
  }

  allowedUrls = urls;

  examWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: true,
    kiosk: true,
    frame: false,
    autoHideMenuBar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      devTools: false,
      // Block pop-ups and new windows
      javascript: true,
      webgl: false,
    },
    title: 'Secure Exam Browser',
  });

  // Prevent window from being closed
  examWindow.on('close', (e) => {
    if (isInExamMode) {
      e.preventDefault();
    }
  });

  // Block new window creation
  examWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  // Setup URL filtering
  setupUrlFiltering();

  // Disable context menu
  examWindow.webContents.on('context-menu', (e) => {
    e.preventDefault();
  });

  // Load the exam renderer
  if (isDev) {
    examWindow.loadURL('http://localhost:5174/#/exam');
  } else {
    examWindow.loadFile(path.join(__dirname, '../renderer/index.html'), {
      hash: '/exam',
    });
  }

  examWindow.on('closed', () => {
    examWindow = null;
  });

  // Monitor for focus loss and re-focus immediately
  examWindow.on('blur', () => {
    if (isInExamMode && examWindow) {
      // Report violation
      reportViolation('focus_lost', 'Exam window lost focus - possible attempt to switch applications');

      // Immediately re-focus the exam window
      setTimeout(() => {
        if (examWindow && isInExamMode) {
          examWindow.focus();
          examWindow.setAlwaysOnTop(true, 'screen-saver');
        }
      }, 100);
    }
  });

  // Start focus monitoring interval
  startFocusMonitoring();
}

function startFocusMonitoring() {
  if (focusInterval) {
    clearInterval(focusInterval);
  }

  // Continuously ensure the exam window stays on top and focused
  focusInterval = setInterval(() => {
    if (isInExamMode && examWindow) {
      const isFocused = examWindow.isFocused();

      if (!isFocused) {
        examWindow.focus();
        examWindow.setAlwaysOnTop(true, 'screen-saver');
        examWindow.moveTop();
      }
    }
  }, 500);
}

function stopFocusMonitoring() {
  if (focusInterval) {
    clearInterval(focusInterval);
    focusInterval = null;
  }
}

function setupUrlFiltering() {
  if (!examWindow) return;

  // Block navigation to non-allowed URLs
  examWindow.webContents.on('will-navigate', (event, url) => {
    if (!isUrlAllowed(url)) {
      event.preventDefault();
      reportViolation('navigation_blocked', `Attempted to navigate to: ${url}`);
    }
  });

  // Block requests to non-allowed domains
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (isInExamMode && !isUrlAllowed(details.url)) {
      // Allow internal electron requests
      if (
        details.url.startsWith('devtools://') ||
        details.url.startsWith('chrome://') ||
        details.url.startsWith('file://') ||
        details.url.startsWith('http://localhost:5174') ||
        details.url.startsWith('data:')
      ) {
        callback({});
        return;
      }
      callback({ cancel: true });
      return;
    }
    callback({});
  });
}

function isUrlAllowed(url: string): boolean {
  if (!isInExamMode) return true;

  try {
    const urlObj = new URL(url);
    return allowedUrls.some((allowed) => {
      const allowedObj = new URL(allowed);
      return urlObj.hostname === allowedObj.hostname;
    });
  } catch {
    return false;
  }
}

function reportViolation(type: string, description: string, details?: string) {
  if (!attemptId) return;

  // Send to server via renderer process
  if (examWindow) {
    examWindow.webContents.send('report-violation', {
      attemptId,
      violation: { type, description, details },
    });
  }
}

// IPC Handlers
ipcMain.handle('start-exam', async (_, data: { urls: string[]; attemptId: string }) => {
  attemptId = data.attemptId;
  isInExamMode = true;

  // Start lockdown
  setupLockdown();

  // Register global shortcuts to block
  registerBlockedShortcuts();

  // Start process monitor
  processMonitor = new ProcessMonitor((violation) => {
    reportViolation(violation.type, violation.description, violation.details);
  });
  processMonitor.start();

  // Prevent system sleep
  powerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep');

  // Create exam window
  createExamWindow(data.urls);

  return { success: true };
});

ipcMain.handle('end-exam', async () => {
  await exitExamMode();
  return { success: true };
});

ipcMain.handle('get-allowed-urls', () => {
  return allowedUrls;
});

ipcMain.handle('get-attempt-id', () => {
  return attemptId;
});

ipcMain.handle('admin-exit', async (_, password: string) => {
  // Simple admin password check (in production, use a more secure method)
  const adminPassword = process.env.ADMIN_EXIT_PASSWORD || 'admin123';
  if (password === adminPassword) {
    await exitExamMode();
    return { success: true };
  }
  return { success: false, error: 'Invalid password' };
});

async function exitExamMode() {
  isInExamMode = false;

  // Stop focus monitoring
  stopFocusMonitoring();

  // Stop process monitor
  if (processMonitor) {
    processMonitor.stop();
    processMonitor = null;
  }

  // Release power save blocker
  if (powerSaveBlockerId !== null) {
    powerSaveBlocker.stop(powerSaveBlockerId);
    powerSaveBlockerId = null;
  }

  // Unregister shortcuts
  globalShortcut.unregisterAll();

  // Cleanup lockdown
  cleanupLockdown();

  // Close exam window
  if (examWindow) {
    examWindow.closable = true;
    examWindow.close();
    examWindow = null;
  }

  // Recreate main window
  createMainWindow();
}

function registerBlockedShortcuts() {
  const shortcuts = [
    'Alt+Tab',
    'Alt+F4',
    'Alt+Escape',
    'CommandOrControl+W',
    'CommandOrControl+Q',
    'CommandOrControl+N',
    'CommandOrControl+T',
    'CommandOrControl+Shift+N',
    'CommandOrControl+Tab',
    'CommandOrControl+Shift+Tab',
    'F11',
    'Super', // Windows key
    'Meta', // Mac command
    'CommandOrControl+Shift+Escape', // Task manager
    'CommandOrControl+Alt+Delete',
    'Alt+Space',
    'F1',
    'F2',
    'F3',
    'F4',
    'F5',
    'F6',
    'F7',
    'F8',
    'F9',
    'F10',
    'F12',
    'PrintScreen',
    'CommandOrControl+P', // Print
    'CommandOrControl+S', // Save
    'CommandOrControl+Shift+I', // DevTools
    'CommandOrControl+Shift+J', // DevTools
    'CommandOrControl+U', // View source
  ];

  for (const shortcut of shortcuts) {
    try {
      globalShortcut.register(shortcut, () => {
        reportViolation('shortcut_blocked', `Attempted to use: ${shortcut}`);
      });
    } catch {
      // Some shortcuts may not be registerable on all platforms
    }
  }
}

// App lifecycle
app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      if (isInExamMode) {
        // Should not happen, but handle gracefully
        createExamWindow(allowedUrls);
      } else {
        createMainWindow();
      }
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  globalShortcut.unregisterAll();
  cleanupLockdown();
});

// Prevent second instance
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  } else if (examWindow) {
    examWindow.focus();
  }
});
