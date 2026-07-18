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

# ── Icône embarquée (utilisée par l'icône de la barre système / tray) ──
_ico = os.path.join(os.getcwd(), 'schoolpro.ico')
if os.path.isfile(_ico):
    datas.append((_ico, '.'))

# ── Sous-modules chargés dynamiquement (apps Django, migrations, etc.) ──
for pkg in [
    'apps', 'config', 'utils',
    'django', 'rest_framework', 'rest_framework_simplejwt', 'corsheaders',
    'django_filters', 'whitenoise', 'waitress', 'qrcode',
    # Barre système : pystray sélectionne son backend (_win32) dynamiquement.
    'pystray',
]:
    hiddenimports += collect_submodules(pkg)

# ── Paquets avec fichiers de données / binaires (polices, etc.) ──
#   webview/pythonnet/clr_loader/bottle : fenêtre native (pywebview + WebView2).
for pkg in ['reportlab', 'openpyxl', 'cryptography', 'PIL',
            'webview', 'pythonnet', 'clr_loader', 'bottle', 'proxy_tools']:
    d, b, h = collect_all(pkg)
    datas += d
    binaries += b
    hiddenimports += h

# pywebview charge son backend Windows (WinForms/WebView2) et clr dynamiquement.
hiddenimports += [
    'clr', 'webview.platforms.winforms', 'bottle', 'proxy_tools',
]


a = Analysis(
    ['run_schoolpro.py'],
    pathex=[os.getcwd()],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=[
        'locust', 'tkinter',
        # GeoDjango non utilisé : évite l'échec de collecte GDAL et les
        # backends spatiaux (postgis / mysql / oracle) inutiles.
        'django.contrib.gis',
    ],
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
    console=False,         # pas de fenêtre console noire ; sortie redirigée vers
                           # SchoolPro_data/schoolpro.log (voir run_schoolpro.py)
    disable_windowed_traceback=False,
    icon='schoolpro.ico',
)
