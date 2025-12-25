import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const isWindows = process.platform === 'win32';

// Store original task manager state
let taskManagerDisabled = false;

export function setupLockdown() {
  if (isWindows) {
    disableTaskManager();
    disableAltTab();
    blockWindowsFeatures();
    hideTaskbar();
  }
}

export function cleanupLockdown() {
  if (isWindows) {
    enableTaskManager();
    enableAltTab();
    unblockWindowsFeatures();
    showTaskbar();
  }
}

async function disableTaskManager() {
  if (!isWindows) return;

  try {
    // Disable Task Manager via registry
    await execAsync(
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v DisableTaskMgr /t REG_DWORD /d 1 /f'
    );
    taskManagerDisabled = true;
  } catch (error) {
    console.error('Failed to disable Task Manager:', error);
  }
}

async function enableTaskManager() {
  if (!isWindows || !taskManagerDisabled) return;

  try {
    // Re-enable Task Manager
    await execAsync(
      'reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v DisableTaskMgr /f'
    );
    taskManagerDisabled = false;
  } catch (error) {
    console.error('Failed to enable Task Manager:', error);
  }
}

async function disableAltTab() {
  if (!isWindows) return;

  try {
    // Create a low-level keyboard hook to block Alt+Tab
    // This is handled more effectively via globalShortcut in main process
    // Additional registry-based blocking
    await execAsync(
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v DisableLockWorkstation /t REG_DWORD /d 1 /f'
    );
  } catch (error) {
    console.error('Failed to disable Alt+Tab:', error);
  }
}

async function enableAltTab() {
  if (!isWindows) return;

  try {
    await execAsync(
      'reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v DisableLockWorkstation /f'
    );
  } catch (error) {
    console.error('Failed to enable Alt+Tab:', error);
  }
}

// Additional lockdown utilities
export function hideDesktopIcons() {
  if (!isWindows) return;

  try {
    exec(
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v HideIcons /t REG_DWORD /d 1 /f'
    );
  } catch (error) {
    console.error('Failed to hide desktop icons:', error);
  }
}

export function showDesktopIcons() {
  if (!isWindows) return;

  try {
    exec(
      'reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v HideIcons /f'
    );
  } catch (error) {
    console.error('Failed to show desktop icons:', error);
  }
}

// Block specific Windows features during exam
export function blockWindowsFeatures() {
  if (!isWindows) return;

  try {
    // Disable Windows key
    exec(
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer" /v NoWinKeys /t REG_DWORD /d 1 /f'
    );
  } catch (error) {
    console.error('Failed to block Windows features:', error);
  }
}

export function unblockWindowsFeatures() {
  if (!isWindows) return;

  try {
    exec(
      'reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer" /v NoWinKeys /f'
    );
  } catch (error) {
    console.error('Failed to unblock Windows features:', error);
  }
}

// Hide the Windows taskbar during exam
export function hideTaskbar() {
  if (!isWindows) return;

  try {
    // Use PowerShell to hide the taskbar
    exec(
      'powershell -Command "$p=\'[DllImport(\\\"user32.dll\\\")] public static extern int FindWindow(string className, string windowName); [DllImport(\\\"user32.dll\\\")] public static extern int ShowWindow(int hwnd, int nCmdShow);\'; Add-Type -MemberDefinition $p -Name Win32 -Namespace Native; $h=[Native.Win32]::FindWindow(\'Shell_TrayWnd\',\'\'); [Native.Win32]::ShowWindow($h,0)"'
    );
    // Also hide the Start button
    exec(
      'powershell -Command "$p=\'[DllImport(\\\"user32.dll\\\")] public static extern int FindWindow(string className, string windowName); [DllImport(\\\"user32.dll\\\")] public static extern int ShowWindow(int hwnd, int nCmdShow);\'; Add-Type -MemberDefinition $p -Name Win32 -Namespace Native; $h=[Native.Win32]::FindWindow(\'Button\',\'Start\'); if($h -ne 0){[Native.Win32]::ShowWindow($h,0)}"'
    );
  } catch (error) {
    console.error('Failed to hide taskbar:', error);
  }
}

// Show the Windows taskbar after exam
export function showTaskbar() {
  if (!isWindows) return;

  try {
    exec(
      'powershell -Command "$p=\'[DllImport(\\\"user32.dll\\\")] public static extern int FindWindow(string className, string windowName); [DllImport(\\\"user32.dll\\\")] public static extern int ShowWindow(int hwnd, int nCmdShow);\'; Add-Type -MemberDefinition $p -Name Win32 -Namespace Native; $h=[Native.Win32]::FindWindow(\'Shell_TrayWnd\',\'\'); [Native.Win32]::ShowWindow($h,1)"'
    );
    exec(
      'powershell -Command "$p=\'[DllImport(\\\"user32.dll\\\")] public static extern int FindWindow(string className, string windowName); [DllImport(\\\"user32.dll\\\")] public static extern int ShowWindow(int hwnd, int nCmdShow);\'; Add-Type -MemberDefinition $p -Name Win32 -Namespace Native; $h=[Native.Win32]::FindWindow(\'Button\',\'Start\'); if($h -ne 0){[Native.Win32]::ShowWindow($h,1)}"'
    );
  } catch (error) {
    console.error('Failed to show taskbar:', error);
  }
}
