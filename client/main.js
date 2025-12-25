const { app, BrowserWindow, globalShortcut, ipcMain, powerSaveBlocker, session, Menu } = require('electron');
const path = require('path');

let mainWindow = null;
let examWindow = null;
let examContentWindow = null; // Separate window for exam content
let powerSaveBlockerId = null;
let isInExamMode = false;
let allowedUrls = [];
let attemptId = null;
let appIsReady = false;

const isDev = !app.isPackaged;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
    title: 'Secure Exam Browser',
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5174');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createExamWindow(urls) {
  if (mainWindow) {
    mainWindow.close();
    mainWindow = null;
  }

  allowedUrls = urls;

  // Create the exam content window (the actual exam URL)
  examContentWindow = new BrowserWindow({
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
      contextIsolation: true,
      nodeIntegration: false,
      devTools: false,
      // Allow the exam site to work normally
      webSecurity: true,
    },
    title: 'Exam',
  });

  // Load the exam URL directly
  examContentWindow.loadURL(urls[0]);

  examContentWindow.on('close', (e) => {
    if (isInExamMode) {
      e.preventDefault();
    }
  });

  // Block new windows/popups
  examContentWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Check if URL is in allowed list
    const isAllowed = allowedUrls.some(allowed => url.startsWith(allowed) || url.includes(new URL(allowed).hostname));
    if (isAllowed) {
      examContentWindow.loadURL(url);
    }
    return { action: 'deny' };
  });

  // Disable right-click context menu
  examContentWindow.webContents.on('context-menu', (e) => {
    e.preventDefault();
  });

  // Block keyboard shortcuts at the webContents level
  examContentWindow.webContents.on('before-input-event', (event, input) => {
    // Block function keys (except F5 for some exam sites that need refresh)
    if (input.key.startsWith('F') && input.key.length <= 3) {
      event.preventDefault();
      reportViolation('key_blocked', `Blocked key: ${input.key}`);
      return;
    }

    // Block Escape key
    if (input.key === 'Escape') {
      event.preventDefault();
      return;
    }

    // Block Alt combinations (except Alt+letter for special characters)
    if (input.alt && (input.control || input.meta || input.key === 'Tab' || input.key === 'F4')) {
      event.preventDefault();
      reportViolation('key_blocked', `Blocked: Alt+${input.key}`);
      return;
    }

    // Block Windows/Super key combinations
    if (input.meta) {
      event.preventDefault();
      reportViolation('key_blocked', `Blocked: Win+${input.key}`);
      return;
    }

    // Block Ctrl+Shift combinations (DevTools, etc.) except copy/paste
    if (input.control && input.shift) {
      const allowed = ['C', 'V', 'X']; // Allow Ctrl+Shift+C for some sites
      if (!allowed.includes(input.key.toUpperCase())) {
        event.preventDefault();
        reportViolation('key_blocked', `Blocked: Ctrl+Shift+${input.key}`);
        return;
      }
    }

    // Block specific Ctrl combinations
    if (input.control) {
      const blocked = ['n', 'w', 't', 'r', 'u', 'o', 'p', 's', 'Tab'];
      if (blocked.includes(input.key.toLowerCase()) || blocked.includes(input.key)) {
        event.preventDefault();
        reportViolation('key_blocked', `Blocked: Ctrl+${input.key}`);
        return;
      }
    }
  });

  examContentWindow.on('closed', () => {
    examContentWindow = null;
  });

  // Create a control bar window at top-right corner
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;

  examWindow = new BrowserWindow({
    width: 300,
    height: 60,
    x: screenWidth - 310,
    y: 10,
    frame: false,
    autoHideMenuBar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: true,
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: false,
    },
    title: 'Exam Controls',
  });

  // Set the window to be on top of fullscreen windows
  examWindow.setAlwaysOnTop(true, 'screen-saver');

  if (isDev) {
    examWindow.loadURL('http://localhost:5174/#/exam-controls');
  } else {
    examWindow.loadFile(path.join(__dirname, 'dist/renderer/index.html'), { hash: '/exam-controls' });
  }

  examWindow.on('closed', () => {
    examWindow = null;
  });

  // Keep control bar on top when exam window gains focus
  examContentWindow.on('focus', () => {
    if (examWindow) {
      examWindow.moveTop();
    }
  });
}

function reportViolation(type, description, details) {
  if (!attemptId || !examWindow) return;
  examWindow.webContents.send('report-violation', {
    attemptId,
    violation: { type, description, details },
  });
}

