"""Lanceur SchoolPro — sert l'API Django + l'application React sur un seul port.

Utilisé comme point d'entrée de l'exécutable (SchoolPro.exe). Au démarrage :
  1. prépare un dossier de données inscriptible à côté de l'exécutable ;
  2. applique les migrations (crée la base au premier lancement) ;
  3. démarre un serveur WSGI de production (waitress) sur le port 5006 ;
  4. ouvre le navigateur sur l'application.

Les postes clients du réseau local accèdent via http://IP-DU-SERVEUR:5006
"""
import os
import sys
import threading
import time
import webbrowser


def _base_dir():
    """Dossier de l'exécutable (gelé) ou du script (dev)."""
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


def _resource(rel):
    """Chemin d'une ressource embarquée (PyInstaller _MEIPASS) ou locale."""
    base = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, rel)


def _ensure_first_admin():
    """Crée un administrateur par défaut au tout premier lancement (base vierge).

    Sans cela, une installation neuve n'a AUCUN compte et aucune connexion n'est
    possible (l'inscription se fait uniquement par invitation d'un compte
    existant). Ne s'exécute que si aucun utilisateur n'existe encore.
    Identifiants surchargeables via SCHOOLPRO_ADMIN_USER / SCHOOLPRO_ADMIN_PASSWORD.
    """
    from django.contrib.auth import get_user_model
    User = get_user_model()
    if User.objects.exists():
        return
    username = os.environ.get('SCHOOLPRO_ADMIN_USER', 'admin')
    password = os.environ.get('SCHOOLPRO_ADMIN_PASSWORD', 'admin123')
    User.objects.create_superuser(
        username=username, email='', password=password,
        first_name='Administrateur', last_name='SchoolPro', role='ADMIN',
    )
    print('=' * 56)
    print('  Premier lancement : compte administrateur cree.')
    print(f'    Identifiant  : {username}')
    print(f'    Mot de passe : {password}')
    print('    -> A modifier apres connexion (menu "Mon profil").')
    print('=' * 56)


def main():
    data_dir = os.path.join(_base_dir(), 'SchoolPro_data')
    os.makedirs(data_dir, exist_ok=True)

    # Exe en mode fenêtré (sans console) : sys.stdout/stderr valent None, donc
    # tout print() lèverait une exception → on redirige la sortie vers un fichier
    # log dans le dossier de données (y compris les identifiants du 1er admin).
    # En mode console/dev : on force juste l'UTF-8 (console Windows = cp1252).
    if sys.stdout is None or sys.stderr is None:
        _logf = open(
            os.path.join(data_dir, 'schoolpro.log'),
            'a', encoding='utf-8', errors='replace', buffering=1,
        )
        sys.stdout = _logf
        sys.stderr = _logf
    else:
        for _stream in (sys.stdout, sys.stderr):
            try:
                _stream.reconfigure(encoding='utf-8', errors='replace')
            except Exception:
                pass

    # ── Configuration via environnement (avant django.setup) ──
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    os.environ.setdefault('DJANGO_DEBUG', 'False')
    os.environ.setdefault('DJANGO_ALLOWED_HOSTS', '*')
    os.environ['DB_SQLITE_PATH'] = os.path.join(data_dir, 'db.sqlite3')
    os.environ['MEDIA_ROOT_OVERRIDE'] = os.path.join(data_dir, 'media')
    os.environ['STATIC_ROOT_OVERRIDE'] = os.path.join(data_dir, 'staticfiles')
    # Build React embarqué dans l'exécutable
    build_dir = _resource('frontend_build')
    if os.path.isdir(build_dir):
        os.environ['FRONTEND_BUILD_DIR'] = build_dir

    port = int(os.environ.get('PORT', '5006'))

    import django
    django.setup()
    from django.core.management import call_command

    print('SchoolPro — initialisation de la base de données…')
    call_command('migrate', interactive=False, verbosity=0)
    try:
        call_command('collectstatic', interactive=False, verbosity=0)
    except Exception as exc:  # non bloquant (statique admin uniquement)
        print(f'  (collectstatic ignoré : {exc})')

    _ensure_first_admin()

    from config.wsgi import application

    print('=' * 56)
    print(f'  SchoolPro est démarré.')
    print(f'  Sur ce poste     : http://localhost:{port}')
    print(f'  Postes du réseau : http://IP-DU-SERVEUR:{port}')
    print(f'  Données          : {data_dir}')
    print('  Fermer la fenêtre = réduire dans la barre système (serveur actif).')
    print('  Arrêt total : icône SchoolPro (barre système) → Quitter.')
    print('=' * 56)

    _serve_with_window(application, port, data_dir)


