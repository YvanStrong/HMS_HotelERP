@echo off
REM Production Next.js build for the 2 GB VPS. Keep-alive skips :3000 while the lock file exists.
setlocal
cd /d "%~dp0.."

if exist "C:\Program Files\nodejs\node.exe" (
  set "PATH=C:\Program Files\nodejs;%PATH%"
)

if not exist "logs" mkdir logs
echo building> "logs\frontend-building.lock"

set "NODE_ENV=production"
set "NODE_OPTIONS=--max-old-space-size=768"
set "NEXT_TELEMETRY_DISABLED=1"
set "UV_THREADPOOL_SIZE=2"

echo.
echo  Building HMS frontend (production)...
echo.

pushd frontend
"C:\Program Files\nodejs\node.exe" ".\node_modules\next\dist\bin\next" build
set "ERR=%ERRORLEVEL%"
popd

del /f /q "logs\frontend-building.lock" >nul 2>&1

if not "%ERR%"=="0" (
  echo.
  echo  Frontend build failed.
  if /I not "%HMS_SERVICE_MODE%"=="1" pause
  exit /b %ERR%
)

echo.
echo  Build OK. Start with scripts\start-frontend.bat
if /I not "%HMS_SERVICE_MODE%"=="1" pause
exit /b 0
