@echo off
title HMS Backend
cd /d "%~dp0..\backend"

if exist "C:\Program Files\Java\jdk-25\bin\java.exe" (
  set "JAVA_HOME=C:\Program Files\Java\jdk-25"
)
if defined JAVA_HOME set "PATH=%JAVA_HOME%\bin;%PATH%"

set "JAR=%cd%\target\hms-backend-0.1.0-SNAPSHOT.jar"
if not exist "%JAR%" (
  echo Backend JAR not found: %JAR%
  if /I not "%HMS_SERVICE_MODE%"=="1" pause
  exit /b 1
)

set "HMS_CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://10.10.147.68:3000,http://10.10.147.68,http://kivucloud.rw,http://kivucloud.rw:3000,http://www.kivucloud.rw,http://www.kivucloud.rw:3000,https://kivucloud.rw,https://www.kivucloud.rw"
set "HMS_FRONTEND_BASE_URL=https://kivucloud.rw"
set "HMS_PUBLIC_BASE_URL=https://kivucloud.rw"
set "HMS_EMAIL_ENABLED=true"
set "HMS_MAIL_HOST=smtp.gmail.com"
set "HMS_MAIL_PORT=587"
if not defined HMS_MAIL_USERNAME set "HMS_MAIL_USERNAME="
if not defined HMS_MAIL_FROM set "HMS_MAIL_FROM="
if not defined HMS_ZREPORT_BOSS_EMAIL set "HMS_ZREPORT_BOSS_EMAIL="

echo.
echo  HMS Backend on :8080
echo  Keep this window open.
echo.

java -Xms64m -Xmx256m -XX:+UseSerialGC -XX:MaxMetaspaceSize=96m -jar "%JAR%" --hms.provisioning.poll-ms=120000 --hms.ebm.outbox-poll-ms=120000 --hms.ebm.sync-poll-ms=900000 --hms.notifications.email.dispatch-delay-ms=300000 --spring.servlet.multipart.max-file-size=8MB --spring.servlet.multipart.max-request-size=8MB --server.tomcat.max-http-form-post-size=10MB --server.tomcat.max-swallow-size=10485760
echo.
echo  Backend stopped.
if /I not "%HMS_SERVICE_MODE%"=="1" pause
