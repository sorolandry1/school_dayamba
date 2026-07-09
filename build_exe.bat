@echo off
REM ============================================================
REM  Construit SchoolPro.exe (API Django + interface React)
REM  Resultat : backend\dist\SchoolPro.exe
REM ============================================================
setlocal

echo [1/3] Construction de l'interface (React)...
cd frontend
call npm install
set CI=false
call npm run build
if errorlevel 1 (echo Echec du build frontend & exit /b 1)
cd ..

echo [2/3] Preparation de l'environnement Python...
cd backend
if not exist .venv (python -m venv .venv)
call .venv\Scripts\activate.bat
pip install -r requirements.txt
pip install pyinstaller

echo [3/3] Empaquetage en executable...
pyinstaller --noconfirm SchoolPro.spec
if errorlevel 1 (echo Echec de PyInstaller & exit /b 1)

echo.
echo ============================================================
echo  Termine : backend\dist\SchoolPro.exe
echo  Double-cliquez dessus pour demarrer SchoolPro.
echo ============================================================
endlocal
