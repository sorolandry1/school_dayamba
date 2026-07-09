# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller — empaquette SchoolPro (API Django + build React) en un seul .exe.

Build :
    cd frontend && npm run build
    cd ../backend && pyinstaller SchoolPro.spec
Résultat : backend/dist/SchoolPro.exe
"""
import os
from PyInstaller.utils.hooks import collect_submodules, collect_all

datas = []
binaries = []
hiddenimports = []

# ── Application React (build) embarquée ──
build_dir = os.path.join(os.getcwd(), '..', 'frontend', 'build')
if os.path.isdir(build_dir):
    datas.append((build_dir, 'frontend_build'))
else:
    raise SystemExit("frontend/build introuvable : lancez d'abord `npm run build` dans frontend/.")

# ── Sous-modules chargés dynamiquement (apps Django, migrations, etc.) ──
for pkg in [
    'apps', 'config', 'utils',
    'django', 'rest_framework', 'rest_framework_simplejwt', 'corsheaders',
    'django_filters', 'whitenoise', 'waitress', 'qrcode',
]:
    hiddenimports += collect_submodules(pkg)

# ── Paquets avec fichiers de données / binaires (polices, etc.) ──
for pkg in ['reportlab', 'openpyxl', 'cryptography', 'PIL']:
    d, b, h = collect_all(pkg)
    datas += d
    binaries += b
    hiddenimports += h


a = Analysis(
    ['run_schoolpro.py'],
    pathex=[os.getcwd()],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=['locust', 'tkinter'],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='SchoolPro',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,          # fenêtre console = état du serveur ; fermer = arrêter
    disable_windowed_traceback=False,
    icon='schoolpro.ico',
)