def _open_browser(url):
    try:
        webbrowser.open(url)
    except Exception:
        pass


def _make_tray(on_open, on_quit):
    """Construit l'icône de la barre système (menu Ouvrir / Quitter).

    Retourne l'objet pystray.Icon, ou None si pystray/Pillow indisponible.
    """
    try:
        import pystray
        from PIL import Image
    except Exception as exc:
        print(f'  (barre système indisponible : {exc})')
        return None
    try:
        ico = _resource('schoolpro.ico')
        image = Image.open(ico) if os.path.isfile(ico) else Image.new('RGBA', (64, 64), (37, 99, 235, 255))
    except Exception:
        image = Image.new('RGBA', (64, 64), (37, 99, 235, 255))
    menu = pystray.Menu(
        pystray.MenuItem('Ouvrir SchoolPro', lambda icon, item: on_open(), default=True),
        pystray.MenuItem('Quitter', lambda icon, item: on_quit()),
    )
    return pystray.Icon('SchoolPro', image, 'SchoolPro — serveur en cours', menu)


def _serve_with_window(application, port, data_dir):
    """Démarre Waitress (thread de fond) puis affiche l'application dans une
    fenêtre native (pywebview). Fermer la fenêtre la réduit dans la barre système
    — le serveur continue de répondre aux postes clients du réseau. « Quitter »
    (menu de l'icône) arrête réellement tout.

    Repli si pywebview est indisponible : ouverture dans le navigateur + icône
    barre système (ou, à défaut, process maintenu en vie).
    """
    from waitress import serve
    threading.Thread(
        target=lambda: serve(application, host='0.0.0.0', port=port, threads=8),
        daemon=True,
    ).start()

    url = f'http://localhost:{port}'

    try:
        import webview
    except Exception as exc:
        # ── Repli : navigateur + tray ──
        print(f'  (fenêtre native indisponible : {exc}) — ouverture navigateur.')
        _open_browser(url)
        tray = _make_tray(on_open=lambda: _open_browser(url), on_quit=lambda: os._exit(0))
        if tray is not None:
            tray.run()                     # bloque jusqu'à « Quitter »
        else:
            while True:                    # ni fenêtre ni tray : garder vivant
                time.sleep(3600)
        return

    # ── Fenêtre native ──
    window = webview.create_window(
        'SchoolPro', url, width=1280, height=820, min_size=(1024, 680),
    )

    tray = _make_tray(on_open=lambda: window.show(), on_quit=lambda: os._exit(0))
    if tray is not None:
        tray.run_detached()               # icône dans un thread séparé

    def _on_closing():
        # Fermer la fenêtre = réduire dans le tray (le serveur reste actif).
        if tray is not None:
            window.hide()
            return False                   # annule la fermeture réelle
        return True                        # sans tray : fermer quitte réellement
    window.events.closing += _on_closing

    storage = os.path.join(data_dir, 'webview')
    os.makedirs(storage, exist_ok=True)
    print('  Fenêtre SchoolPro ouverte.')
    webview.start(storage_path=storage)    # boucle GUI (thread principal)

    # Atteint uniquement si la fenêtre s'est réellement fermée (sans tray).
    os._exit(0)


if __name__ == '__main__':
    main()
