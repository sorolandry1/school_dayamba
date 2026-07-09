@echo off
REM ============================================================
REM  Desactive le demarrage a l'ouverture de session.
REM ============================================================
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=Join-Path ([Environment]::GetFolderPath('Startup')) 'SchoolPro.lnk'; if(Test-Path $p){ Remove-Item $p -Force; Write-Host '  Demarrage a l ouverture de session DESACTIVE.' } else { Write-Host '  (Aucun demarrage de session actif.)' }"
pause
endlocal
