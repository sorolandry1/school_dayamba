"""WhatsApp notification service using Twilio WhatsApp Business API.

Twilio routes WhatsApp messages through its sandbox (dev) or a verified
business number (production).

Production setup:
  1. Apply for a WhatsApp Business number on Twilio Console.
  2. Set TWILIO_WHATSAPP_FROM to your approved number, e.g. 'whatsapp:+15005550006'
  3. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.

Development (sandbox):
  - Join the sandbox by sending 'join <sandbox-keyword>' from your phone
    to the Twilio sandbox number (+14155238886).
  - TWILIO_WHATSAPP_FROM defaults to 'whatsapp:+14155238886'.

Usage:
    from utils.whatsapp_service import send_whatsapp
    send_whatsapp('+22670000000', 'Votre enfant est arrivé à 08:05.')
"""
import logging
from django.conf import settings

logger = logging.getLogger('apps')

# Twilio sandbox / production WhatsApp sender number
_WHATSAPP_FROM = getattr(
    settings, 'TWILIO_WHATSAPP_FROM',
    'whatsapp:+14155238886'   # Twilio sandbox default
)


def _normalize_phone(phone: str) -> str:
    """Return E.164 phone with whatsapp: prefix."""
    phone = phone.strip()
    if not phone.startswith('+'):
        phone = f'+226{phone}'   # Default: Burkina Faso
    if not phone.startswith('whatsapp:'):
        phone = f'whatsapp:{phone}'
    return phone


def send_whatsapp(phone_number: str, message: str) -> bool:
    """Send a WhatsApp message to a phone number.

    Falls back to logging in development mode (no Twilio credentials).

    Args:
        phone_number: Recipient phone, with or without country code.
        message:      Plain-text message body (max ~1600 chars).

    Returns True on success, False on failure.
    """
    if not phone_number:
        logger.warning("WhatsApp non envoyé: numéro manquant")
        return False

    to = _normalize_phone(phone_number)

    sid = getattr(settings, 'TWILIO_ACCOUNT_SID', '')
    token = getattr(settings, 'TWILIO_AUTH_TOKEN', '')

    if sid and token:
        try:
            from twilio.rest import Client
            client = Client(sid, token)
            client.messages.create(
                body=message,
                from_=_WHATSAPP_FROM,
                to=to,
            )
            logger.info("WhatsApp envoyé à %s", to)
            return True
        except Exception as exc:
            logger.error("Erreur WhatsApp à %s: %s", to, exc)
            return False
    else:
        # Dev mode — log message without sending
        logger.info("[DEV WhatsApp] To: %s | %s", to, message)
        return True


def send_whatsapp_template(phone_number: str, template_key: str,
                           context: dict) -> bool:
    """Send a pre-formatted WhatsApp message using a local template.

    Twilio Content API / approved templates can be wired here later.
    For now, renders and sends as plain text.

    Available templates:
        arrival   — Student check-in notification
        departure — Student check-out notification
        absence   — Daily absence alert
        payment   — Payment reminder
        results   — Grade/average summary
    """
    _TEMPLATES = {
        'arrival': (
            "Bonjour {parent_name},\n"
            "Votre enfant *{student_name}* est arrivé à l'école à *{time}*.\n"
            "Bonne journée ! 🎒"
        ),
        'departure': (
            "Bonjour {parent_name},\n"
            "*{student_name}* a quitté l'école à *{time}*.\n"
            "Bonne soirée ! 👋"
        ),
        'absence': (
            "⚠️ Bonjour {parent_name},\n"
            "Votre enfant *{student_name}* a été absent(e) ce {date}.\n"
            "Merci de contacter l'établissement si nécessaire."
        ),
        'payment': (
            "💳 Rappel de paiement\n"
            "Bonjour {parent_name}, un paiement est en attente pour "
            "*{student_name}*.\n"
            "Montant : *{amount} FCFA* — Échéance : {due_date}.\n"
            "Merci de régulariser votre situation."
        ),
        'results': (
            "📊 Résultats scolaires\n"
            "Bonjour {parent_name},\n"
            "Moyenne de *{student_name}* : *{average}/20* — Rang : {rank}/{total}.\n"
            "Consultez le bulletin complet sur SchoolPro."
        ),
    }

    template = _TEMPLATES.get(template_key)
    if not template:
        logger.warning("WhatsApp template inconnu: %s", template_key)
        return False

    try:
        message = template.format(**context)
    except KeyError as exc:
        logger.error("WhatsApp template render error (%s): %s", template_key, exc)
        return False

    return send_whatsapp(phone_number, message)
