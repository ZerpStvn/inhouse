const { app, BrowserWindow, globalShortcut, ipcMain, powerSaveBlocker, session, Menu, screen } = require('electron');
const path = require('path');
const { exec } = require('child_process');

let mainWindow = null;
let examWindow = null;
let examContentWindow = null; // Separate window for exam content
let powerSaveBlockerId = null;
let isInExamMode = false;
let allowedUrls = [];
let attemptId = null;
let appIsReady = false;
let focusInterval = null;
let processMonitorInterval = null;
let lastForegroundApp = null;
let keyboardHookProcess = null;
let lastViolationTime = 0;
let lastViolationType = null;
let lastViolationDetails = null;
let violationCount = 0;
const VIOLATION_COOLDOWN = 1500; // 1.5 seconds between same violation type

const isDev = !app.isPackaged;
const isWindows = process.platform === 'win32';

// Lockdown functions for Windows
function setupLockdown() {
  if (!isWindows) return;

  // Disable Task Manager
  exec('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v DisableTaskMgr /t REG_DWORD /d 1 /f');

  // Disable Lock Workstation
  exec('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v DisableLockWorkstation /t REG_DWORD /d 1 /f');

  // Disable Windows key
  exec('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer" /v NoWinKeys /t REG_DWORD /d 1 /f');

  // Don't hide taskbar - fullscreen covers it anyway and detection still works
  // hideTaskbar();
}

function cleanupLockdown() {
  if (!isWindows) return;

  // Re-enable Task Manager
  exec('reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v DisableTaskMgr /f');

  // Re-enable Lock Workstation
  exec('reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v DisableLockWorkstation /f');

  // Re-enable Windows key
  exec('reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer" /v NoWinKeys /f');

  // Taskbar not hidden, no need to show
  // showTaskbar();
}

function hideTaskbar() {
  if (!isWindows) return;
  // Hide main taskbar
  exec('powershell -Command "$p=\'[DllImport(\\\"user32.dll\\\")] public static extern int FindWindow(string className, string windowName); [DllImport(\\\"user32.dll\\\")] public static extern int ShowWindow(int hwnd, int nCmdShow);\'; Add-Type -MemberDefinition $p -Name Win32 -Namespace Native; $h=[Native.Win32]::FindWindow(\'Shell_TrayWnd\',\'\'); [Native.Win32]::ShowWindow($h,0)"');
  // Also hide secondary taskbar (for multi-monitor)
  exec('powershell -Command "$p=\'[DllImport(\\\"user32.dll\\\")] public static extern int FindWindow(string className, string windowName); [DllImport(\\\"user32.dll\\\")] public static extern int ShowWindow(int hwnd, int nCmdShow);\'; Add-Type -MemberDefinition $p -Name Win32 -Namespace Native; $h=[Native.Win32]::FindWindow(\'Shell_SecondaryTrayWnd\',\'\'); [Native.Win32]::ShowWindow($h,0)"');
}

function showTaskbar() {
  if (!isWindows) return;
  // Show main taskbar
  exec('powershell -Command "$p=\'[DllImport(\\\"user32.dll\\\")] public static extern int FindWindow(string className, string windowName); [DllImport(\\\"user32.dll\\\")] public static extern int ShowWindow(int hwnd, int nCmdShow);\'; Add-Type -MemberDefinition $p -Name Win32 -Namespace Native; $h=[Native.Win32]::FindWindow(\'Shell_TrayWnd\',\'\'); [Native.Win32]::ShowWindow($h,5)"');
  // Also show secondary taskbar
  exec('powershell -Command "$p=\'[DllImport(\\\"user32.dll\\\")] public static extern int FindWindow(string className, string windowName); [DllImport(\\\"user32.dll\\\")] public static extern int ShowWindow(int hwnd, int nCmdShow);\'; Add-Type -MemberDefinition $p -Name Win32 -Namespace Native; $h=[Native.Win32]::FindWindow(\'Shell_SecondaryTrayWnd\',\'\'); [Native.Win32]::ShowWindow($h,5)"');
}

