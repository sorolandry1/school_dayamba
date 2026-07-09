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


def main():
    data_dir = os.path.join(_base_dir(), 'SchoolPro_data')
    os.makedirs(data_dir, exist_ok=True)

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

    # Ouvre le navigateur peu après le démarrage du serveur
    def _open():
        time.sleep(1.8)
        try:
            webbrowser.open(f'http://localhost:{port}')
        except Exception:
            pass
    threading.Thread(target=_open, daemon=True).start()

    from waitress import serve
    from config.wsgi import application

    print('=' * 56)
    print(f'  SchoolPro est démarré.')
    print(f'  Sur ce poste     : http://localhost:{port}')
    print(f'  Postes du réseau : http://IP-DU-SERVEUR:{port}')
    print(f'  Données          : {data_dir}')
    print('  Fermez cette fenêtre pour arrêter le serveur.')
    print('=' * 56)
    serve(application, host='0.0.0.0', port=port, threads=8)


if __name__ == '__main__':
    main()
