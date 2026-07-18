# CHANGELOG_BUILD — Packaging SchoolPro.exe

Journal des corrections apportées durant le processus de build de l'exécutable
(une ligne par correction : fichier touché + raison).

## 2026-07-10 — Session de build automatisée

### Packaging PyInstaller
- (diagnostic) `dist/SchoolPro.exe` existant testé : crash au démarrage —
  `ModuleNotFoundError: No module named 'config.middleware'` → exe **périmé**,
  construit avant que le `.spec` n'inclue le package `config` dans
  `collect_submodules`. Aucune modification du `.spec` nécessaire (le `.spec`
  courant collecte bien `config.middleware`, vérifié).
- `backend/SchoolPro.spec` : rebuild propre (`pyinstaller --noconfirm --clean`)
  avec le spec existant → exe régénéré et fonctionnel (health 200, index React
  servi, assets JS 200, endpoint API joignable).

### Corrections métier
- `backend/apps/reports/views.py` : ajout du helper `_normalized_avg_expr()` +
  `_compute_rankings_map()`. Le classement et la moyenne générale utilisent
  désormais **normalized_value** (`value * 20 / max_value`) au lieu d'`Avg('value')`
  brut — une note /10 ou /100 est ramenée sur /20 avant moyenne.
- `backend/apps/reports/views.py` : `_calculate_rankings()` et
  `_calculate_all_rankings()` réécrits pour appeler `_compute_rankings_map()` —
  suppression du **N+1** (double boucle élève×matière avec une requête par
  couple → **1 seule requête agrégée** ; vérifié : 1 requête pour 5/20/60 élèves).
- `backend/utils/pdf_generator.py` : ajout du helper `_subject_normalized_avg()`
  ; les moyennes par matière du bulletin (générateur simple et templaté)
  utilisent la valeur normalisée au lieu d'`Avg('value')` brut.

### Correction packaging (service des médias en mode exe)
- `backend/config/urls.py` : `django.conf.urls.static.static()` est un **no-op
  quand DEBUG=False** — dans l'exe distribué, les URLs `/media/...` (photos
  élèves, QR codes, logos d'école) tombaient dans le catch-all SPA et renvoyaient
  `index.html` (200 text/html) au lieu de l'image. Remplacé par une route
  explicite vers `django.views.static.serve` (active en mode empaqueté), qui sert
  réellement les fichiers et renvoie 404 pour un fichier absent.

### Validation
- `python manage.py check` : 0 problème.
- Test numérique (transaction annulée) : moyenne normalisée = 15.0 pour
  {10/20, 40/40} (au lieu de 25 en brut) ; classement et rangs corrects ;
  classement calculé en **1 requête SQL** pour 5/20/60 élèves (N+1 éliminé).
- Exe final relancé et validé de bout en bout :
  - `/api/health/` → 200 (database ok)
  - `/` → 200 text/html, titre « SchoolPro - Gestion Scolaire »
  - `/static/js/main.*.js` → 200 application/javascript (1,59 Mo)
  - `/dashboard` (route SPA) → 200 (fallback index.html)
  - `/api/auth/login/` → 400 (endpoint joignable)
  - `/media/<fichier réel>` → 200 image/png ; `/media/<absent>` → 404
- Livrable : `backend/dist/SchoolPro.exe` (~44 Mo), démarrage ~2 s.

## 2026-07-10 — Correctifs « connexion » (installation neuve)

Diagnostic : sur une installation neuve, aucune connexion n'était possible
(deux blocages) + un crash au démarrage introduit par le bootstrap.

- `frontend/src/services/api.js` : le front buildé déduisait l'URL de l'API sur
  le port **8000** (`http://IP:8000/api`), alors que l'exe sert API + front sur
  le **même port 5006** → tous les appels API (dont le login) échouaient.
  Corrigé : l'URL de l'API pointe désormais sur la **même origine** que la page
  (5006 en mode exe) ; `npm start` (port 3000) continue de viser 8000 ; override
  possible via `REACT_APP_API_URL` / `REACT_APP_API_PORT`. → rebuild React
  (nouveau bundle `main.26288f1b.js`).
- `backend/run_schoolpro.py` : ajout de `_ensure_first_admin()` — au tout premier
  lancement (base vierge, 0 utilisateur), création d'un administrateur par défaut
  `admin` / `admin123` (rôle ADMIN), surchargeable via `SCHOOLPRO_ADMIN_USER` /
  `SCHOOLPRO_ADMIN_PASSWORD`. Sans cela, une install neuve n'avait aucun compte
  (inscription uniquement par invitation).
- `backend/run_schoolpro.py` : `sys.stdout/stderr.reconfigure(utf-8, replace)` en
  début de `main()` — la console Windows (cp1252) ne pouvait pas encoder certains
  caractères (`→`) et levait `UnicodeEncodeError`, faisant crasher l'exe au
  premier lancement APRÈS création de l'admin. Message du bootstrap rendu ASCII.

### Validation connexion (exe reconstruit, install neuve simulée)
- 1er lancement : admin créé automatiquement (`[('admin','ADMIN',1)]` en base),
  serveur démarré (health 200), plus de crash d'encodage.
- `POST /api/auth/login/` sur **:5006** avec `admin` / `admin123` → **HTTP 200**,
  tokens access + refresh reçus, user `admin` rôle `ADMIN`.
- Bundle React servi = nouveau hash `main.26288f1b.js` (fix API embarqué).
- Port 8000 : plus utilisé par le front (tout passe par 5006).

## 2026-07-10 — Suppression de la fenêtre console au lancement

- `backend/SchoolPro.spec` : `console=True` → `console=False`. L'exe ne montre
  plus de fenêtre console noire au démarrage (sous-système PE passé de 3=Console
  à **2=GUI**, vérifié).
