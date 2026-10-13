@echo off
title Host HMS
cd /d "%~dp0"
set "HMS_SERVICE_MODE=1"

echo.
echo  Host HMS
echo.

if not exist "logs" mkdir logs

if not exist "%~dp0frontend\.next\BUILD_ID" (
  echo  Website build is missing. Building first.
  echo  Backend stays stopped during the build so this 2 GB server does not freeze.
  echo  Leave this window open. Several minutes.
  echo.
  echo building> "logs\frontend-building.lock"
  call "%~dp0scripts\build-frontend.bat"
  if errorlevel 1 (
    echo.
    echo  Website build failed. The site is not hosted.
    pause
    exit /b 1
  )
)

call :listening 8080
if errorlevel 1 (
  echo  Backend is already running.
) else (
  echo  Starting backend...
  start "HMS Backend" "%~dp0scripts\start-backend.bat"
)

call :listening 3000
if errorlevel 1 (
  echo  Frontend is already running.
) else (
  echo  Starting frontend...
  start "HMS Frontend" "%~dp0scripts\start-frontend.bat"
)

echo.
echo  Website:  https://kivucloud.rw
echo  Frontend: http://127.0.0.1:3000
echo  Backend:  http://127.0.0.1:8080
echo.
echo  Leave the backend and frontend windows open.
echo.
pause
exit /b 0

:listening
powershell -NoProfile -Command "try { $c = New-Object System.Net.Sockets.TcpClient; $i = $c.BeginConnect('127.0.0.1', %1, $null, $null); $ok = $i.AsyncWaitHandle.WaitOne(1200) -and $c.Connected; $c.Close(); if ($ok) { exit 1 } else { exit 0 } } catch { exit 0 }"
exit /b
