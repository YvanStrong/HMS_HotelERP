@echo off
title HMS Proxy (kivucloud.rw)
cd /d "%~dp0.."

if exist "C:\Program Files\nodejs\node.exe" (
  set "PATH=C:\Program Files\nodejs;%PATH%"
)

echo.
echo  HMS reverse proxy  https://kivucloud.rw
echo  Keep this window open. Run as Administrator if port 80/443 is refused.
echo.

"C:\Program Files\nodejs\node.exe" "%~dp0kivucloud-proxy.js"
echo.
echo  Proxy stopped.
if /I not "%HMS_SERVICE_MODE%"=="1" pause
