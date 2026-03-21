#!/bin/bash
set -e

echo "========================================"
echo "  SchoolPro — Démarrage Backend"
echo "========================================"

# Wait for PostgreSQL
if [ "$USE_POSTGRES" = "true" ]; then
    echo "⏳ Attente de PostgreSQL sur ${DB_HOST}:${DB_PORT}..."
    while ! python -c "
import socket, sys
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
try:
    s.connect(('${DB_HOST:-db}', int('${DB_PORT:-5432}')))
    s.close()
    sys.exit(0)
except:
    sys.exit(1)
" 2>/dev/null; do
        sleep 2
        echo "   ⏳ PostgreSQL pas encore prêt..."
    done
    echo "✅ PostgreSQL connecté !"
fi

# Migrations
echo "📦 Migrations..."
python manage.py migrate --noinput

# Seed data (ignore errors if already seeded)
echo "🌱 Données initiales..."
python manage.py seed_data 2>/dev/null || echo "   (déjà chargées ou ignorées)"

# Static files
echo "📁 Fichiers statiques..."
python manage.py collectstatic --noinput 2>/dev/null || true

echo ""
echo "🚀 Serveur prêt !"
echo "========================================"

# Start server
if [ "$DJANGO_DEBUG" = "True" ]; then
    python manage.py runserver 0.0.0.0:8000
else
    gunicorn config.wsgi:application \
        --bind 0.0.0.0:8000 \
        --workers 3 \
        --timeout 120 \
        --access-logfile - \
        --error-logfile -
fi
