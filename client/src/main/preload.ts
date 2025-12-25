const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Start exam session
  startExam: (data) => ipcRenderer.invoke('start-exam', data),

  // End exam session
  endExam: () => ipcRenderer.invoke('end-exam'),

  // Get allowed URLs for exam
  getAllowedUrls: () => ipcRenderer.invoke('get-allowed-urls'),

  // Get current attempt ID
  getAttemptId: () => ipcRenderer.invoke('get-attempt-id'),

  // Admin exit with password
  adminExit: (password) => ipcRenderer.invoke('admin-exit', password),

  // Listen for violation reports from main process
  onReportViolation: (callback) => {
    ipcRenderer.on('report-violation', (_event, data) => callback(data));
    return () => {
      ipcRenderer.removeAllListeners('report-violation');
    };
  },
});
