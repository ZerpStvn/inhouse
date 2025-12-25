const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  startExam: (data) => ipcRenderer.invoke('start-exam', data),
  endExam: () => ipcRenderer.invoke('end-exam'),
  getAllowedUrls: () => ipcRenderer.invoke('get-allowed-urls'),
  getAttemptId: () => ipcRenderer.invoke('get-attempt-id'),
  adminExit: (password) => ipcRenderer.invoke('admin-exit', password),
  onReportViolation: (callback) => {
    ipcRenderer.on('report-violation', (_, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('report-violation');
  },
});
