@echo off
REM ============================================================
REM  Desactive le demarrage automatique de SchoolPro.
REM  Clic droit -> Executer en tant qu'administrateur.
REM ============================================================
setlocal

net session >nul 2>&1
if errorlevel 1 (
  echo   Executer EN TANT QU'ADMINISTRATEUR.
  pause
  exit /b 1
)

schtasks /End /TN "SchoolPro" >nul 2>&1
schtasks /Delete /TN "SchoolPro" /F
if errorlevel 1 (
  echo   La tache "SchoolPro" n'existait pas ou n'a pas pu etre supprimee.
) else (
  echo   Demarrage automatique DESACTIVE.
)
pause
endlocal