function startFocusMonitoring() {
  if (focusInterval) {
    clearInterval(focusInterval);
  }

  // Very minimal monitoring - only refocus when truly necessary
  focusInterval = setInterval(() => {
    if (!isInExamMode) return;
    if (!examContentWindow || examContentWindow.isDestroyed()) return;

    const contentFocused = examContentWindow.isFocused();
    const controlFocused = examWindow && !examWindow.isDestroyed() && examWindow.isFocused();

    // Only refocus if neither window has focus AND we're in exam mode
    if (!contentFocused && !controlFocused) {
      // Just focus content window, don't touch alwaysOnTop
      examContentWindow.focus();
    }

    // Ensure control bar stays visible (just moveTop, no setAlwaysOnTop)
    if (examWindow && !examWindow.isDestroyed()) {
      examWindow.moveTop();
    }
  }, 2000); // Check much less frequently - every 2 seconds
}

function stopFocusMonitoring() {
  if (focusInterval) {
    clearInterval(focusInterval);
    focusInterval = null;
  }
}

// Detect which application has focus (Windows) - using simpler method
function getForegroundAppName(callback) {
  if (!isWindows) {
    callback(null);
    return;
  }

  // Use a simpler PowerShell command that's more reliable
  const cmd = `powershell -NoProfile -Command "(Get-Process | Where-Object {$_.MainWindowHandle -eq (Add-Type -MemberDefinition '[DllImport(\\\"user32.dll\\\")] public static extern IntPtr GetForegroundWindow();' -Name Win32 -Namespace Native -PassThru)::GetForegroundWindow()}).ProcessName"`;

  exec(cmd, { timeout: 2000 }, (error, stdout, stderr) => {
    if (error) {
      // Fallback: check if our windows are focused
      if (examContentWindow && !examContentWindow.isFocused() && examWindow && !examWindow.isFocused()) {
        callback('unknown_app');
      } else {
        callback(null);
      }
      return;
    }
    const appName = stdout.trim();
    if (appName) {
      callback(appName);
    } else {
      callback(null);
    }
  });
}

// Map process names to friendly app names
function getAppDisplayName(processName) {
  const appNames = {
    'spotify': 'Spotify',
    'discord': 'Discord',
    'chrome': 'Google Chrome',
    'firefox': 'Firefox',
    'msedge': 'Microsoft Edge',
    'opera': 'Opera',
    'brave': 'Brave Browser',
    'notepad': 'Notepad',
    'notepad++': 'Notepad++',
    'code': 'VS Code',
    'sublime_text': 'Sublime Text',
    'explorer': 'File Explorer',
    'taskmgr': 'Task Manager',
    'cmd': 'Command Prompt',
    'powershell': 'PowerShell',
    'windowsterminal': 'Windows Terminal',
    'slack': 'Slack',
    'teams': 'Microsoft Teams',
    'zoom': 'Zoom',
    'whatsapp': 'WhatsApp',
    'telegram': 'Telegram',
    'steam': 'Steam',
    'epicgameslauncher': 'Epic Games',
    'vlc': 'VLC Media Player',
    'winword': 'Microsoft Word',
    'excel': 'Microsoft Excel',
    'powerpnt': 'PowerPoint',
    'outlook': 'Outlook',
    'onenote': 'OneNote',
    'acrobat': 'Adobe Acrobat',
    'photoshop': 'Photoshop',
    'obs64': 'OBS Studio',
    'obs32': 'OBS Studio',
    'sharex': 'ShareX',
    'snagit': 'Snagit',
    'calculatorapp': 'Calculator',
    'mspaint': 'Paint',
    'wordpad': 'WordPad',
  };

  const lowerName = processName.toLowerCase();
  return appNames[lowerName] || processName;
}

