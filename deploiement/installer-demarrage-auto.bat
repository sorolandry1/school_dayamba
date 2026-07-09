@echo off
REM ============================================================
REM  Active le demarrage automatique de SchoolPro au boot de Windows
REM  (tache planifiee "SchoolPro", compte SYSTEM, sans mot de passe).
REM  Placez ce script DANS LE MEME DOSSIER que SchoolPro.exe.
REM  Clic droit -> Executer en tant qu'administrateur.
REM ============================================================
setlocal

net session >nul 2>&1
if errorlevel 1 (
  echo.
  echo   Ce script doit etre execute EN TANT QU'ADMINISTRATEUR.
  echo   Clic droit sur le fichier  ^>  Executer en tant qu'administrateur.
  echo.
  pause
  exit /b 1
)

if not exist "%~dp0SchoolPro.exe" (
  echo.
  echo   SchoolPro.exe est introuvable dans ce dossier :
  echo   %~dp0
  echo   Copiez SchoolPro.exe a cote de ce script, puis relancez.
  echo.
  pause
  exit /b 1
)

schtasks /Create /TN "SchoolPro" /TR "\"%~dp0SchoolPro.exe\"" /SC ONSTART /RU SYSTEM /RL HIGHEST /F
if errorlevel 1 (
  echo   Echec de la creation de la tache planifiee.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo   Demarrage automatique ACTIVE.
echo   SchoolPro se lancera a chaque demarrage de Windows.
echo.
echo   Acces sur ce poste  : http://localhost:5006
echo   Acces sur le reseau : http://IP-DU-SERVEUR:5006
echo.
echo   Demarrer maintenant sans redemarrer :
echo       schtasks /Run /TN "SchoolPro"
echo ============================================================
echo.
echo   (Si vous deplacez SchoolPro.exe, relancez ce script.)
pause
endlocal
