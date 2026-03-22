#!/bin/bash
set -e

echo "========================================"
echo "  SchoolPro - Demarrage Backend"
echo "========================================"

if [ "$USE_POSTGRES" = "true" ]; then
    echo "Attente de PostgreSQL sur ${DB_HOST:-db}:${DB_PORT:-5432}..."

    until python - << 'PYEOF'
import os, sys, psycopg2
try:
    conn = psycopg2.connect(
        host=os.environ.get("DB_HOST", "db"),
        port=int(os.environ.get("DB_PORT", 5432)),
        dbname=os.environ.get("DB_NAME", "school_management"),
        user=os.environ.get("DB_USER", "schoolpro"),
        password=os.environ.get("DB_PASSWORD", "schoolpro_dev")
    )
    conn.close()
    sys.exit(0)
except Exception as e:
    print("PostgreSQL pas encore pret : {}".format(e), flush=True)
    sys.exit(1)
PYEOF
    do
        sleep 2
    done
    echo "PostgreSQL connecte !"
fi

echo "Migrations..."
python manage.py migrate --noinput

echo "Donnees initiales..."
python manage.py seeddata 2>/dev/null && echo "Donnees chargees." || echo "Deja chargees ou ignorees."

echo "Fichiers statiques..."
python manage.py collectstatic --noinput 2>/dev/null || true

echo ""
echo "Serveur pret !"
echo "========================================"

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