// Start monitoring for other applications
function startProcessMonitoring() {
  if (processMonitorInterval) {
    clearInterval(processMonitorInterval);
  }

  const allowedProcesses = ['electron', 'secure exam browser', 'secure-exam-client', 'secure exam'];

  processMonitorInterval = setInterval(() => {
    if (!isInExamMode) return;
    if (!examContentWindow || examContentWindow.isDestroyed()) return;

    // First check if our window lost focus
    const contentFocused = examContentWindow.isFocused();
    const controlFocused = examWindow && !examWindow.isDestroyed() && examWindow.isFocused();
    const ourWindowFocused = contentFocused || controlFocused;

    if (!ourWindowFocused) {
      // Our window is not focused - try to detect what app has focus
      getForegroundAppName((appName) => {
        if (!appName) {
          // Re-focus exam window without reporting if we can't detect app
          forceExamWindowFocus();
          return;
        }

        const lowerAppName = appName.toLowerCase();
        const isAllowed = allowedProcesses.some(p => lowerAppName.includes(p));

        if (!isAllowed && appName !== lastForegroundApp) {
          lastForegroundApp = appName;
          const displayName = getAppDisplayName(appName);

          // Report violation with the app name
          reportViolation('app_opened', `Attempted to open: ${displayName}`, appName);
        }

        // Re-focus exam window if not allowed app
        if (!isAllowed) {
          forceExamWindowFocus();
        }
      });
    } else {
      // Our window is focused, reset the last app tracker
      lastForegroundApp = null;
    }
  }, 1000); // Check every 1 second for violations
}

// Force exam window to front (debounced to prevent flicker)
let lastForceFocusTime = 0;
function forceExamWindowFocus() {
  const now = Date.now();
  // Debounce - don't force focus more than once per 1 second
  if (now - lastForceFocusTime < 1000) return;
  lastForceFocusTime = now;

  if (examContentWindow && !examContentWindow.isDestroyed()) {
    examContentWindow.focus();
  }
  // Always ensure control bar is on top after any focus change
  if (examWindow && !examWindow.isDestroyed()) {
    setTimeout(() => {
      if (examWindow && !examWindow.isDestroyed()) {
        examWindow.moveTop();
      }
    }, 50);
  }
}

function stopProcessMonitoring() {
  if (processMonitorInterval) {
    clearInterval(processMonitorInterval);
    processMonitorInterval = null;
  }
  lastForegroundApp = null;
}

// Start a low-level keyboard hook to detect Alt+Tab and Win+Tab
function startKeyboardHook() {
  if (!isWindows || keyboardHookProcess) return;

  // Use PowerShell to create a low-level keyboard hook that detects Alt+Tab and Win+Tab
  const hookScript = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Windows.Forms;

public class KeyboardHook {
    private const int WH_KEYBOARD_LL = 13;
    private const int WM_KEYDOWN = 0x0100;
    private const int WM_SYSKEYDOWN = 0x0104;
    private const int VK_TAB = 0x09;
    private const int VK_LWIN = 0x5B;
    private const int VK_RWIN = 0x5C;

    [DllImport("user32.dll")]
    private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc callback, IntPtr hInstance, uint threadId);

    [DllImport("user32.dll")]
    private static extern bool UnhookWindowsHookEx(IntPtr hInstance);

    [DllImport("user32.dll")]
    private static extern IntPtr CallNextHookEx(IntPtr idHook, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll")]
    private static extern IntPtr GetModuleHandle(string lpModuleName);

    private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

    private static LowLevelKeyboardProc _proc = HookCallback;
    private static IntPtr _hookID = IntPtr.Zero;
    private static bool winKeyDown = false;

    public static void Main() {
        _hookID = SetHook(_proc);
        Application.Run();
        UnhookWindowsHookEx(_hookID);
    }

    private static IntPtr SetHook(LowLevelKeyboardProc proc) {
        using (var curProcess = System.Diagnostics.Process.GetCurrentProcess())
        using (var curModule = curProcess.MainModule) {
            return SetWindowsHookEx(WH_KEYBOARD_LL, proc, GetModuleHandle(curModule.ModuleName), 0);
        }
    }

    private static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam) {
        if (nCode >= 0) {
            int vkCode = Marshal.ReadInt32(lParam);

            if (vkCode == VK_LWIN || vkCode == VK_RWIN) {
                if ((int)wParam == WM_KEYDOWN || (int)wParam == WM_SYSKEYDOWN) {
                    winKeyDown = true;
                } else {
                    winKeyDown = false;
                }
            }

            if (vkCode == VK_TAB && ((int)wParam == WM_KEYDOWN || (int)wParam == WM_SYSKEYDOWN)) {
                bool altDown = (Control.ModifierKeys & Keys.Alt) == Keys.Alt;
                if (altDown) {
                    Console.WriteLine("ALT_TAB_DETECTED");
                }
                if (winKeyDown) {
                    Console.WriteLine("WIN_TAB_DETECTED");
                }
            }
        }
        return CallNextHookEx(_hookID, nCode, wParam, lParam);
    }
}
"@ -ReferencedAssemblies System.Windows.Forms

