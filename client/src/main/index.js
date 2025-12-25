"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var _a = require('electron'), app = _a.app, BrowserWindow = _a.BrowserWindow, globalShortcut = _a.globalShortcut, ipcMain = _a.ipcMain, session = _a.session, powerSaveBlocker = _a.powerSaveBlocker;
var path = require('path');
var lockdown_1 = require("./lockdown");
var processMonitor_1 = require("./processMonitor");
// Prevent multiple instances
var gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
}
// Disable hardware acceleration for stability
app.disableHardwareAcceleration();
// Prevent the app from being closed via command line
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling');
var mainWindow = null;
var examWindow = null;
var processMonitor = null;
var powerSaveBlockerId = null;
var isInExamMode = false;
var allowedUrls = [];
var attemptId = null;
var focusInterval = null;
var isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
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
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }
    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}
function createExamWindow(urls) {
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
    examWindow.on('close', function (e) {
        if (isInExamMode) {
            e.preventDefault();
        }
    });
    // Block new window creation
    examWindow.webContents.setWindowOpenHandler(function () {
        return { action: 'deny' };
    });
    // Setup URL filtering
    setupUrlFiltering();
    // Disable context menu
    examWindow.webContents.on('context-menu', function (e) {
        e.preventDefault();
    });
    // Load the exam renderer
    if (isDev) {
        examWindow.loadURL('http://localhost:5174/#/exam');
    }
    else {
        examWindow.loadFile(path.join(__dirname, '../renderer/index.html'), {
            hash: '/exam',
        });
    }
    examWindow.on('closed', function () {
        examWindow = null;
    });
    // Monitor for focus loss and re-focus immediately
    examWindow.on('blur', function () {
        if (isInExamMode && examWindow) {
            // Report violation
            reportViolation('focus_lost', 'Exam window lost focus - possible attempt to switch applications');
            // Immediately re-focus the exam window
            setTimeout(function () {
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
    focusInterval = setInterval(function () {
        if (isInExamMode && examWindow) {
            var isFocused = examWindow.isFocused();
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
    if (!examWindow)
        return;
    // Block navigation to non-allowed URLs
    examWindow.webContents.on('will-navigate', function (event, url) {
        if (!isUrlAllowed(url)) {
            event.preventDefault();
            reportViolation('navigation_blocked', "Attempted to navigate to: ".concat(url));
        }
    });
    // Block requests to non-allowed domains
    session.defaultSession.webRequest.onBeforeRequest(function (details, callback) {
        if (isInExamMode && !isUrlAllowed(details.url)) {
            // Allow internal electron requests
            if (details.url.startsWith('devtools://') ||
                details.url.startsWith('chrome://') ||
                details.url.startsWith('file://') ||
                details.url.startsWith('http://localhost:5174') ||
                details.url.startsWith('data:')) {
                callback({});
                return;
            }
            callback({ cancel: true });
            return;
        }
        callback({});
    });
}
function isUrlAllowed(url) {
    if (!isInExamMode)
        return true;
    try {
        var urlObj_1 = new URL(url);
        return allowedUrls.some(function (allowed) {
            var allowedObj = new URL(allowed);
            return urlObj_1.hostname === allowedObj.hostname;
        });
    }
    catch (_a) {
        return false;
    }
}
function reportViolation(type, description, details) {
    if (!attemptId)
        return;
    // Send to server via renderer process
    if (examWindow) {
        examWindow.webContents.send('report-violation', {
            attemptId: attemptId,
            violation: { type: type, description: description, details: details },
        });
    }
}
// IPC Handlers
ipcMain.handle('start-exam', function (_, data) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        attemptId = data.attemptId;
        isInExamMode = true;
        // Start lockdown
        (0, lockdown_1.setupLockdown)();
        // Register global shortcuts to block
        registerBlockedShortcuts();
        // Start process monitor
        processMonitor = new processMonitor_1.ProcessMonitor(function (violation) {
            reportViolation(violation.type, violation.description, violation.details);
        });
        processMonitor.start();
        // Prevent system sleep
        powerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep');
        // Create exam window
        createExamWindow(data.urls);
        return [2 /*return*/, { success: true }];
    });
}); });
ipcMain.handle('end-exam', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, exitExamMode()];
            case 1:
                _a.sent();
                return [2 /*return*/, { success: true }];
        }
    });
}); });
ipcMain.handle('get-allowed-urls', function () {
    return allowedUrls;
});
ipcMain.handle('get-attempt-id', function () {
    return attemptId;
});
ipcMain.handle('admin-exit', function (_, password) { return __awaiter(void 0, void 0, void 0, function () {
    var adminPassword;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                adminPassword = process.env.ADMIN_EXIT_PASSWORD || 'admin123';
                if (!(password === adminPassword)) return [3 /*break*/, 2];
                return [4 /*yield*/, exitExamMode()];
            case 1:
                _a.sent();
                return [2 /*return*/, { success: true }];
            case 2: return [2 /*return*/, { success: false, error: 'Invalid password' }];
        }
    });
}); });
function exitExamMode() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
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
            (0, lockdown_1.cleanupLockdown)();
            // Close exam window
            if (examWindow) {
                examWindow.closable = true;
                examWindow.close();
                examWindow = null;
            }
            // Recreate main window
            createMainWindow();
            return [2 /*return*/];
        });
    });
}
function registerBlockedShortcuts() {
    var shortcuts = [
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
    var _loop_1 = function (shortcut) {
        try {
            globalShortcut.register(shortcut, function () {
                reportViolation('shortcut_blocked', "Attempted to use: ".concat(shortcut));
            });
        }
        catch (_a) {
            // Some shortcuts may not be registerable on all platforms
        }
    };
    for (var _i = 0, shortcuts_1 = shortcuts; _i < shortcuts_1.length; _i++) {
        var shortcut = shortcuts_1[_i];
        _loop_1(shortcut);
    }
}
// App lifecycle
app.whenReady().then(function () {
    createMainWindow();
    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) {
            if (isInExamMode) {
                // Should not happen, but handle gracefully
                createExamWindow(allowedUrls);
            }
            else {
                createMainWindow();
            }
        }
    });
});
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
app.on('before-quit', function () {
    globalShortcut.unregisterAll();
    (0, lockdown_1.cleanupLockdown)();
});
// Prevent second instance
app.on('second-instance', function () {
    if (mainWindow) {
        if (mainWindow.isMinimized())
            mainWindow.restore();
        mainWindow.focus();
    }
    else if (examWindow) {
        examWindow.focus();
    }
});
