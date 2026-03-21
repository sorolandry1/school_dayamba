"""SMS notification service using Twilio."""
import logging
from django.conf import settings

logger = logging.getLogger('apps')


def send_sms(phone_number, message):
    """Send an SMS notification.

    Uses Twilio when credentials are configured,
    otherwise logs the message for development.
    """
    if not phone_number:
        logger.warning("SMS non envoyé: numéro de téléphone manquant")
        return False

    # Clean phone number
    phone = phone_number.strip()
    if not phone.startswith('+'):
        phone = f'+226{phone}'  # Default Burkina Faso country code

    if settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN:
        try:
            from twilio.rest import Client
            client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            client.messages.create(
                body=message,
                from_=settings.TWILIO_PHONE_NUMBER,
                to=phone
            )
            logger.info(f"SMS envoyé à {phone}")
            return True
        except Exception as e:
            logger.error(f"Erreur envoi SMS à {phone}: {str(e)}")
            return False
    else:
        # Development mode: log the message
        logger.info(f"[DEV SMS] To: {phone} | Message: {message}")
        return True
