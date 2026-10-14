# Restarts HMS processes if they are not listening.
# Scheduled: at startup and every minute.
$ErrorActionPreference = "Continue"
$Root = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path (Join-Path $Root "scripts\start-frontend.bat"))) {
  $Root = "C:\Users\Administrator\Documents\HMS_HotelERP"
}

$LogDir = Join-Path $Root "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$Log = Join-Path $LogDir "keep-alive.log"

function Write-Log([string]$msg) {
  $line = "{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
  Add-Content -Path $Log -Value $line -ErrorAction SilentlyContinue
}

function Test-Listen([int]$Port) {
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $iar = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne(400)
    $connected = $ok -and $client.Connected
    if ($ok) { $client.EndConnect($iar) }
    $client.Close()
    return $connected
  } catch {
    return $false
  }
}

function Start-Hms([string]$Name, [string]$Bat) {
  $batPath = Join-Path $Root "scripts\$Bat"
  if (-not (Test-Path $batPath)) {
    Write-Log "MISSING $batPath"
    return
  }
  Write-Log "START $Name"
  Start-Process -FilePath "cmd.exe" -ArgumentList @("/c", "set HMS_SERVICE_MODE=1&& `"$batPath`"") -WorkingDirectory $Root -WindowStyle Minimized | Out-Null
}

$building = Test-Path (Join-Path $Root "logs\frontend-building.lock")
$hasFrontendBuild = Test-Path (Join-Path $Root "frontend\.next\BUILD_ID")

function Test-ProcessName([string]$Name) {
  return [bool](Get-Process -Name $Name -ErrorAction SilentlyContinue)
}

if ($building) {
  Write-Log "SKIP start (frontend build in progress)"
} else {
  if (-not (Test-Listen 8080)) {
    if (Test-ProcessName "java") {
      Write-Log "WAIT backend (java running, 8080 not ready)"
    } else {
      Start-Hms "backend" "start-backend.bat"
    }
  }
  if (-not (Test-Listen 3000)) {
    if ($hasFrontendBuild) {
      Start-Hms "frontend" "start-frontend.bat"
    } else {
      Write-Log "SKIP frontend (no production build)"
    }
  }
}
if (-not (Test-Listen 80)) { Start-Hms "proxy" "start-proxy.bat" }
# Do not start the USB print agent on this VPS. It belongs on the cashier PC.
