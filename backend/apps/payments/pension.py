"""Situation de pension d'un élève : répartition automatique des versements
sur les tranches de l'échéancier de la classe.

La remise éventuelle de l'élève réduit le total dû ; elle est imputée sur les
dernières tranches (l'élève finit de payer plus tôt). Les versements déjà
encaissés sont répartis dans l'ordre chronologique des tranches.
"""
from datetime import date

from django.db.models import Sum


def _tranche_status(allocated, effective):
    if effective <= 0:
        return 'PAID'
    if allocated >= effective:
        return 'PAID'
    if allocated > 0:
        return 'PARTIAL'
    return 'PENDING'


def build_pension_situation(student):
    """Retourne un dict décrivant la situation de pension de l'élève.

    Clés : tuition, discount_amount, net_due, total_paid, reste,
    next_due_date, tranches[] (label, amount, effective_amount, allocated,
    remaining, status, due_date, overdue).
    """
    tuition = student.tuition_fee
    discount = student.discount_amount(tuition)
    net_due = student.net_tuition

    total_paid = float(
        student.payments.filter(status__in=['PAID', 'PARTIAL'])
        .aggregate(t=Sum('amount'))['t'] or 0
    )

    tranches_qs = []
    if student.classe_id:
        tranches_qs = list(student.classe.tranches.all())

    today = date.today()
    remaining_paid = total_paid
    cumulative = 0.0
    result_tranches = []
    next_due_date = None

    for tr in tranches_qs:
        amount = float(tr.amount or 0)
        # Portion réellement due après remise (la remise ronge les dernières tranches)
        effective = max(0.0, min(amount, net_due - cumulative))
        allocated = max(0.0, min(effective, remaining_paid))
        remaining_paid = max(0.0, remaining_paid - allocated)
        status = _tranche_status(allocated, effective)
        remaining_amount = max(0.0, round(effective - allocated, 2))
        overdue = bool(
            tr.due_date and tr.due_date < today and status != 'PAID' and effective > 0
        )
        if status != 'PAID' and effective > 0 and next_due_date is None:
            next_due_date = tr.due_date
        result_tranches.append({
            'id': tr.id,
            'label': tr.label,
            'amount': round(amount, 2),
            'effective_amount': round(effective, 2),
            'allocated': round(allocated, 2),
            'remaining': remaining_amount,
            'status': status,
            'due_date': tr.due_date.isoformat() if tr.due_date else None,
            'overdue': overdue,
        })
        cumulative += amount

    reste = max(0.0, round(net_due - total_paid, 2))

    return {
        'student_id': student.id,
        'student_name': student.full_name,
        'classe_name': student.classe.name if student.classe else None,
        'tuition': round(tuition, 2),
        'discount_type': student.discount_type,
        'discount_value': float(student.discount_value or 0),
        'discount_reason': student.discount_reason,
        'discount_amount': round(discount, 2),
        'net_due': round(net_due, 2),
        'total_paid': round(total_paid, 2),
        'reste': reste,
        'next_due_date': next_due_date.isoformat() if next_due_date else None,
        'tranches': result_tranches,
    }
