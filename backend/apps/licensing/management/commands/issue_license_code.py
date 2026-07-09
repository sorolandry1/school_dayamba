"""Génère un code d'activation de licence (côté éditeur).

Exemples :
    python manage.py issue_license_code --machine-id A1B2C3D4E5F6 --months 12
    python manage.py issue_license_code --machine-id A1B2C3D4E5F6 --until 2027-09-30

Le code produit est lié à l'identifiant machine fourni et ne fonctionnera que
sur cette installation. Nécessite le même LICENSE_SIGNING_SECRET que le client.
"""
from datetime import date, timedelta

from django.core.management.base import BaseCommand, CommandError

from apps.licensing.signing import make_code


class Command(BaseCommand):
    help = "Génère un code d'activation de licence lié à un identifiant machine."

    def add_arguments(self, parser):
        parser.add_argument('--machine-id', required=True, help="Identifiant machine de l'installation cible.")
        parser.add_argument('--months', type=int, default=None, help='Durée de validité en mois (défaut 12).')
        parser.add_argument('--days', type=int, default=None, help='Durée de validité en jours.')
        parser.add_argument('--until', type=str, default=None, help="Date d'expiration explicite (YYYY-MM-DD).")

    def handle(self, *args, **opts):
        machine_id = opts['machine_id'].strip()
        if opts['until']:
            exp = opts['until'].strip()
            try:
                date.fromisoformat(exp)
            except ValueError:
                raise CommandError('Format --until invalide (attendu YYYY-MM-DD).')
        else:
            if opts['days']:
                delta = timedelta(days=opts['days'])
            else:
                months = opts['months'] or 12
                delta = timedelta(days=round(months * 30.44))
            exp = (date.today() + delta).isoformat()

        code = make_code(machine_id, exp)
        self.stdout.write(self.style.SUCCESS(f'Code d\'activation (machine {machine_id}, expire {exp}) :'))
        self.stdout.write(code)
