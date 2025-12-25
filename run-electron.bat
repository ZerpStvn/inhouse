@echo off
echo Starting Secure Exam Browser...
echo.

REM Clear ELECTRON_RUN_AS_NODE to allow Electron to run properly
set ELECTRON_RUN_AS_NODE=

cd /d "c:\Users\user\Desktop\inhouse\client"

REM Use the client's own electron installation
"c:\Users\user\Desktop\inhouse\client\node_modules\electron\dist\electron.exe" .

pause
