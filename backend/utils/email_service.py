"""Email notification service.

Uses Django's built-in email backend (configured in settings.py).
In development, EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
logs emails to the console instead of sending them.

Usage:
    from utils.email_service import send_email, send_bulk_email

    send_email(
        to='parent@example.com',
        subject='Résultats scolaires',
        template='results',
        context={'student_name': 'Kone Ibrahim', 'average': 14.5},
    )
"""
import logging
from django.core.mail import send_mail, send_mass_mail
from django.conf import settings
from django.template.loader import render_to_string
from django.utils.html import strip_tags

logger = logging.getLogger('apps')

# ── Email templates (plain-text, no external template files required) ─────────

_TEMPLATES = {
    'results': {
        'subject': 'Résultats scolaires — {student_name}',
        'body': (
            "Bonjour {parent_name},\n\n"
            "Veuillez trouver ci-dessous les résultats de {student_name} "
            "pour la période en cours.\n\n"
            "Moyenne générale : {average}/20\n"
            "Rang : {rank}/{total}\n\n"
            "Pour consulter le bulletin complet, connectez-vous à SchoolPro.\n\n"
            "Cordialement,\n{school_name}"
        ),
    },
    'absence': {
        'subject': 'Absence signalée — {student_name}',
        'body': (
            "Bonjour {parent_name},\n\n"
            "Nous vous informons que {student_name} a été marqué(e) absent(e) "
            "le {date}.\n\n"
            "Si cette absence est justifiée, merci de fournir un justificatif "
            "à l'administration.\n\n"
            "Cordialement,\n{school_name}"
        ),
    },
    'payment_reminder': {
        'subject': 'Rappel de paiement — {student_name}',
        'body': (
            "Bonjour {parent_name},\n\n"
            "Nous vous rappelons qu'un paiement est en attente pour {student_name}.\n\n"
            "Montant dû : {amount} FCFA\n"
            "Échéance : {due_date}\n\n"
            "Merci de régulariser votre situation dès que possible.\n\n"
            "Cordialement,\n{school_name}"
        ),
    },
    'meeting': {
        'subject': 'Convocation — Réunion parents-professeurs',
        'body': (
            "Bonjour {parent_name},\n\n"
            "Vous êtes convoqué(e) à une réunion parents-professeurs le "
            "{date} à {time}.\n\n"
            "Lieu : {location}\n"
            "Ordre du jour : {agenda}\n\n"
            "Votre présence est fortement souhaitée.\n\n"
            "Cordialement,\n{school_name}"
        ),
    },
    'custom': {
        'subject': '{subject}',
        'body': '{body}',
    },
}

_DEFAULT_SCHOOL = getattr(settings, 'SCHOOL_NAME', 'SchoolPro')


def _render(template_key: str, context: dict) -> tuple[str, str]:
    """Return (subject, body) rendered with context."""
    tpl = _TEMPLATES.get(template_key, _TEMPLATES['custom'])
    ctx = {'school_name': _DEFAULT_SCHOOL, **context}
    subject = tpl['subject'].format(**ctx)
    body = tpl['body'].format(**ctx)
    return subject, body


def send_email(to: str, template: str = 'custom', context: dict = None,
               subject: str = '', body: str = '') -> bool:
    """Send a single transactional email.

    Args:
        to:       Recipient email address.
        template: Key from _TEMPLATES dict.
        context:  Variables for template rendering.
        subject:  Override subject (used only with template='custom').
        body:     Override body   (used only with template='custom').

    Returns True on success, False on failure.
    """
    if not to:
        logger.warning("Email non envoyé: destinataire manquant")
        return False

    ctx = context or {}
    if template == 'custom':
        ctx.setdefault('subject', subject)
        ctx.setdefault('body', body)

    try:
        rendered_subject, rendered_body = _render(template, ctx)
        from_email = settings.DEFAULT_FROM_EMAIL
        send_mail(
            subject=rendered_subject,
            message=rendered_body,
            from_email=from_email,
            recipient_list=[to],
            fail_silently=False,
        )
        logger.info("Email envoyé à %s (template=%s)", to, template)
        return True
    except Exception as exc:
        logger.error("Erreur email à %s: %s", to, exc)
        return False


def send_bulk_email(recipients: list[dict], template: str = 'custom') -> dict:
    """Send the same template email to multiple recipients.

    Args:
        recipients: List of dicts, each with 'to' key and template context keys.
        template:   Template key.

    Returns:
        {'sent': int, 'failed': int, 'total': int}
    """
    if not recipients:
        return {'sent': 0, 'failed': 0, 'total': 0}

    messages = []
    failed = 0
    from_email = settings.DEFAULT_FROM_EMAIL

    for r in recipients:
        to = r.get('to')
        if not to:
            failed += 1
            continue
        try:
            subject, body = _render(template, {**r})
            messages.append((subject, body, from_email, [to]))
        except KeyError as exc:
            logger.warning("Template render error for %s: %s", to, exc)
            failed += 1

    sent = 0
    if messages:
        try:
            sent = send_mass_mail(messages, fail_silently=False)
        except Exception as exc:
            logger.error("Erreur send_mass_mail: %s", exc)
            failed += len(messages)

    total = len(recipients)
    logger.info("Bulk email: %d/%d envoyés", sent, total)
    return {'sent': sent, 'failed': failed + (len(messages) - sent), 'total': total}
