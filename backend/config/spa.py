"""Service de l'application React (build) par Django, pour un déploiement en un
seul port / un seul exécutable.

Sert les fichiers statiques du build (JS/CSS/images, favicon, manifest…) et
renvoie `index.html` pour toutes les routes côté client (SPA fallback).
"""
import mimetypes
import os

from django.conf import settings
from django.http import FileResponse, HttpResponseNotFound


def _build_dir():
    return settings.FRONTEND_BUILD_DIR or ''


def spa_serve(request, path=''):
    build = _build_dir()
    if not build or not os.path.isdir(build):
        return HttpResponseNotFound(
            "Interface non empaquetée (FRONTEND_BUILD_DIR absent). "
            "En développement, lancez le frontend séparément (npm start)."
        )

    build_abs = os.path.normpath(build)
    # Fichier réel demandé (asset du build) → on le sert directement.
    if path:
        full = os.path.normpath(os.path.join(build_abs, path))
        # Anti path-traversal : rester dans le dossier build.
        if full.startswith(build_abs) and os.path.isfile(full):
            ctype = mimetypes.guess_type(full)[0] or 'application/octet-stream'
            return FileResponse(open(full, 'rb'), content_type=ctype)

    # Sinon (route SPA) → index.html
    index = os.path.join(build_abs, 'index.html')
    if os.path.isfile(index):
        return FileResponse(open(index, 'rb'), content_type='text/html')
    return HttpResponseNotFound('index.html introuvable dans le build.')
