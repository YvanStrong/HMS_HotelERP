@echo off
title Renew kivucloud.rw TLS
cd /d "%~dp0.."

echo Renewing Let's Encrypt certificate for kivucloud.rw ...
"C:\Users\Administrator\tools\lego\lego.exe" renew --email admin@kivucloud.rw --http --http.webroot "%cd%\certs\acme-www" --domains kivucloud.rw --path "%cd%\certs\lego"
if errorlevel 1 (
  echo Renewal failed.
  pause
  exit /b 1
)

copy /Y "%cd%\certs\lego\certificates\kivucloud.rw.key" "%cd%\certs\privkey.pem" >nul
copy /Y "%cd%\certs\lego\certificates\kivucloud.rw.crt" "%cd%\certs\fullchain.pem" >nul
echo Certificate files updated. Restart the HMS Proxy window so HTTPS picks up the new cert.
pause
