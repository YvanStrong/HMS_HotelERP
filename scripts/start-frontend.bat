@echo off
title HMS Frontend
cd /d "%~dp0..\frontend"

if exist "C:\Program Files\nodejs\node.exe" (
  set "PATH=C:\Program Files\nodejs;%PATH%"
)

set "NODE_ENV=production"
set "NODE_OPTIONS=--max-old-space-size=256"
set "NEXT_TELEMETRY_DISABLED=1"

echo.
echo  HMS Frontend on :3000 (production)
echo  Keep this window open.
echo.

if not exist ".next\BUILD_ID" (
  echo  No production build found. Run scripts\build-frontend.bat first.
  echo  Refusing to start next dev — it freezes this 2 GB VPS.
  if /I not "%HMS_SERVICE_MODE%"=="1" pause
  exit /b 1
)

"C:\Program Files\nodejs\node.exe" ".\node_modules\next\dist\bin\next" start -H 0.0.0.0 -p 3000
echo.
echo  Frontend stopped.
if /I not "%HMS_SERVICE_MODE%"=="1" pause
