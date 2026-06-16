# Build an APK for HMS Waiter (Windows).
# Usage:
#   .\scripts\build-apk.ps1           # release APK (slow first time)
#   .\scripts\build-apk.ps1 -Debug    # debug APK (faster; JS bundle embedded for standalone install)
#   .\scripts\build-apk.ps1 -Cloud    # EAS cloud build (recommended - does not use your PC)

param(
  [switch]$Debug,
  [switch]$Cloud
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path "$root/package.json")) {
  Write-Error "Run from mobile-pos (package.json not found in $root)"
}

Set-Location $root

if ($Cloud) {
  Write-Host "Starting EAS cloud build (APK). Your PC is not compiling native code." -ForegroundColor Cyan
  Write-Host "First time: run 'npm install -g eas-cli' and 'eas login' and 'eas init'" -ForegroundColor Yellow
  if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
      if ($_ -match '^\s*([^#=]+)=(.*)$') {
        Set-Item -Path "env:$($matches[1].Trim())" -Value $matches[2].Trim()
      }
    }
  }
  & eas build --platform android --profile preview --non-interactive
  exit $LASTEXITCODE
}

$jdk17 = "C:\Program Files\Java\jdk-17"
if (Test-Path $jdk17) { $env:JAVA_HOME = $jdk17 }
elseif (-not $env:JAVA_HOME -or -not (Test-Path "$env:JAVA_HOME\bin\java.exe")) {
  Write-Error "Install JDK 17. Example: C:\Program Files\Java\jdk-17"
}

$sdk = "$env:LOCALAPPDATA\Android\Sdk"
if (-not (Test-Path $sdk)) {
  Write-Error "Android SDK not found. Install Android Studio."
}

$localProps = Join-Path $root "android\local.properties"
$sdkEscaped = $sdk -replace "\\", "\\\\"
Set-Content -Path $localProps -Value "sdk.dir=$sdkEscaped" -Encoding ascii

if (Test-Path ".env") {
  Get-Content ".env" | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
      Set-Item -Path "env:$($matches[1].Trim())" -Value $matches[2].Trim()
    }
  }
}

$env:NODE_ENV = "production"
$task = if ($Debug) { "assembleDebug" } else { "assembleRelease" }
$variant = if ($Debug) { "debug" } else { "release" }

# Short Gradle home avoids Windows MAX_PATH (260) failures in RN CMake/prefab builds.
# Cursor sandbox can redirect caches into a very long Temp path.
if ($env:GRADLE_USER_HOME -match "cursor-sandbox-cache") {
  Remove-Item Env:GRADLE_USER_HOME -ErrorAction SilentlyContinue
}
$gradleHome = "C:\gradle"
New-Item -ItemType Directory -Force -Path $gradleHome | Out-Null
$env:GRADLE_USER_HOME = $gradleHome

Write-Host "JAVA_HOME=$env:JAVA_HOME"
Write-Host "GRADLE_USER_HOME=$env:GRADLE_USER_HOME"
Write-Host "API=$env:EXPO_PUBLIC_API_URL"
Write-Host "Task=$task (arm64-v8a only). Rebuild after code changes - no Metro needed on device." -ForegroundColor Yellow

if (-not (Test-Path (Join-Path $root "android/gradlew.bat"))) {
  Write-Host "Running expo prebuild..."
  & npx expo prebuild --platform android
}

Set-Location (Join-Path $root "android")
& .\gradlew.bat $task -PreactNativeArchitectures=arm64-v8a
$gradleExit = $LASTEXITCODE
if ($gradleExit -ne 0) {
  Write-Error "Gradle build failed (exit $gradleExit). See errors above."
}

$apk = Join-Path $root "android\app\build\outputs\apk\$variant\app-$variant.apk"
if (-not (Test-Path $apk)) {
  Write-Error "APK not found after successful Gradle run."
}

Write-Host ""
Write-Host "SUCCESS: $apk" -ForegroundColor Green
