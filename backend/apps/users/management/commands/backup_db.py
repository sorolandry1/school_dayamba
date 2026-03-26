"""
Management command: backup_db
Usage: python manage.py backup_db [--dest /path/to/backups]

Creates a timestamped backup of the database.
- SQLite: copies the .db file
- PostgreSQL: runs pg_dump
Keeps the last 30 backups (auto-prunes older ones).
"""
import os
import shutil
import subprocess
from datetime import datetime
from pathlib import Path
from django.core.management.base import BaseCommand
from django.conf import settings


class Command(BaseCommand):
    help = 'Sauvegarde automatique de la base de données'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dest',
            type=str,
            default=str(settings.BASE_DIR / 'backups'),
            help='Dossier de destination des sauvegardes (défaut: BASE_DIR/backups)',
        )
        parser.add_argument(
            '--keep',
            type=int,
            default=30,
            help='Nombre de sauvegardes à conserver (défaut: 30)',
        )

    def handle(self, *args, **options):
        dest = Path(options['dest'])
        dest.mkdir(parents=True, exist_ok=True)
        keep = options['keep']

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        db_settings = settings.DATABASES['default']
        engine = db_settings['ENGINE']

        if 'sqlite3' in engine:
            self._backup_sqlite(db_settings, dest, timestamp)
        elif 'postgresql' in engine:
            self._backup_postgres(db_settings, dest, timestamp)
        else:
            self.stderr.write(f"Moteur de BDD non supporté: {engine}")
            return

        self._prune_old_backups(dest, keep)

    def _backup_sqlite(self, db_settings, dest, timestamp):
        src = Path(db_settings['NAME'])
        if not src.exists():
            self.stderr.write(f"Fichier SQLite introuvable: {src}")
            return

        backup_file = dest / f'backup_{timestamp}.sqlite3'
        shutil.copy2(src, backup_file)
        size_kb = backup_file.stat().st_size // 1024
        self.stdout.write(
            self.style.SUCCESS(f'✓ SQLite sauvegardé: {backup_file.name} ({size_kb} Ko)')
        )

    def _backup_postgres(self, db_settings, dest, timestamp):
        backup_file = dest / f'backup_{timestamp}.sql'
        env = os.environ.copy()
        env['PGPASSWORD'] = db_settings.get('PASSWORD', '')

        cmd = [
            'pg_dump',
            '--no-password',
            '--format=plain',
            '--encoding=UTF8',
            f"--host={db_settings.get('HOST', 'localhost')}",
            f"--port={db_settings.get('PORT', '5432')}",
            f"--username={db_settings.get('USER', 'postgres')}",
            db_settings.get('NAME', 'school_management'),
        ]

        try:
            with open(backup_file, 'w', encoding='utf-8') as f:
                subprocess.run(cmd, stdout=f, env=env, check=True, stderr=subprocess.PIPE)
            size_kb = backup_file.stat().st_size // 1024
            self.stdout.write(
                self.style.SUCCESS(f'✓ PostgreSQL sauvegardé: {backup_file.name} ({size_kb} Ko)')
            )
        except FileNotFoundError:
            self.stderr.write('pg_dump introuvable. Installez postgresql-client.')
        except subprocess.CalledProcessError as e:
            self.stderr.write(f'Erreur pg_dump: {e.stderr.decode()}')

    def _prune_old_backups(self, dest, keep):
        backups = sorted(dest.glob('backup_*'), key=lambda p: p.stat().st_mtime)
        to_delete = backups[:-keep] if len(backups) > keep else []
        for old in to_delete:
            old.unlink()
            self.stdout.write(f'  Supprimé (ancien): {old.name}')
        if to_delete:
            self.stdout.write(f'  {len(to_delete)} ancienne(s) sauvegarde(s) supprimée(s).')
