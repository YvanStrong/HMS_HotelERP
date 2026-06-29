@echo off
cd /d "%~dp0"
echo.
echo   HMS Backend -^> http://localhost:8080
echo   Use: mvn spring-boot:run  (NOT spring:boot-run)
echo.
mvn spring-boot:run
