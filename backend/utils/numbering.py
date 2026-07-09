"""Génération de numéros séquentiels configurables (matricule, reçu).

Le format est stocké par établissement dans `PlatformSettings`. Jetons pris en
charge :
  {AAAA}      → année courante (4 chiffres)
  {AA}        → année courante (2 chiffres)
  {SEQ}       → compteur séquentiel
  {SEQ:0004}  → compteur zéro-préfixé sur la largeur indiquée

Le compteur est propre à chaque établissement. L'unicité globale (contrainte
`unique=True` en base) est garantie en incrémentant le compteur jusqu'à
obtenir une valeur libre.
"""
import re
import uuid
from datetime import date

from django.db import transaction

DEFAULT_MATRICULE_FORMAT = 'ELV-{SEQ:0004}'
DEFAULT_RECEIPT_FORMAT = 'REC-{AAAA}-{SEQ:0004}'

_SEQ_RE = re.compile(r'\{SEQ(?::(0*\d+))?\}')


def render_number(fmt, seq):
    """Rend un format en remplaçant les jetons par leurs valeurs."""
    today = date.today()

    def _seq(match):
        pad = match.group(1)
        return str(seq).zfill(len(pad)) if pad else str(seq)

    result = _SEQ_RE.sub(_seq, fmt or '')
    result = result.replace('{AAAA}', str(today.year))
    result = result.replace('{AA}', f'{today.year % 100:02d}')
    return result


def _next(kind, ecole):
    """Retourne la prochaine valeur libre pour `matricule` ou `receipt`."""
    from apps.reports.models import PlatformSettings

    if kind == 'matricule':
        from apps.students.models import Student
        model, field, counter_field = Student, 'matricule', 'matricule_counter'
        default_fmt = DEFAULT_MATRICULE_FORMAT
        fmt_attr = 'matricule_format'
    else:
        from apps.payments.models import Payment
        model, field, counter_field = Payment, 'receipt_number', 'receipt_counter'
        default_fmt = DEFAULT_RECEIPT_FORMAT
        fmt_attr = 'receipt_format'

    with transaction.atomic():
        base = PlatformSettings.get_solo(ecole=ecole)
        ps = PlatformSettings.objects.select_for_update().get(pk=base.pk)
        fmt = getattr(ps, fmt_attr, '') or default_fmt

        for _ in range(2000):
            seq = getattr(ps, counter_field) + 1
            setattr(ps, counter_field, seq)
            value = render_number(fmt, seq)
            if value and not model.objects.filter(**{field: value}).exists():
                ps.save(update_fields=[counter_field])
                return value
        # Filet de sécurité : jamais atteint en pratique
        ps.save(update_fields=[counter_field])

    prefix = 'ELV' if kind == 'matricule' else 'REC'
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"


def next_matricule(ecole=None):
    return _next('matricule', ecole)


def next_receipt_number(ecole=None):
    return _next('receipt', ecole)