- `backend/run_schoolpro.py` : en mode fenêtré, `sys.stdout`/`stderr` valent
  `None` → tout `print()` planterait. Ajout d'une redirection de la sortie vers
  `SchoolPro_data/schoolpro.log` (buffering ligne, UTF-8) quand aucune console
  n'est disponible ; sinon UTF-8 sur la console (dev). Les identifiants du
  premier admin sont donc consignés dans ce fichier log.
- `backend/run_schoolpro.py` : message d'arrêt adapté (plus de fenêtre à fermer)
  → « Pour arrêter le serveur : Gestionnaire des tâches → SchoolPro.exe ».

### Validation (exe fenêtré, install neuve)
- Sous-système PE = **2 (GUI)** : aucune fenêtre console.
- Démarrage en ~4 s sans crash (redirection stdout OK), health 200.
- `POST /api/auth/login/` (admin/admin123) sur :5006 → **HTTP 200** + tokens.
- `SchoolPro_data/schoolpro.log` écrit correctement (accents OK, identifiants du
  1er admin consignés).
- Livrable : `backend/dist/SchoolPro.exe` (~44 Mo), lancement silencieux.

## 2026-07-10 — Icône barre système (arrêt propre du serveur)

Sans console, il n'y avait plus de moyen simple d'arrêter le serveur. Ajout d'une
icône dans la barre système (system tray) avec menu Ouvrir / Quitter.

- `backend/requirements.txt` : ajout de `pystray==0.19.5`.
- `backend/run_schoolpro.py` : nouvelle fonction `_serve_with_tray()` — Waitress
  tourne désormais dans un thread démon, et une icône `pystray` occupe le thread
  principal (boucle de messages Windows). Menu : « Ouvrir SchoolPro » (rouvre le
  navigateur) et « Quitter » (`icon.stop()` + `os._exit(0)` → arrêt immédiat du
  process et du thread serveur). Repli automatique en mode bloquant si pystray
  est indisponible.
- `backend/SchoolPro.spec` : `schoolpro.ico` embarqué dans le bundle (`datas`)
  pour servir d'icône au tray ; `pystray` ajouté aux `collect_submodules`
  (sélection dynamique du backend `_win32`).

### Validation (exe fenêtré + tray, install neuve)
- Sous-système PE = **2 (GUI)** : aucune fenêtre console.
- Démarrage ~2 s, health 200, `login` (admin/admin123) → **HTTP 200**.
- Log : « Barre système : icône SchoolPro active » → chemin tray effectif (pas
  le repli), process maintenu en vie par la boucle de l'icône.
- Arrêt (équivalent « Quitter » → `os._exit`) : plus aucun process SchoolPro,
  port 5006 libéré.
- NB : le clic sur le menu tray n'est pas testable en environnement headless ;
  l'icône est prouvée active et « Quitter » repose sur `os._exit(0)` (arrêt
  inconditionnel de tous les threads).
- Livrable : `backend/dist/SchoolPro.exe` (~44 Mo).

## 2026-07-11 — Fenêtre applicative native (au lieu du navigateur)

Sur le poste serveur, l'app s'ouvre désormais dans sa propre fenêtre (look
logiciel, sans barre d'adresse) au lieu du navigateur. Les postes clients du LAN
continuent d'accéder via navigateur sur `http://IP-SERVEUR:5006`.

- `backend/requirements.txt` : ajout de `pywebview==6.2.1` et `pythonnet==3.1.0`.
- `backend/run_schoolpro.py` : `_serve_with_window()` — Waitress en thread de
  fond ; l'app est affichée dans une fenêtre native pywebview (WebView2). Fermer
  la fenêtre la **réduit dans la barre système** (`window.hide()`, le serveur
  reste actif pour les postes clients) ; l'icône tray « Ouvrir » la ré-affiche,
  « Quitter » arrête tout. Repli automatique vers navigateur + tray si pywebview
  indisponible. L'ouverture navigateur automatique au démarrage a été retirée.
  Dossier de données WebView2 stocké dans `SchoolPro_data/webview`.
- `backend/SchoolPro.spec` : `collect_all` pour `webview`, `pythonnet`,
  `clr_loader`, `bottle`, `proxy_tools` + hiddenimports `clr`,
  `webview.platforms.winforms` (backend WinForms/WebView2 chargé dynamiquement).

### Correction bug préexistant (révélé par le chargement de l'app)
- `backend/apps/reports/serializers.py` : `PlatformSettingsSerializer` et
  `DocumentTemplateSerializer` déclaraient `source='ecole_id'` sur un champ déjà
  nommé `ecole_id` → DRF lève `AssertionError` (« redundant source ») et
  `/api/reports/platform-settings/` renvoyait **500 à chaque appel** (navigateur
  compris). `source` redondant retiré.

### Validation (exe fenêtré + fenêtre native, install neuve)
- Sous-système PE = **2 (GUI)** ; exe ~47 Mo (pythonnet/WebView2 inclus).
- Log : « Fenêtre SchoolPro ouverte. » sans message de repli → chemin fenêtre
  native effectif (pythonnet/WebView2 initialisés dans l'exe gelé).
- Démarrage OK, `login` (admin/admin123) → HTTP 200.
- `/api/reports/platform-settings/` : **500 → 200** ; **0 traceback** dans le log.
- Fermeture = réduction tray (serveur maintenu) ; « Quitter » → `os._exit(0)`.
- NB : le rendu visuel de la fenêtre et le clic sur le menu tray ne sont pas
  testables en environnement headless ; le chemin natif est prouvé actif et le
  serveur reste joignable.
- Livrable : `backend/dist/SchoolPro.exe` (~47 Mo).
