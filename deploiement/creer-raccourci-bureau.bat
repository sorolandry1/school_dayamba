@echo off
REM ============================================================
REM  Cree un raccourci "SchoolPro" sur le Bureau (avec l'icone).
REM  Placez ce script dans le meme dossier que SchoolPro.exe.
REM ============================================================
setlocal
set "TARGET=%~dp0SchoolPro.exe"
if not exist "%TARGET%" (
  echo   SchoolPro.exe introuvable dans ce dossier.
  echo   Copiez SchoolPro.exe a cote de ce script, puis relancez.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws=New-Object -ComObject WScript.Shell; $p=Join-Path ([Environment]::GetFolderPath('Desktop')) 'SchoolPro.lnk'; $s=$ws.CreateShortcut($p); $s.TargetPath=$env:TARGET; $s.WorkingDirectory=(Split-Path $env:TARGET); $s.IconLocation=($env:TARGET + ',0'); $s.Description='SchoolPro - Gestion Scolaire'; $s.Save()"
if errorlevel 1 ( echo   Echec de la creation du raccourci. & pause & exit /b 1 )
echo   Raccourci "SchoolPro" cree sur le Bureau.
pause
endlocal
