import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface Violation {
  type: string;
  description: string;
  details?: string;
}

// Blacklisted processes - screen recording, VM, remote desktop, etc.
const BLACKLISTED_PROCESSES = [
  // Screen Recording
  'obs64.exe',
  'obs32.exe',
  'obs.exe',
  'camtasia.exe',
  'snagit32.exe',
  'snagit.exe',
  'bandicam.exe',
  'fraps.exe',
  'screenrecorder.exe',
  'sharex.exe',
  'loom.exe',
  'screenpal.exe',
  'screencastify.exe',
  'screenpresso.exe',
  'flashback.exe',
  'action.exe',
  'xsplit.exe',
  'streamlabs.exe',
  'nvidia share.exe',
  'geforce experience.exe',

  // Virtual Machines
  'vmware.exe',
  'vmware-vmx.exe',
  'vmplayer.exe',
  'virtualbox.exe',
  'virtualboxvm.exe',
  'vboxsvc.exe',
  'vboxtray.exe',
  'qemu.exe',
  'qemu-system-x86_64.exe',
  'hyperv.exe',

  // Remote Desktop
  'teamviewer.exe',
  'teamviewer_service.exe',
  'anydesk.exe',
  'ammyy.exe',
  'vnc.exe',
  'vncviewer.exe',
  'tightvnc.exe',
  'ultravnc.exe',
  'rustdesk.exe',
  'parsec.exe',
  'splashtop.exe',
  'logmein.exe',
  'chrome remote desktop.exe',

  // Communication with screen share
  'zoom.exe',
  'discord.exe',
  'slack.exe',
  'skype.exe',
  'teams.exe',
  'webex.exe',

  // Developer Tools (potential cheating)
  'code.exe', // VS Code
  'devenv.exe', // Visual Studio
  'idea64.exe', // IntelliJ
  'pycharm64.exe',
  'webstorm64.exe',
  'notepad++.exe',
  'sublime_text.exe',

  // Other potentially problematic
  'snippingtool.exe',
  'clipchamp.exe',
  'gamebar.exe',
  'xbox game bar.exe',
];

// VM detection indicators
const VM_INDICATORS = {
  processes: [
    'vmtoolsd.exe',
    'vmwaretray.exe',
    'vmwareuser.exe',
    'vboxservice.exe',
    'vboxtray.exe',
    'qemu-ga.exe',
  ],
  registryKeys: [
    'HKLM\\SOFTWARE\\VMware, Inc.\\VMware Tools',
    'HKLM\\SOFTWARE\\Oracle\\VirtualBox Guest Additions',
  ],
};

export class ProcessMonitor {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private onViolation: (violation: Violation) => void;
  private detectedProcesses: Set<string> = new Set();
  private isVm = false;
  private intervalMs: number;

  constructor(onViolation: (violation: Violation) => void, intervalMs = 5000) {
    this.onViolation = onViolation;
    this.intervalMs = intervalMs;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    // Initial check
    this.checkProcesses();
    this.checkVirtualMachine();

    // Periodic checks
    this.intervalId = setInterval(() => {
      this.checkProcesses();
    }, this.intervalMs);
  }

  stop() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.detectedProcesses.clear();
  }

  private async checkProcesses() {
    if (process.platform !== 'win32') return;

    try {
      const { stdout } = await execAsync('tasklist /FO CSV /NH');
      const lines = stdout.split('\n');

      for (const line of lines) {
        const match = line.match(/"([^"]+)"/);
        if (!match) continue;

        const processName = match[1].toLowerCase();

        for (const blacklisted of BLACKLISTED_PROCESSES) {
          if (processName === blacklisted.toLowerCase()) {
            if (!this.detectedProcesses.has(processName)) {
              this.detectedProcesses.add(processName);
              this.onViolation({
                type: 'blacklisted_process',
                description: `Detected blacklisted process: ${processName}`,
                details: processName,
              });

              // Attempt to close the process
              this.killProcess(processName);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to check processes:', error);
    }
  }

  private async killProcess(processName: string) {
    if (process.platform !== 'win32') return;

    try {
      await execAsync(`taskkill /F /IM "${processName}"`);
      console.log(`Killed process: ${processName}`);
    } catch (error) {
      console.error(`Failed to kill process ${processName}:`, error);
    }
  }

  private async checkVirtualMachine() {
    if (process.platform !== 'win32') return;
    if (this.isVm) return; // Only report once

    try {
      // Check for VM processes
      const { stdout } = await execAsync('tasklist /FO CSV /NH');
      const lines = stdout.split('\n');

      for (const line of lines) {
        const match = line.match(/"([^"]+)"/);
        if (!match) continue;

        const processName = match[1].toLowerCase();

        for (const vmProcess of VM_INDICATORS.processes) {
          if (processName === vmProcess.toLowerCase()) {
            this.isVm = true;
            this.onViolation({
              type: 'virtual_machine',
              description: 'Virtual machine detected',
              details: `VM indicator process: ${processName}`,
            });
            return;
          }
        }
      }

      // Check WMI for VM
      const { stdout: wmicOutput } = await execAsync(
        'wmic computersystem get manufacturer,model'
      );
      const wmicLower = wmicOutput.toLowerCase();

      if (
        wmicLower.includes('vmware') ||
        wmicLower.includes('virtualbox') ||
        wmicLower.includes('virtual') ||
        wmicLower.includes('qemu') ||
        wmicLower.includes('xen')
      ) {
        this.isVm = true;
        this.onViolation({
          type: 'virtual_machine',
          description: 'Virtual machine detected',
          details: `System manufacturer/model indicates VM`,
        });
      }
    } catch (error) {
      console.error('Failed to check for VM:', error);
    }
  }

  // Check if screen is being captured
  async checkScreenCapture(): Promise<boolean> {
    // This is a basic check - more sophisticated methods would require native modules
    const captureProcesses = [
      'obs64.exe',
      'obs32.exe',
      'sharex.exe',
      'snippingtool.exe',
      'gamebar.exe',
    ];

    if (process.platform !== 'win32') return false;

    try {
      const { stdout } = await execAsync('tasklist /FO CSV /NH');
      const processes = stdout.toLowerCase();

      for (const proc of captureProcesses) {
        if (processes.includes(proc.toLowerCase())) {
          return true;
        }
      }
    } catch {
      // Ignore errors
    }

    return false;
  }
}
