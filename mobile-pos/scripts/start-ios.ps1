# Expo Go on iOS (same Wi-Fi). Skips expo.dev version check when offline.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (Test-Path ".env") {
  Get-Content ".env" | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
      Set-Item -Path "env:$($matches[1].Trim())" -Value $matches[2].Trim()
    }
  }
}

$env:EXPO_NO_DEPENDENCY_VALIDATION = "1"
& npx expo start --lan --go