[KeyboardHook]::Main()
`;

  // Run the PowerShell hook in the background
  keyboardHookProcess = exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${hookScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { windowsHide: true });

  keyboardHookProcess.stdout?.on('data', (data) => {
    const output = data.toString().trim();
    if (output === 'ALT_TAB_DETECTED' && isInExamMode) {
      console.log('Alt+Tab detected via hook');
      reportViolation('shortcut_blocked', 'Blocked: Alt+Tab (Task Switcher)', 'alt_tab');
      forceExamWindowFocus();
    } else if (output === 'WIN_TAB_DETECTED' && isInExamMode) {
      console.log('Win+Tab detected via hook');
      reportViolation('shortcut_blocked', 'Blocked: Win+Tab (Task View)', 'win_tab');
      forceExamWindowFocus();
    }
  });

  keyboardHookProcess.on('error', (err) => {
    console.log('Keyboard hook error:', err.message);
  });
}

function stopKeyboardHook() {
  if (keyboardHookProcess) {
    keyboardHookProcess.kill();
    keyboardHookProcess = null;
  }
}

// Detect when user tries to use task switcher (Alt+Tab shows no specific app)
function detectTaskSwitcher() {
  if (!isWindows) return;

  // Check if the task switcher or task view is active
  const cmd = `powershell -NoProfile -Command "$fg = Add-Type -MemberDefinition '[DllImport(\\\"user32.dll\\\")] public static extern IntPtr GetForegroundWindow(); [DllImport(\\\"user32.dll\\\")] public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count); [DllImport(\\\"user32.dll\\\")] public static extern int GetClassName(IntPtr hWnd, System.Text.StringBuilder lpClassName, int nMaxCount);' -Name Win32 -Namespace Native -PassThru; $h = [Native.Win32]::GetForegroundWindow(); $sb = New-Object System.Text.StringBuilder(256); [Native.Win32]::GetClassName($h, $sb, 256) | Out-Null; $sb.ToString()"`;

  exec(cmd, { timeout: 1000 }, (error, stdout) => {
    if (error) return;
    const className = stdout.trim();
    // Task switcher class names on Windows
    const taskSwitcherClasses = [
      'MultitaskingViewFrame',      // Win+Tab task view
      'XamlExplorerHostIslandWindow', // Modern task switcher
      'TaskSwitcherWnd',            // Alt+Tab switcher
      'ForegroundStaging',          // Another task switcher class
    ];

    if (taskSwitcherClasses.some(c => className.includes(c))) {
      console.log('Task switcher detected:', className);
      reportViolation('shortcut_blocked', 'Attempted to use Task Switcher', className);
      forceExamWindowFocus();
    }
  });
}

// Called when blur happens - detect if it was Alt+Tab or Win+Tab
function detectTaskSwitcherOnBlur() {
  if (!isWindows) {
    reportViolation('focus_lost', 'Exam window lost focus');
    return;
  }

  // Get both class name and process name of foreground window
  const cmd = `powershell -NoProfile -Command "Add-Type -MemberDefinition '[DllImport(\\\"user32.dll\\\")] public static extern IntPtr GetForegroundWindow(); [DllImport(\\\"user32.dll\\\")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId); [DllImport(\\\"user32.dll\\\")] public static extern int GetClassName(IntPtr hWnd, System.Text.StringBuilder lpClassName, int nMaxCount);' -Name Win32 -Namespace Native -PassThru | Out-Null; $h = [Native.Win32]::GetForegroundWindow(); $sb = New-Object System.Text.StringBuilder(256); [Native.Win32]::GetClassName($h, $sb, 256) | Out-Null; $pid = 0; [Native.Win32]::GetWindowThreadProcessId($h, [ref]$pid) | Out-Null; $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue; Write-Output ($sb.ToString() + '|' + $proc.ProcessName)"`;

  exec(cmd, { timeout: 1000 }, (error, stdout) => {
    if (error) {
      reportViolation('focus_lost', 'Exam window lost focus');
      return;
    }

    const parts = stdout.trim().split('|');
    const className = parts[0] || '';
    const processName = parts[1] || '';

    // Task switcher/view class names
    const taskSwitcherClasses = [
      'MultitaskingViewFrame',       // Win+Tab task view
      'XamlExplorerHostIslandWindow', // Modern task switcher
      'TaskSwitcherWnd',             // Alt+Tab switcher
      'ForegroundStaging',           // Another task switcher class
      'Windows.UI.Core.CoreWindow',  // Sometimes used by task view
    ];

    if (taskSwitcherClasses.some(c => className.includes(c))) {
      // This is a task switcher (Alt+Tab or Win+Tab)
      if (className.includes('MultitaskingViewFrame')) {
        reportViolation('shortcut_blocked', 'Attempted to use: Win+Tab (Task View)', 'win_tab');
      } else {
        reportViolation('shortcut_blocked', 'Attempted to use: Alt+Tab (Task Switcher)', 'alt_tab');
      }
    } else if (processName) {
      // A specific app took focus
      const displayName = getAppDisplayName(processName);
      reportViolation('app_opened', `Attempted to open: ${displayName}`, processName);
    } else {
      reportViolation('focus_lost', 'Exam window lost focus');
    }
  });
}

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
      webSecurity: true,
    },
    autoHideMenuBar: true,
    title: 'Secure Exam Browser',
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5174');
    mainWindow.webContents.openDevTools();
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

  // Get screen dimensions for fullscreen
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  const { x: screenX, y: screenY } = primaryDisplay.bounds;

  // Create the exam content window (the actual exam URL)
  examContentWindow = new BrowserWindow({
    x: screenX,
    y: screenY,
    width: screenWidth,
    height: screenHeight,
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
    focusable: true,
    show: false, // Don't show until ready
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      devTools: isDev,
      webSecurity: true,
    },
    title: 'Exam',
  });

  // Set always on top - use 'floating' which is lower than control bar's 'pop-up-menu'
  examContentWindow.setAlwaysOnTop(true, 'floating');

  // Load the exam URL directly
  examContentWindow.loadURL(urls[0]);

  // Once loaded, ensure it's visible and on top
  examContentWindow.webContents.once('did-finish-load', () => {
    // Ensure fullscreen and kiosk mode
    examContentWindow.setFullScreen(true);
    examContentWindow.setKiosk(true);
    examContentWindow.show();
    examContentWindow.focus();

    // Make sure control bar is on top of exam window (only once at startup)
    if (examWindow) {
      setTimeout(() => {
        examWindow.show();
        examWindow.moveTop();
      }, 200);
    }
  });

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

  // Monitor for focus loss - very minimal, let process monitoring handle violations
  examContentWindow.on('blur', () => {
    if (!isInExamMode || !examContentWindow || examContentWindow.isDestroyed()) return;

    // Ensure control bar stays on top when content loses focus
    if (examWindow && !examWindow.isDestroyed()) {
      examWindow.moveTop();
    }
  });

  // Create a control bar window at top-right corner
  // Get full screen bounds (not work area, since we're in fullscreen/kiosk mode)
  const fullBounds = primaryDisplay.bounds;

  examWindow = new BrowserWindow({
    width: 320,
    height: 130, // Height for main bar + violation counter + message
    x: fullBounds.x + fullBounds.width - 330,
    y: fullBounds.y + 10,
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
    show: false, // Don't show until ready
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: false,
    },
    title: 'Exam Controls',
  });

  // Use 'pop-up-menu' level which is above fullscreen but less aggressive than screen-saver
  examWindow.setAlwaysOnTop(true, 'pop-up-menu');
  examWindow.setVisibleOnAllWorkspaces(true);

  if (isDev) {
    examWindow.loadURL('http://localhost:5174/#/exam-controls');
  } else {
    examWindow.loadFile(path.join(__dirname, 'dist/renderer/index.html'), { hash: '/exam-controls' });
  }

  // Show control bar once loaded and keep it visible
  examWindow.webContents.once('did-finish-load', () => {
    examWindow.show();
    examWindow.moveTop();

    // Periodically ensure control bar stays on top (non-aggressive)
    setInterval(() => {
      if (examWindow && !examWindow.isDestroyed() && isInExamMode) {
        examWindow.moveTop();
      }
    }, 500);
  });

  examWindow.on('closed', () => {
    examWindow = null;
  });
}

function reportViolation(type, description, details) {
  // Check if examWindow exists
  if (!examWindow || examWindow.isDestroyed()) {
    console.log('reportViolation: examWindow not available');
    return;
  }

  const now = Date.now();
  // Debounce same violation type AND same details - prevent spam
  // Different apps or different shortcuts should still count as separate violations
  const isSameViolation = type === lastViolationType && details === lastViolationDetails;
  if (isSameViolation && now - lastViolationTime < VIOLATION_COOLDOWN) {
    return; // Skip duplicate violations within cooldown period
  }

  lastViolationTime = now;
  lastViolationType = type;
  lastViolationDetails = details;
  violationCount++;

  console.log('reportViolation:', type, description, 'Total:', violationCount);

  // Send violation to control bar UI (no separate modal needed)
  examWindow.webContents.send('report-violation', {
    attemptId: attemptId || 'test-attempt',
    violation: { type, description, details },
  });
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
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

  // Setup Windows lockdown (taskbar, task manager, etc.)
  setupLockdown();

  // Register keyboard shortcut blocking
  registerBlockedShortcuts();

  // Prevent system sleep
  powerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep');

  // Create the exam window
  createExamWindow(data.urls);

  // Start continuous focus monitoring
  startFocusMonitoring();

  // Start process monitoring to detect other apps
  startProcessMonitoring();

  // Note: Keyboard hook disabled - causes too much spam and flicker
  // The globalShortcut registration handles most shortcuts

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

  // Stop focus monitoring first
  stopFocusMonitoring();

  // Stop process monitoring
  stopProcessMonitoring();

  // Stop keyboard hook
  stopKeyboardHook();

  // Cleanup Windows lockdown (re-enable taskbar, task manager, etc.)
  cleanupLockdown();

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

  // Reset violation count
  violationCount = 0;

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
  stopFocusMonitoring();
  stopProcessMonitoring();
  stopKeyboardHook();
  cleanupLockdown();
});

// Emergency cleanup on any exit
process.on('exit', () => {
  cleanupLockdown();
});

process.on('SIGINT', () => {
  cleanupLockdown();
  process.exit();
});

process.on('SIGTERM', () => {
  cleanupLockdown();
  process.exit();
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  cleanupLockdown();
  process.exit(1);
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
