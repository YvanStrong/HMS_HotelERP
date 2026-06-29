# HMS backend — use this instead of: mvn spring:boot-run (wrong)
Set-Location $PSScriptRoot
Write-Host ""
Write-Host "  HMS Backend -> http://localhost:8080" -ForegroundColor Cyan
Write-Host "  Command: mvn spring-boot:run" -ForegroundColor DarkGray
Write-Host ""
mvn spring-boot:run
