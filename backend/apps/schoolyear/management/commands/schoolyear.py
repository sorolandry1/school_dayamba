"""Gestion de l'isolation par année scolaire (base locale SQLite).

    python manage.py schoolyear list
    python manage.py schoolyear archive [--name 2025-2026]
    python manage.py schoolyear new --name 2026-2027 [--keep-grades] [--keep-attendance] [--keep-financials]
    python manage.py schoolyear restore --file annee_2025-2026.sqlite3
"""
from django.core.management.base import BaseCommand, CommandError

from apps.schoolyear import service


class Command(BaseCommand):
    help = "Archive / nouvelle année / restauration des bases par année scolaire."

    def add_arguments(self, parser):
        parser.add_argument('action', choices=['list', 'archive', 'new', 'restore'])
        parser.add_argument('--name', help="Nom d'année (archive/new).")
        parser.add_argument('--file', help="Fichier d'archive (restore).")
        parser.add_argument('--keep-grades', action='store_true')
        parser.add_argument('--keep-attendance', action='store_true')
        parser.add_argument('--keep-financials', action='store_true')

    def handle(self, *args, **o):
        action = o['action']
        try:
            if action == 'list':
                self.stdout.write(f"Année active : {service._current_year_name()}")
                for a in service.list_archives():
                    self.stdout.write(f"  {a['filename']}  ({a['size_kb']} Ko, {a['modified']})")
            elif action == 'archive':
                info = service.archive_current_year(o.get('name'))
                self.stdout.write(self.style.SUCCESS(f"Archivé : {info['file']} ({info['size_kb']} Ko)"))
            elif action == 'new':
                if not o.get('name'):
                    raise CommandError('--name requis.')
                info = service.start_new_year(
                    o['name'],
                    reset_grades=not o['keep_grades'],
                    reset_attendance=not o['keep_attendance'],
                    reset_financials=not o['keep_financials'],
                )
                self.stdout.write(self.style.SUCCESS(
                    f"Nouvelle année {info['new_year']} (archive {info['archived']['file']}). Réinit : {info['reset']}"
                ))
            elif action == 'restore':
                if not o.get('file'):
                    raise CommandError('--file requis.')
                info = service.restore_archive(o['file'])
                self.stdout.write(self.style.WARNING(
                    f"Restauré depuis {info['restored_from']} (sauvegarde {info['backup']}). "
                    f"Redémarrez le serveur."
                ))
        except Exception as exc:
            raise CommandError(str(exc))
