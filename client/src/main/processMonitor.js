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
exports.ProcessMonitor = void 0;
var child_process_1 = require("child_process");
var util_1 = require("util");
var execAsync = (0, util_1.promisify)(child_process_1.exec);
// Blacklisted processes - screen recording, VM, remote desktop, etc.
var BLACKLISTED_PROCESSES = [
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
var VM_INDICATORS = {
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
var ProcessMonitor = /** @class */ (function () {
    function ProcessMonitor(onViolation, intervalMs) {
        if (intervalMs === void 0) { intervalMs = 5000; }
        this.isRunning = false;
        this.intervalId = null;
        this.detectedProcesses = new Set();
        this.isVm = false;
        this.onViolation = onViolation;
        this.intervalMs = intervalMs;
    }
    ProcessMonitor.prototype.start = function () {
        var _this = this;
        if (this.isRunning)
            return;
        this.isRunning = true;
        // Initial check
        this.checkProcesses();
        this.checkVirtualMachine();
        // Periodic checks
        this.intervalId = setInterval(function () {
            _this.checkProcesses();
        }, this.intervalMs);
    };
    ProcessMonitor.prototype.stop = function () {
        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.detectedProcesses.clear();
    };
    ProcessMonitor.prototype.checkProcesses = function () {
        return __awaiter(this, void 0, void 0, function () {
            var stdout, lines, _i, lines_1, line, match, processName, _a, BLACKLISTED_PROCESSES_1, blacklisted, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (process.platform !== 'win32')
                            return [2 /*return*/];
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, execAsync('tasklist /FO CSV /NH')];
                    case 2:
                        stdout = (_b.sent()).stdout;
                        lines = stdout.split('\n');
                        for (_i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
                            line = lines_1[_i];
                            match = line.match(/"([^"]+)"/);
                            if (!match)
                                continue;
                            processName = match[1].toLowerCase();
                            for (_a = 0, BLACKLISTED_PROCESSES_1 = BLACKLISTED_PROCESSES; _a < BLACKLISTED_PROCESSES_1.length; _a++) {
                                blacklisted = BLACKLISTED_PROCESSES_1[_a];
                                if (processName === blacklisted.toLowerCase()) {
                                    if (!this.detectedProcesses.has(processName)) {
                                        this.detectedProcesses.add(processName);
                                        this.onViolation({
                                            type: 'blacklisted_process',
                                            description: "Detected blacklisted process: ".concat(processName),
                                            details: processName,
                                        });
                                        // Attempt to close the process
                                        this.killProcess(processName);
                                    }
                                }
                            }
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _b.sent();
                        console.error('Failed to check processes:', error_1);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    ProcessMonitor.prototype.killProcess = function (processName) {
        return __awaiter(this, void 0, void 0, function () {
            var error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (process.platform !== 'win32')
                            return [2 /*return*/];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, execAsync("taskkill /F /IM \"".concat(processName, "\""))];
                    case 2:
                        _a.sent();
                        console.log("Killed process: ".concat(processName));
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _a.sent();
                        console.error("Failed to kill process ".concat(processName, ":"), error_2);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    ProcessMonitor.prototype.checkVirtualMachine = function () {
        return __awaiter(this, void 0, void 0, function () {
            var stdout, lines, _i, lines_2, line, match, processName, _a, _b, vmProcess, wmicOutput, wmicLower, error_3;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (process.platform !== 'win32')
                            return [2 /*return*/];
                        if (this.isVm)
                            return [2 /*return*/]; // Only report once
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, execAsync('tasklist /FO CSV /NH')];
                    case 2:
                        stdout = (_c.sent()).stdout;
                        lines = stdout.split('\n');
                        for (_i = 0, lines_2 = lines; _i < lines_2.length; _i++) {
                            line = lines_2[_i];
                            match = line.match(/"([^"]+)"/);
                            if (!match)
                                continue;
                            processName = match[1].toLowerCase();
                            for (_a = 0, _b = VM_INDICATORS.processes; _a < _b.length; _a++) {
                                vmProcess = _b[_a];
                                if (processName === vmProcess.toLowerCase()) {
                                    this.isVm = true;
                                    this.onViolation({
                                        type: 'virtual_machine',
                                        description: 'Virtual machine detected',
                                        details: "VM indicator process: ".concat(processName),
                                    });
                                    return [2 /*return*/];
                                }
                            }
                        }
                        return [4 /*yield*/, execAsync('wmic computersystem get manufacturer,model')];
                    case 3:
                        wmicOutput = (_c.sent()).stdout;
                        wmicLower = wmicOutput.toLowerCase();
                        if (wmicLower.includes('vmware') ||
                            wmicLower.includes('virtualbox') ||
                            wmicLower.includes('virtual') ||
                            wmicLower.includes('qemu') ||
                            wmicLower.includes('xen')) {
                            this.isVm = true;
                            this.onViolation({
                                type: 'virtual_machine',
                                description: 'Virtual machine detected',
                                details: "System manufacturer/model indicates VM",
                            });
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        error_3 = _c.sent();
                        console.error('Failed to check for VM:', error_3);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    // Check if screen is being captured
    ProcessMonitor.prototype.checkScreenCapture = function () {
        return __awaiter(this, void 0, void 0, function () {
            var captureProcesses, stdout, processes, _i, captureProcesses_1, proc, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        captureProcesses = [
                            'obs64.exe',
                            'obs32.exe',
                            'sharex.exe',
                            'snippingtool.exe',
                            'gamebar.exe',
                        ];
                        if (process.platform !== 'win32')
                            return [2 /*return*/, false];
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, execAsync('tasklist /FO CSV /NH')];
                    case 2:
                        stdout = (_b.sent()).stdout;
                        processes = stdout.toLowerCase();
                        for (_i = 0, captureProcesses_1 = captureProcesses; _i < captureProcesses_1.length; _i++) {
                            proc = captureProcesses_1[_i];
                            if (processes.includes(proc.toLowerCase())) {
                                return [2 /*return*/, true];
                            }
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        _a = _b.sent();
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/, false];
                }
            });
        });
    };
    return ProcessMonitor;
}());
exports.ProcessMonitor = ProcessMonitor;
