const { spawn } = require('child_process');
const path = require('path');

// Get the path to the electron executable
const electronPath = path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron.exe');
const appPath = path.join(__dirname, '..');

console.log('Starting Electron...');
console.log('Electron path:', electronPath);
console.log('App path:', appPath);

// Create a clean environment without ELECTRON_RUN_AS_NODE
const cleanEnv = { ...process.env };
delete cleanEnv.ELECTRON_RUN_AS_NODE;
delete cleanEnv.ELECTRON_NO_ASAR;

// Spawn electron with the cleaned environment
const electron = spawn(electronPath, [appPath], {
  stdio: 'inherit',
  env: cleanEnv,
  detached: false,
});

electron.on('error', (err) => {
  console.error('Failed to start Electron:', err);
  process.exit(1);
});

electron.on('close', (code) => {
  process.exit(code || 0);
});
