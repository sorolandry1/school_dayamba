"""Règles académiques des bulletins : périodes (trimestres / semestres),
appréciations automatiques, distinctions du conseil de classe, décision de
fin d'année et calcul des absences horaires.

Les seuils par défaut suivent l'usage courant (notation sur 20). Ils peuvent
être surchargés par établissement via `PlatformSettings.decision_rules`.
"""
from datetime import timedelta

# ── Périodes ────────────────────────────────────────────────────────────────

PERIOD_LABELS = {
    'TRIMESTER': {1: '1er Trimestre', 2: '2e Trimestre', 3: '3e Trimestre'},
    'SEMESTER':  {1: '1er Semestre', 2: '2e Semestre'},
}
ANNUAL_LABEL = 'Année scolaire'


def period_count(system):
    return 2 if system == 'SEMESTER' else 3


def period_options(system):
    """Liste [(valeur, libellé)] pour les sélecteurs, incluant l'annuel."""
    labels = PERIOD_LABELS.get(system, PERIOD_LABELS['TRIMESTER'])
    opts = [(str(i), labels[i]) for i in sorted(labels)]
    opts.append(('annual', ANNUAL_LABEL))
    return opts


def period_label(period, system):
    """`period` : entier 1..N, ou 'annual'/None pour l'année entière."""
    if period in (None, 'annual', 'ANNUAL', 0):
        return ANNUAL_LABEL
    try:
        idx = int(period)
    except (TypeError, ValueError):
        return ANNUAL_LABEL
    return PERIOD_LABELS.get(system, PERIOD_LABELS['TRIMESTER']).get(idx, ANNUAL_LABEL)


def normalize_period(period):
    """Retourne un entier de période, ou None pour l'annuel."""
    if period in (None, '', 'annual', 'ANNUAL', 0, '0'):
        return None
    try:
        return int(period)
    except (TypeError, ValueError):
        return None


def period_date_range(academic_year, period, system):
    """Fenêtre de dates (start, end) d'une période, par division égale de
    l'année scolaire. Retourne (start, end) de l'année entière pour l'annuel."""
    if academic_year is None:
        return None, None
    start, end = academic_year.start_date, academic_year.end_date
    idx = normalize_period(period)
    if idx is None:
        return start, end
    n = period_count(system)
    idx = max(1, min(idx, n))
    total_days = (end - start).days
    if total_days <= 0:
        return start, end
    span = total_days / n
    p_start = start + timedelta(days=round(span * (idx - 1)))
    p_end = end if idx == n else start + timedelta(days=round(span * idx) - 1)
    return p_start, p_end


# ── Appréciations & distinctions ──────────────────────────────────────────────

def appreciation(avg):
    """Appréciation d'une moyenne /20 (matière ou générale)."""
    if avg is None:
        return ''
    if avg >= 16: return 'Très Bien'
    if avg >= 14: return 'Bien'
    if avg >= 12: return 'Assez Bien'
    if avg >= 10: return 'Passable'
    if avg >= 8:  return 'Insuffisant'
    return 'Très insuffisant'


def _rules(settings):
    """Fusionne les surcharges de l'établissement avec les valeurs par défaut."""
    defaults = {
        'admis': 10.0,          # moyenne >= admis → admis en classe supérieure
        'rachat': 9.0,          # [rachat, admis[ → examiné par le conseil (cas limite)
        'felicitations': 16.0,
        'encouragements': 14.0,
        'tableau_honneur': 12.0,
        'avertissement': 8.0,   # moyenne < avertissement → avertissement travail
    }
    if settings is not None:
        overrides = getattr(settings, 'decision_rules', None) or {}
        for k, v in overrides.items():
            if k in defaults:
                try:
                    defaults[k] = float(v)
                except (TypeError, ValueError):
                    pass
    return defaults


def distinction(avg, settings=None):
    """Distinction du conseil de classe (mention de comportement/travail)."""
    if avg is None:
        return ''
    r = _rules(settings)
    if avg >= r['felicitations']:   return 'Félicitations'
    if avg >= r['encouragements']:  return 'Encouragements'
    if avg >= r['tableau_honneur']: return "Tableau d'honneur"
    if avg < r['avertissement']:    return 'Avertissement travail'
    return ''


def year_end_decision(avg, settings=None):
    """Décision de fin d'année pour la moyenne annuelle. Retourne un dict
    {label, kind} où kind ∈ {admis, limite, redouble}."""
    if avg is None:
        return {'label': 'Non déterminée', 'kind': 'limite'}
    r = _rules(settings)
    if avg >= r['admis']:
        return {'label': 'Admis(e) en classe supérieure', 'kind': 'admis'}
    if avg >= r['rachat']:
        return {'label': 'Cas limite — décision du conseil de classe', 'kind': 'limite'}
    return {'label': 'Redouble(e) la classe', 'kind': 'redouble'}


# ── Assiduité : absences en heures ────────────────────────────────────────────

def attendance_hours(student, start_date=None, end_date=None, hours_per_day=6):
    """Résumé d'assiduité sur une période.

    Absences comptées en heures : si un pointage entrée/sortie existe, on
    utilise les heures réellement manquées ; sinon une absence vaut une
    journée entière (`hours_per_day`). Les retards sont comptés à part.
    """
    from apps.attendance.models import Attendance
    hours_per_day = float(hours_per_day or 6)

    qs = Attendance.objects.filter(student=student)
    if start_date:
        qs = qs.filter(date__gte=start_date)
    if end_date:
        qs = qs.filter(date__lte=end_date)

    absent_days = 0
    absent_hours = 0.0
    late_count = 0
    late_hours = 0.0
    for rec in qs:
        if rec.status == 'ABSENT':
            absent_days += 1
            partial = rec.hours_absent if (rec.check_in and rec.check_out) else 0
            absent_hours += partial if partial else hours_per_day
        elif rec.status == 'LATE':
            late_count += 1
            late_hours += rec.hours_absent or 0

    return {
        'absent_days': absent_days,
        'absent_hours': round(absent_hours, 1),
        'late_count': late_count,
        'late_hours': round(late_hours, 1),
        'total_hours': round(absent_hours + late_hours, 1),
    }
