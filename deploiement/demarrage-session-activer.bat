@echo off
REM ============================================================
REM  Demarrage a l'OUVERTURE DE SESSION de cet utilisateur.
REM  SchoolPro se lance ET le navigateur s'ouvre automatiquement
REM  a chaque connexion. Aucun droit administrateur requis.
REM  (Alternative a "installer-demarrage-auto.bat" qui, lui,
REM   demarre le serveur des le boot mais sans ouvrir le navigateur.)
REM  Placez ce script dans le meme dossier que SchoolPro.exe.
REM ============================================================
setlocal
set "TARGET=%~dp0SchoolPro.exe"
if not exist "%TARGET%" (
  echo   SchoolPro.exe introuvable dans ce dossier.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws=New-Object -ComObject WScript.Shell; $p=Join-Path ([Environment]::GetFolderPath('Startup')) 'SchoolPro.lnk'; $s=$ws.CreateShortcut($p); $s.TargetPath=$env:TARGET; $s.WorkingDirectory=(Split-Path $env:TARGET); $s.IconLocation=($env:TARGET + ',0'); $s.Description='SchoolPro - Gestion Scolaire'; $s.Save()"
if errorlevel 1 ( echo   Echec. & pause & exit /b 1 )
echo   Demarrage a l'ouverture de session ACTIVE.
echo   SchoolPro s'ouvrira automatiquement a votre prochaine connexion.
pause
endlocal