function registerBlockedShortcuts() {
  // Only register shortcuts after app is ready
  if (!appIsReady) {
    console.log('App not ready, skipping shortcut registration');
    return;
  }

  const shortcuts = [
    // Window management
    'Alt+F4',           // Close window
    'Alt+Escape',       // Cycle windows
    'Alt+Tab',          // Switch windows (may not work on all OS)
    'Alt+Shift+Tab',    // Switch windows reverse
    'Super+Tab',        // Task view (Windows)
    'Super+D',          // Show desktop (Windows)
    'Super+M',          // Minimize all (Windows)
    'Super+E',          // Open File Explorer (Windows)
    'Super+R',          // Open Run dialog (Windows)
    'Super+L',          // Lock screen (Windows)
    'Super+I',          // Open Settings (Windows)
    'Super+S',          // Open Search (Windows)
    'Super+A',          // Open Action Center (Windows)
    'Super+X',          // Quick link menu (Windows)
    'Super+P',          // Project/Display settings
    'Super+Up',         // Maximize window
    'Super+Down',       // Minimize/Restore window
    'Super+Left',       // Snap left
    'Super+Right',      // Snap right
    'Super+Home',       // Minimize all except active
    'Super+Shift+S',    // Screenshot tool (Windows)

    // Browser/App shortcuts
    'CommandOrControl+W',     // Close tab
    'CommandOrControl+Q',     // Quit app
    'CommandOrControl+N',     // New window
    'CommandOrControl+T',     // New tab
    'CommandOrControl+Tab',   // Switch tabs
    'CommandOrControl+Shift+Tab', // Switch tabs reverse
    'CommandOrControl+Shift+N',   // New incognito window
    'CommandOrControl+O',     // Open file
    'CommandOrControl+P',     // Print
    'CommandOrControl+S',     // Save
    'CommandOrControl+R',     // Reload
    'CommandOrControl+Shift+R',   // Hard reload

    // Developer tools
    'CommandOrControl+Shift+I',   // DevTools
    'CommandOrControl+Shift+J',   // DevTools Console
    'CommandOrControl+Shift+C',   // Inspect element
    'CommandOrControl+U',         // View source
    'F12',                        // DevTools

    // Function keys
    'F1',   // Help
    'F3',   // Search
    'F5',   // Refresh
    'F11',  // Fullscreen toggle

    // System shortcuts
    'CommandOrControl+Shift+Escape',  // Task Manager
    'CommandOrControl+Alt+Delete',    // Security options
    'Alt+Space',                      // Window menu
    'Alt+F',                          // File menu

    // Screenshot/Recording
    'PrintScreen',
    'Alt+PrintScreen',
    'CommandOrControl+PrintScreen',

    // Clipboard with context (allow basic copy/paste for exam)
    // 'CommandOrControl+C',  // Allow copy
    // 'CommandOrControl+V',  // Allow paste
    // 'CommandOrControl+X',  // Allow cut
  ];

  shortcuts.forEach((shortcut) => {
    try {
      const success = globalShortcut.register(shortcut, () => {
        reportViolation('shortcut_blocked', `Blocked: ${shortcut}`);
      });
      if (!success) {
        console.log(`Failed to register shortcut: ${shortcut}`);
      }
    } catch (e) {
      console.log(`Error registering shortcut ${shortcut}:`, e.message);
    }
  });

  // Disable the application menu to prevent Alt+F menu access
  Menu.setApplicationMenu(null);

  // Register additional number pad and letter combinations with Super/Win key
  for (let i = 0; i <= 9; i++) {
    try {
      globalShortcut.register(`Super+${i}`, () => {
        reportViolation('shortcut_blocked', `Blocked: Super+${i}`);
      });
    } catch (e) {}
  }
}

// IPC Handlers
ipcMain.handle('start-exam', async (_, data) => {
  attemptId = data.attemptId;
  isInExamMode = true;
  registerBlockedShortcuts();
  powerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep');
  createExamWindow(data.urls);
  return { success: true };
});

ipcMain.handle('end-exam', async () => {
  await exitExamMode();
  return { success: true };
});

ipcMain.handle('get-allowed-urls', () => allowedUrls);
ipcMain.handle('get-attempt-id', () => attemptId);

ipcMain.handle('admin-exit', async (_, password) => {
  const adminPassword = process.env.ADMIN_EXIT_PASSWORD || 'admin123';
  if (password === adminPassword) {
    await exitExamMode();
    return { success: true };
  }
  return { success: false, error: 'Invalid password' };
});

async function exitExamMode() {
  isInExamMode = false;

  if (powerSaveBlockerId !== null) {
    powerSaveBlocker.stop(powerSaveBlockerId);
    powerSaveBlockerId = null;
  }

  globalShortcut.unregisterAll();

  // Close exam content window
  if (examContentWindow) {
    examContentWindow.closable = true;
    examContentWindow.close();
    examContentWindow = null;
  }

  // Close exam controls window
  if (examWindow) {
    examWindow.closable = true;
    examWindow.close();
    examWindow = null;
  }

  createMainWindow();
}

// App lifecycle
app.whenReady().then(() => {
  appIsReady = true;
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
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
});

// Single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    } else if (examWindow) {
      examWindow.focus();
    }
  });
}
