@echo off
REM Register keep-alive so kivucloud.rw survives crashes and reboots.
set "PS1=%~dp0hms-keep-alive.ps1"
set "TR=powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"%PS1%\""

schtasks /Create /TN "HMS Keep Alive" /TR "%TR%" /SC MINUTE /MO 5 /RL HIGHEST /F
if errorlevel 1 (
  echo Failed to create minute keep-alive task.
  exit /b 1
)

schtasks /Create /TN "HMS Start at Boot" /TR "%TR%" /SC ONSTART /DELAY 0001:00 /RL HIGHEST /F
if errorlevel 1 (
  echo Minute task created. Boot task failed — run this file as Administrator.
  exit /b 1
)

echo HMS keep-alive registered:
echo   - every 5 minutes
echo   - at Windows startup
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1%"
echo Keep-alive ran once.
