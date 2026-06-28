# SchoolPro — Plateforme de Gestion Scolaire

Application web complète de gestion scolaire — Django REST + React + PostgreSQL, dockerisée.

**Responsable :** AMADOU DAYAMBA · **Version :** 3.0

---

## Table des matières

1. [Aperçu fonctionnel](#aperçu-fonctionnel)
2. [Architecture technique](#architecture-technique)
3. [Démarrage rapide (Docker)](#démarrage-rapide-avec-docker)
4. [Installation manuelle](#sans-docker-installation-manuelle)
5. [Structure du projet](#structure-du-projet)
6. [Modules backend](#modules-backend)
7. [Pages frontend par rôle](#pages-frontend-par-rôle)
8. [Notifications (SMS / WhatsApp / Email)](#notifications-sms--whatsapp--email)
9. [Sécurité](#sécurité)
10. [Performance & disponibilité](#performance--disponibilité)
11. [Variables d'environnement](#variables-denvironnement)
12. [Commandes utiles](#commandes-utiles)
13. [Tests de charge](#tests-de-charge)

---

## Aperçu fonctionnel

SchoolPro couvre l'ensemble du cycle de gestion d'un établissement scolaire :

| Domaine | Fonctionnalités |
|---|---|
| Élèves | Inscription, fiche complète, QR code unique, statut paiement |
| Classes | Organisation par niveau, liste enrichie (moyenne, absences, paiement) |
| Matières | Gestion avec coefficient, affectation aux professeurs |
| Notes | CRUD multi-type (devoir, examen, oral), historique des modifications |
| Présences | Scan QR entrée/sortie, horodatage, notification tricanal (SMS + WhatsApp + Email) |
| Paiements | Suivi par élève, statut (payé/en attente/en retard), reçu généré |
| Dépenses | Gestion des charges par catégorie, bilan financier temps réel |
| Bulletins | PDF automatique (ReportLab), rang, moyenne pondérée, appréciation |
| Rapports | Absences, paiements, classements, exports Excel (openpyxl) |
| Communications | Broadcast SMS, WhatsApp et Email aux parents par classe ou établissement |
| Espace enseignant | Tableau de bord, saisie des notes, cahier de texte (LessonLog) |
| Journal d'activité | Audit complet des actions (connexions, modifications de notes, etc.) |

---

## Architecture technique

| Composant | Technologie |
|---|---|
| Backend | Django 5.1 + Django REST Framework 3.15 |
| Frontend | React 18 + React Router v6 |
| Base de données | PostgreSQL 16 (SQLite en dev local) |
| Authentification | JWT — SimpleJWT (access + refresh + rotation + blacklist) |
| SMS | Twilio / Orange API / SMS Gateway local |
| WhatsApp | WhatsApp Business API via Twilio |
| Email | Django Email Backend (SMTP Gmail ou console en dev) |
| QR Code | Bibliothèque Python `qrcode` + scanner mobile (caméra) |
| PDF | ReportLab 4.2 |
| Excel | openpyxl 3.1 |
| Cache | LocMemCache (dev) — Redis-ready via `REDIS_URL` |
| Serveur web | Gunicorn + Nginx (Docker prod) |
| Conteneurisation | Docker + Docker Compose |
| Tests de charge | Locust 2.32 |

---

## Démarrage rapide avec Docker

### Prérequis

- Docker et Docker Compose installés

### Lancer en une seule commande

```bash
docker compose up -d --build
```

Environ 1-2 minutes (build + migrations + seed), puis ouvrir :

| URL | Description |
|---|---|
| http://localhost:3000 | Application React |
| http://localhost:8000/api | API REST Django |
| http://localhost:8000/admin | Interface d'administration Django |
| http://localhost:8000/api/health/ | Health check (DB + version) |

Les données de test (élèves, professeurs, classes, matières, notes) sont **chargées automatiquement** au premier démarrage.

### Comptes prêts à utiliser

| Rôle | Identifiant | Mot de passe | Redirige vers |
|---|---|---|---|
| Directeur | `directeur` | `directeur123` | `/dashboard` |
| Admin | `admin` | `admin123` | `/dashboard` |
| Prof Maths | `prof_math` | `prof123` | `/teacher` |
| Prof Français | `prof_fr` | `prof123` | `/teacher` |
| Prof Anglais | `prof_ang` | `prof123` | `/teacher` |
| Prof SVT | `prof_svt` | `prof123` | `/teacher` |
| Prof Physique | `prof_phys` | `prof123` | `/teacher` |
| Prof Histoire | `prof_hist` | `prof123` | `/teacher` |
| Agent accueil | `agent` | `agent123` | `/scan` |

### Données générées automatiquement

| Entité | Quantité |
|---|---|
| Classes | 8 (6ème A/B, 5ème A/B, 4ème A/B, 3ème A/B) |
| Élèves | ~272 avec QR codes, parents, dates de naissance |
| Matières | 48 (6 par classe : Maths, Français, Anglais, SVT, PC, Hist-Géo) |
| Notes | ~4 900 (3 types : Devoir, Interrogation, Examen) |
| Paiements | ~816 (70% payé · 20% en attente · 10% en retard) |
| Présences | Semaine courante (70% présent · 15% retard · 15% absent) |

---

## Sans Docker (installation manuelle)

```bash
# ── Backend ──────────────────────────────────────────────────
cd backend

# Créer et activer l'environnement virtuel
python -m venv .venv
source .venv/bin/activate        # Linux / Mac
# .venv\Scripts\activate         # Windows

pip install -r requirements.txt

# Le fichier .env est déjà prêt avec les valeurs par défaut
# (SQLite + console email + pas de SMS réel)
python manage.py migrate
python manage.py seed_data       # charge ~272 élèves, 4900 notes, 816 paiements...

python manage.py runserver       # démarre sur http://127.0.0.1:8000

# ── Frontend (autre terminal) ─────────────────────────────────
cd frontend
# Le fichier .env est prêt : REACT_APP_API_URL=http://127.0.0.1:8000/api
npm install
npm start                        # démarre sur http://localhost:3000
```

### Réinitialiser les données

```bash
python manage.py seed_data --reset   # supprime tout et re-seed
```

---

## Structure du projet

```
school_dayamba/
├── docker-compose.yml           # Production (PostgreSQL + Gunicorn + Nginx)
├── docker-compose.dev.yml       # Développement (hot reload)
├── Makefile                     # Raccourcis make
├── .env                         # Variables d'environnement
│
├── backend/
│   ├── Dockerfile               # Python 3.12-slim
│   ├── entrypoint.sh            # Attend DB → migrate → seed → start
│   ├── requirements.txt
│   ├── locustfile.py            # Tests de charge (100 utilisateurs)
│   │
│   ├── config/
│   │   ├── settings.py          # Configuration complète (sécurité, cache, logs)
│   │   ├── middleware.py        # SecurityHeadersMiddleware (CSP, Permissions-Policy…)
│   │   └── urls.py              # Routes + endpoint /api/health/
│   │
│   ├── apps/
│   │   ├── users/               # Authentification JWT, RBAC, journaux d'activité
│   │   │   └── management/commands/
│   │   │       ├── backup_db.py                  # Sauvegarde SQLite / pg_dump
│   │   │       ├── seed_data.py                  # Données de test
│   │   │       └── send_absence_notifications.py # Alertes absences (SMS+WA+Email)
│   │   ├── students/            # Élèves, QR codes, class_summary enrichi
│   │   ├── classes/             # Niveaux, classes, année scolaire
│   │   ├── subjects/            # Matières avec coefficient
│   │   ├── grades/              # Notes + historique des modifications
│   │   ├── attendance/          # Présences QR, notifications tricanal
│   │   ├── payments/            # Paiements, dépenses, broadcast SMS/WA/Email
│   │   ├── teachers/            # Profil, dashboard stats (mis en cache), LessonLog
│   │   └── reports/             # PDF, Excel, dashboard admin (mis en cache)
│   │
│   └── utils/
│       ├── sms_service.py       # Twilio SMS
│       ├── whatsapp_service.py  # WhatsApp Business API (Twilio)
│       ├── email_service.py     # Email transactionnel + bulk (5 templates)
│       ├── qr_generator.py      # Génération QR code élève
│       └── pdf_generator.py     # Bulletin PDF (ReportLab)
│
└── frontend/
    ├── Dockerfile               # Node build → Nginx serve
    ├── nginx.conf               # Proxy /api → backend + SPA routing
    └── src/
        ├── App.js               # Routes par rôle (DIRECTOR / TEACHER / AGENT)
        ├── services/api.js      # Axios + intercepteur JWT + file d'attente 401
        ├── components/
        │   └── layout/Sidebar.js
        └── pages/
            ├── AdminDashboard/       # KPIs temps réel, dépenses, solde net
            ├── Students/             # Liste, recherche, filtre, CRUD
            ├── StudentDetail/        # Fiche complète (notes, absences, paiements)
            ├── Classes/              # Arbre niveau → classe → élèves (moyenne + absences)
            ├── Subjects/             # Matières avec coefficient et prof affecté
            ├── Teachers/             # Liste des professeurs
            ├── TeacherProfile/       # Profil enseignant
            ├── TeacherDashboard/     # Stats matières, derniers cours, accès rapide
            ├── GradesManagement/     # Saisie et gestion des notes
            ├── LessonLog/            # Cahier de texte avec barre de progression
            ├── AttendanceScanner/    # Scanner QR (entrée / sortie)
            ├── Payments/             # Suivi des paiements
            ├── Expenses/             # Gestion des dépenses (7 catégories)
            ├── Reports/              # 4 onglets : performance, absences, paiements, bulletins
            ├── Bulletins/            # Génération PDF individuelle / ZIP classe
            ├── Communications/       # Broadcast SMS + WhatsApp + Email aux parents
            ├── ActivityLogs/         # Journal d'audit (Directeur)
            ├── Users/                # Gestion des utilisateurs
            └── Login/                # Authentification JWT
```

---

## Modules backend

### Authentification (`apps/users`)

- JWT avec `SimpleJWT` — access token (15 min) + refresh token (7 jours)
- Rotation automatique des refresh tokens + blacklist à la déconnexion
- `LoginRateThrottle` : max 10 tentatives/minute par IP
- RBAC : `DIRECTOR` · `ADMIN` · `TEACHER` · `AGENT`
- Journal d'activité : toutes les actions sensibles sont loguées (`ActivityLog`)

### Élèves (`apps/students`)

- CRUD complet avec génération automatique du matricule et du QR code
- Endpoint `GET /students/class_summary/?classe_id=X` — retourne élèves + moyenne calculée + nombre d'absences en 2 requêtes agrégées (pas de N+1)
- Endpoint `GET /students/{id}/situation/` — fiche complète (notes, présences, paiements)

### Présences (`apps/attendance`)

- Scan QR → `POST /attendance/scan/` avec `scan_type=IN|OUT`
- Détection automatique des retards (après 07h45)
- Notification immédiate tricanal : **SMS** + **WhatsApp** + **Email** au parent
- Endpoint `GET /attendance/today/` — présences du jour

### Notes (`apps/grades`)

- Types : Devoir, Examen, Interrogation, Oral, TP
- Historique des modifications via `GradeHistory` (qui, quand, ancienne valeur)
- Calcul de la moyenne pondérée par coefficient de matière

### Paiements & Dépenses (`apps/payments`)

- Suivi des paiements élève (PAID / PENDING / OVERDUE)
- 7 catégories de dépenses : Salaires, Fournitures, Maintenance, Services, Transport, Événements, Autre
- Broadcast **SMS** : `POST /payments/broadcast/send/`
- Broadcast **Email** : `POST /payments/broadcast/email/`
- Solde net = total encaissé − total dépenses (affiché dans le dashboard)

### Rapports (`apps/reports`)

- `GET /reports/dashboard/` — stats globales (mise en cache 60 s)
- `GET /reports/attendance/` — rapport absences par classe + plage de dates
- `GET /reports/payments/` — taux de paiement par classe
- `GET /reports/export/` — export Excel stylisé (notes, absences, paiements, classements)
- `GET /reports/bulletin/{id}/` — bulletin PDF individuel

### Enseignants (`apps/teachers`)

- Profil avec matières assignées et numéro de téléphone
- `GET /teachers/dashboard_stats/` — stats par matière (mis en cache 2 min par professeur)
- `LessonLog` — cahier de texte : sujet, objectifs, contenu, devoirs, progression (%)

### Notifications multicanal (`utils/`)

| Service | Fichier | Déclencheurs |
|---|---|---|
| SMS | `sms_service.py` | Entrée QR, sortie QR, absence journalière, broadcast |
| WhatsApp | `whatsapp_service.py` | Entrée QR, sortie QR, absence journalière |
| Email | `email_service.py` | Entrée QR, sortie QR, absence journalière, broadcast |

Templates WhatsApp disponibles : `arrival`, `departure`, `absence`, `payment`, `results`

Templates Email disponibles : `results`, `absence`, `payment_reminder`, `meeting`, `custom`

---

## Pages frontend par rôle

### Directeur / Admin

| Page | Route | Description |
|---|---|---|
| Tableau de bord | `/` | KPIs, dépenses, solde net, présences du jour |
| Élèves | `/students` | Liste complète + CRUD |
| Classes | `/classes` | Arbre niveau → classe → élèves (moyenne, absences, paiement) |
| Matières | `/subjects` | Gestion avec coefficient et professeur affecté |
| Professeurs | `/teachers` | Liste et profils |
| Notes | `/grades` | Consultation et saisie |
| Présences | `/attendance` | Scanner QR + récapitulatif du jour |
| Paiements | `/payments` | Suivi et statuts |
| Dépenses | `/expenses` | Gestion par catégorie |
| Rapports | `/reports` | 4 onglets + exports Excel + bulletins PDF/ZIP |
| Communications | `/communications` | Broadcast SMS / WhatsApp / Email par classe ou global |
| Utilisateurs | `/users` | Gestion des comptes |
| Journal | `/logs` | Audit des activités |

### Professeur

| Page | Route | Description |
|---|---|---|
| Tableau de bord | `/teacher` | Stats matières, derniers cours, accès rapide |
| Mon profil | `/teacher/profile` | Informations personnelles |
| Saisie des notes | `/teacher/grades` | Gestion des notes par matière/classe |
| Cahier de texte | `/teacher/lessons` | LessonLog avec barre de progression |

### Agent

| Page | Route | Description |
|---|---|---|
| Scanner | `/attendance` | Scanner QR code entrée/sortie |

---

## Notifications (SMS / WhatsApp / Email)

### Configuration Twilio (SMS + WhatsApp)

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+15005550006
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886   # sandbox Twilio (dev)
# En production : whatsapp:+VotreNuméroApprouvé
```

Pour utiliser le **sandbox WhatsApp** en développement :
1. Envoyer `join <mot-clé-sandbox>` depuis son téléphone au `+14155238886`
2. Les messages seront délivrés sans approbation Meta

### Configuration Email (SMTP)

```env
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=votre@gmail.com
EMAIL_HOST_PASSWORD=app_password_gmail
DEFAULT_FROM_EMAIL=SchoolPro <noreply@schoolpro.local>
```

En développement (sans `.env`), les emails sont affichés dans la console Django.

### Notifications automatiques d'absence (cron)

```bash
# Lancer chaque soir à 18h00
python manage.py send_absence_notifications

# Simuler sans envoyer
python manage.py send_absence_notifications --dry-run

# Pour une date précise
python manage.py send_absence_notifications --date 2026-01-15
```

Exemple de crontab :
```
0 18 * * 1-5 cd /app && python manage.py send_absence_notifications >> /var/log/absences.log 2>&1
```

---

## Sécurité

| Mesure | Détail |
|---|---|
| JWT hardening | Access 15 min, refresh 7 jours, rotation, blacklist |
| Rate limiting | Login : 10/min · Anonyme : 60/h · Utilisateur : 1000/h |
| En-têtes HTTP | `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy` (prod) |
| HTTPS (prod) | HSTS 1 an + subdomains + preload, SSL redirect |
| Cookies (prod) | `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `CSRF_COOKIE_SAMESITE=Strict` |
| Taille des uploads | Max 10 Mo (fichiers et corps de requête) |
| Hashage mots de passe | PBKDF2 + bcrypt + Argon2 (waterfall) |
| RBAC | Permissions par rôle sur chaque endpoint DRF |
| Journal de sécurité | `logs/security.log` (rotation 10 Mo × 5 fichiers) |

---

## Performance & disponibilité

### Optimisations

- **Cache dashboard admin** : 60 secondes (`cache_key = dashboard_stats_admin`)
- **Cache dashboard enseignant** : 2 minutes par professeur
- **Index DB** : `student(classe, is_active)`, `student(payment_status)`, `student(last_name, first_name)`
- **`select_related` / `prefetch_related`** sur tous les querysets de liste
- **Agrégations SQL** : `class_summary` retourne moyennes + absences en 2 requêtes
- **`CONN_MAX_AGE = 60`** : réutilisation des connexions DB

### Sauvegarde automatique

```bash
# Sauvegarder (SQLite ou PostgreSQL via pg_dump)
python manage.py backup_db

# Destination personnalisée + rétention
python manage.py backup_db --dest /srv/backups --keep 30
```

### Health check

```
GET /api/health/
→ { "status": "ok", "timestamp": "...", "database": "connected", "version": "1.0.0" }
```

### Logs applicatifs

| Fichier | Contenu |
|---|---|
| `logs/app.log` | Toute l'activité applicative (INFO+) |
| `logs/security.log` | Événements de sécurité (WARNING+) |
| `logs/errors.log` | Erreurs uniquement (ERROR+) |

Rotation automatique : 10 Mo maximum, 5 fichiers conservés.

---

## Variables d'environnement

Créer un fichier `.env` à la racine `backend/` :

```env
# Base
SECRET_KEY=changeme-en-production
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1

# Base de données PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/schoolpro

# JWT
JWT_ACCESS_TOKEN_LIFETIME_MINUTES=15
JWT_REFRESH_TOKEN_LIFETIME_DAYS=7

# Twilio SMS
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# WhatsApp Business (Twilio)
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# Email SMTP
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
DEFAULT_FROM_EMAIL=SchoolPro <noreply@schoolpro.local>

# Nom de l'établissement (apparaît dans les emails)
SCHOOL_NAME=Mon École

# Capacité maximale d'élèves actifs par école (défaut : 7000)
MAX_STUDENTS_PER_SCHOOL=7000

# Cache Redis (optionnel — LocMem si absent)
REDIS_URL=redis://localhost:6379/0

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

---

## Commandes utiles

### Docker

```bash
# Production
docker compose up -d --build
docker compose down
docker compose logs -f
docker compose logs -f backend

# Développement (hot reload)
docker compose -f docker-compose.dev.yml up --build

# Utilitaires
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed_data
docker compose exec backend python manage.py backup_db
docker compose exec backend python manage.py send_absence_notifications --dry-run
docker compose exec backend python manage.py createsuperuser

# Réinitialiser complètement
docker compose down -v && docker compose up -d --build
```

### Makefile

```bash
make up        # Démarrer en production
make dev       # Démarrer en dev (hot reload)
make down      # Arrêter
make logs      # Logs
make shell     # Shell backend
make seed      # Données de test
make clean     # Tout supprimer
make reset     # Réinitialiser la base
make help      # Aide
```

### Django (hors Docker)

```bash
python manage.py migrate
python manage.py seed_data                                   # Données de test
python manage.py backup_db --dest ./backups --keep 30       # Sauvegarde DB
python manage.py send_absence_notifications --dry-run       # Test alertes absence
python manage.py createsuperuser
```

---

## Tests de charge

Le fichier `backend/locustfile.py` valide les critères de recette : **100 utilisateurs simultanés, temps de réponse P95 < 2 s, taux d'erreur < 1 %**.

### Trois profils d'utilisateurs simulés

| Profil | Poids | Comportement |
|---|---|---|
| Admin (20%) | Dashboard, liste élèves, class_summary, paiements |
| Enseignant (60%) | Dashboard stats, notes, cahier de texte |
| Agent (20%) | Présences du jour, statistiques d'assiduité |

### Lancer les tests

```bash
# Installer Locust
pip install locust

# Interface web (http://localhost:8089)
locust --host http://127.0.0.1:8000

# Mode headless — 100 utilisateurs, montée en 10/s, durée 60 s
locust --headless -u 100 -r 10 --run-time 60s \
       --host http://127.0.0.1:8000 \
       --csv=results/loadtest

# Avec Docker
docker compose exec backend locust --headless -u 100 -r 10 \
       --run-time 60s --host http://backend:8000
```

Les seuils sont vérifiés automatiquement à la fin du test (code de sortie 1 si dépassement).

---

## Modèle de données

| Entité | Attributs clés |
|---|---|
| Utilisateur | id, nom, prénom, email, rôle (DIRECTOR/ADMIN/TEACHER/AGENT), mot de passe hashé, statut |
| Élève | id, nom, prénom, classe, QR code, parent (nom, téléphone, email), statut_paiement |
| Professeur | id, nom, prénom, matières assignées, numéro de téléphone |
| Classe | id, nom, niveau, année scolaire, capacité |
| Matière | id, nom, coefficient, professeur_id, classe_id |
| Note | id, élève_id, matière_id, valeur, max_valeur, type_évaluation, date |
| Présence | id, élève_id, date, heure_entrée, heure_sortie, statut (PRESENT/ABSENT/LATE) |
| Paiement | id, élève_id, montant, date, statut, numéro de reçu |
| Dépense | id, libellé, catégorie, montant, date, enregistré_par |
| LessonLog | id, professeur_id, matière_id, date, sujet, objectifs, contenu, devoirs, progression_% |
| ActivityLog | id, utilisateur_id, action, description, ip, timestamp |
| GradeHistory | id, note_id, ancienne_valeur, modifié_par, timestamp |

---

**SchoolPro** — Développé par AMADOU DAYAMBA
