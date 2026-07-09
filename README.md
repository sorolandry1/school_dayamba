# SchoolPro — Plateforme de gestion scolaire

SchoolPro est une application web de gestion scolaire développée avec Django REST Framework pour le backend et React pour le frontend. Elle couvre les principaux flux d’un établissement : élèves, classes, matières, notes, présences, paiements, rapports, communications et administration.

## Ce que contient l’application

La version actuelle du projet expose notamment :

- une authentification JWT avec rôles utilisateurs
- une gestion des élèves avec génération de matricule et de QR code
- une gestion des classes, niveaux et matières
- une saisie et consultation des notes
- un module de scan QR pour les présences
- un suivi des paiements et des dépenses
- des rapports, exports et génération de bulletins
- un tableau de bord adapté selon le profil utilisateur

## Stack technique

- Backend : Django 5.1.4 + Django REST Framework 3.15.2
- Frontend : React 18.3.1 + React Router 6
- Base de données : SQLite par défaut en local, PostgreSQL via Docker
- Authentification : JWT avec SimpleJWT
- Notifications : Twilio (SMS/WhatsApp), email SMTP ou console en développement
- Conteneurisation : Docker Compose

## Structure du dépôt

```text
backend/          # API Django REST
frontend/         # Application React
Dockerfile        # (si utilisé via Docker)
docker-compose.yml
docker-compose.dev.yml
Makefile
```

## Prérequis

- Python 3.11+ (recommandé 3.12)
- Node.js 20+
- Docker Desktop / Docker Compose si vous souhaitez utiliser les conteneurs

## Démarrage rapide avec Docker

Depuis la racine du projet :

```bash
docker compose up -d --build
```

Une fois les services lancés, les URLs suivantes sont disponibles :

- http://localhost:3000 : interface frontend
- http://localhost:8000/api : API Django
- http://localhost:8000/admin : administration Django
- http://localhost:8000/api/health/ : vérification de santé de l’API

### Mode développement avec hot reload

```bash
docker compose -f docker-compose.dev.yml up --build
```

## Démarrage manuel

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate      # Linux/macOS
.\.venv\Scripts\Activate.ps1  # PowerShell (Windows)
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_data
python manage.py runserver
```

Le backend sera disponible sur http://127.0.0.1:8000.

### Frontend

```bash
cd frontend
npm install
npm start
```

Le frontend sera disponible sur http://localhost:3000.

## Comptes de démonstration

Le seed de données crée des comptes de test :

| Rôle | Identifiant | Mot de passe |
|---|---|---|
| Directeur | directeur | directeur123 |
| Administrateur | admin | admin123 |
| Professeur de mathématiques | prof_math | prof123 |
| Professeur de français | prof_fr | prof123 |
| Agent d’accueil | agent | agent123 |

## Routes principales du frontend

L’application contient des vues protégées selon les rôles suivants :

- ADMIN / DIRECTOR : tableau de bord, élèves, classes, matières, notes, paiements, rapports, utilisateurs, journaux
- TEACHER : tableau de bord enseignant, profil, saisie des notes, cahier de texte
- AGENT : scan QR et suivi des présences
- EDUCATEUR / CAISSE : vues spécifiques ajoutées dans l’interface

Routes principales :

- /login
- /dashboard
- /students
- /classes
- /subjects
- /grades
- /attendance
- /payments
- /expenses
- /reports
- /communications
- /teacher
- /teacher/grades
- /teacher/profile
- /teacher/lessons
- /scan
- /register/:token
- /forgot-password
- /reset-password/:token

## API principale

Les endpoints sont regroupés sous les préfixes suivants :

- /api/auth/ : authentification, invitations, réinitialisation de mot de passe
- /api/students/ : gestion des élèves
- /api/teachers/ : profils et statistiques enseignants
- /api/classes/ : classes et niveaux
- /api/subjects/ : matières
- /api/grades/ : notes
- /api/attendance/ : présences et scan QR
- /api/payments/ : paiements et dépenses
- /api/reports/ : tableaux de bord et exports
- /api/health/ : contrôle de santé

## Données de test

La commande suivante charge des données de démonstration :

```bash
python manage.py seed_data
```

Pour réinitialiser la base avant un nouveau seed :

```bash
python manage.py seed_data --reset
```

## Commandes utiles

### Docker

```bash
docker compose up -d --build
docker compose down
docker compose logs -f
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed_data
docker compose exec backend python manage.py createsuperuser
```

### Makefile

```bash
make up
make dev
make down
make logs
make shell
make seed
make clean
make reset
make help
```

## Variables d’environnement

Un fichier .env à la racine du projet est utilisé par Docker Compose. Les variables principales sont :

```env
DJANGO_SECRET_KEY=change-me
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
DB_NAME=school_management
DB_USER=schoolpro
DB_PASSWORD=schoolpro_dev
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
FRONTEND_URL=http://localhost:3000
```

## Déploiement local (serveur LAN, Windows)

SchoolPro est conçu pour un déploiement **local par établissement** : un poste
serveur Windows héberge l'application, les autres postes y accèdent via le
réseau local.

- **Accès clients** : `http://IP-DU-SERVEUR:5006` (le front écoute sur le port
  **5006**, cf. `frontend/.env`). L'API est déduite automatiquement de l'hôte du
  navigateur (`http://IP-DU-SERVEUR:8000/api`).
- **Poste serveur** : Windows allumé en permanence, **IP statique**, et **règles
  de pare-feu** autorisant les ports **5006** (application) et **8000** (API) en
  entrée sur le réseau local.
- **Portée** : une seule école par installation (`SINGLE_SCHOOL_MODE=True`).
- **Langues** : Français, Mòoré, English (sélecteur dans le menu latéral).
- **Licence** : essai gratuit de 28 jours, puis activation par **code**
  (renouvellement réglé par Mobile Money hors application). L'identifiant machine
  et le compte à rebours sont visibles dans l'écran d'activation.

Ouverture des ports dans le pare-feu Windows (PowerShell administrateur) :

```powershell
New-NetFirewallRule -DisplayName "SchoolPro App"  -Direction Inbound -LocalPort 5006 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "SchoolPro API"  -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
```

Générer un code d'activation (côté éditeur, avec la clé secrète de licence) :

```bash
python manage.py issue_license_code --machine-id <ID_MACHINE> --months 12
```

## Notes importantes

- En développement local, le backend utilise SQLite par défaut.
- En environnement Docker, la configuration bascule vers PostgreSQL.
- Les notifications SMS/WhatsApp/Email sont optionnelles et ne sont envoyées que si les variables de configuration associées sont fournies.

## Auteur

SchoolPro — développement et maintenance par Amadou Dayamba.
