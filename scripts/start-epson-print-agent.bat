@echo off
title HMS Xprinter Agent
cd /d "%~dp0"

if exist "C:\Program Files\nodejs\node.exe" (
  set "PATH=C:\Program Files\nodejs;%PATH%"
)

echo Xprinter USB print agent on 127.0.0.1:17888
echo Keep this window open on the PC where the Xprinter USB cable is plugged in.

"C:\Program Files\nodejs\node.exe" "%~dp0epson-print-agent.js"
echo.
echo  Print agent stopped.
if /I not "%HMS_SERVICE_MODE%"=="1" pause
