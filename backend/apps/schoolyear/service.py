"""Isolation physique de la base de données par année scolaire.

Modèle : **une base active** (le fichier SQLite `default`) contient l'année en
cours ; chaque année **clôturée** est copiée dans son propre fichier sous
`data/annees/`. On obtient ainsi un fichier physique par année scolaire, sans
routage multi-bases fragile.

Opérations :
  • archive_current_year()  — copie non destructive de la base active dans un
    fichier d'archive daté par année.
  • start_new_year()        — archive l'année en cours puis prépare la nouvelle
    (nouvelle AcademicYear courante + réinitialisation optionnelle des données
    transactionnelles : notes, présences, finances).
  • list_archives()         — liste les fichiers d'archive.
  • restore_archive()       — remet une archive comme base active (sauvegarde
    préalable de la base courante). Nécessite un redémarrage du serveur.

Disponible uniquement en mode local SQLite.
"""
import re
import shutil
from datetime import datetime
from pathlib import Path

from django.conf import settings
from django.db import connections


def _active_db_path() -> Path:
    db = settings.DATABASES['default']
    if 'sqlite3' not in db['ENGINE']:
        raise RuntimeError(
            "L'isolation par année n'est disponible qu'en mode local SQLite."
        )
    return Path(db['NAME'])


def _archive_dir() -> Path:
    d = Path(settings.BASE_DIR) / 'data' / 'annees'
    d.mkdir(parents=True, exist_ok=True)
    return d


def _safe(name: str) -> str:
    return re.sub(r'[^0-9A-Za-z_-]+', '_', (name or 'annee').strip()) or 'annee'


def _close_connections():
    # Libère les verrous du fichier SQLite avant copie/remplacement.
    connections.close_all()


def _current_year_name() -> str:
    from apps.classes.models import AcademicYear
    y = AcademicYear.objects.filter(is_current=True).first()
    return y.name if y else datetime.now().strftime('%Y')


def archive_current_year(year_name: str = None) -> dict:
    """Copie la base active dans un fichier d'archive (non destructif)."""
    src = _active_db_path()
    if not src.exists():
        raise RuntimeError('Base de données active introuvable.')
    name = _safe(year_name or _current_year_name())
    dest = _archive_dir() / f'annee_{name}.sqlite3'
    _close_connections()
    shutil.copy2(src, dest)
    return {
        'archived_year': name,
        'file': dest.name,
        'size_kb': round(dest.stat().st_size / 1024, 1),
    }


def list_archives() -> list:
    out = []
    for f in sorted(_archive_dir().glob('*.sqlite3')):
        st = f.stat()
        out.append({
            'filename': f.name,
            'size_kb': round(st.st_size / 1024, 1),
            'modified': datetime.fromtimestamp(st.st_mtime).isoformat(timespec='seconds'),
        })
    return out


def start_new_year(new_name: str, reset_grades=True, reset_attendance=True,
                   reset_financials=True) -> dict:
    """Clôture l'année en cours (archive) puis démarre la nouvelle.

    Conserve élèves, classes, matières, personnel et réglages ; réinitialise
    (optionnel) les données transactionnelles de la nouvelle année.
    """
    from django.db import transaction
    from apps.classes.models import AcademicYear
    from apps.classes.views import _current_or_new_year

    if not new_name or not new_name.strip():
        raise ValueError('Nom de la nouvelle année requis.')

    # 1) Archive physique de l'année en cours
    archived = archive_current_year(_current_year_name())

    # 2) Réinitialisation optionnelle des données transactionnelles
    counts = {}
    with transaction.atomic():
        if reset_grades:
            from apps.grades.models import Grade, GradeHistory
            counts['grades'] = Grade.objects.all().delete()[0]
            GradeHistory.objects.all().delete()
        if reset_attendance:
            from apps.attendance.models import Attendance
            counts['attendance'] = Attendance.objects.all().delete()[0]
        if reset_financials:
            from apps.payments.models import Payment, Expense
            from apps.payroll.models import SalaryPayment
            from apps.students.models import Student
            counts['salaries'] = SalaryPayment.objects.all().delete()[0]
            counts['payments'] = Payment.objects.all().delete()[0]
            counts['expenses'] = Expense.objects.all().delete()[0]
            Student.objects.update(payment_status='PENDING')

        # 3) Nouvelle année courante
        ecole = None
        year, _ = AcademicYear.objects.get_or_create(
            name=new_name.strip(), ecole=ecole,
            defaults={
                'start_date': datetime.now().date().replace(month=10, day=1),
                'end_date': datetime.now().date().replace(month=7, day=31),
            },
        )
        year.is_current = True
        year.save()

    return {
        'new_year': year.name,
        'archived': archived,
        'reset': counts,
    }


def restore_archive(filename: str) -> dict:
    """Remet une archive comme base active (sauvegarde préalable). Redémarrage requis."""
    src = _archive_dir() / Path(filename).name
    if not src.exists() or src.suffix != '.sqlite3':
        raise RuntimeError('Archive introuvable.')
    active = _active_db_path()
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup = _archive_dir() / f'_avant_restauration_{ts}.sqlite3'
    _close_connections()
    if active.exists():
        shutil.copy2(active, backup)
    shutil.copy2(src, active)
    return {
        'restored_from': src.name,
        'backup': backup.name,
        'restart_required': True,
    }
