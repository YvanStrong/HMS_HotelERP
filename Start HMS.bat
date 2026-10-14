@echo off
title HMS Launcher
cd /d "%~dp0"

echo.
echo  Starting HMS backend, frontend, and domain proxy...
echo  Three windows will open. Leave them running.
echo    Website: https://kivucloud.rw
echo    Frontend: http://127.0.0.1:3000
echo    Backend:  http://127.0.0.1:8080
echo.

start "HMS Backend" "%~dp0scripts\start-backend.bat"
start "HMS Frontend" "%~dp0scripts\start-frontend.bat"
start "HMS Proxy" "%~dp0scripts\start-proxy.bat"
start "HMS Printer" "%~dp0scripts\start-epson-print-agent.bat"

timeout /t 3 /nobreak >nul
exit /b 0
