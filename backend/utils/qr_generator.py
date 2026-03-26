"""QR Code generation utility for students."""
import qrcode
import io
import os
from django.conf import settings
from django.core.files.base import ContentFile


def generate_qr_for_student(student):
    """Generate a unique QR code for a student and save it."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(student.qr_code_data)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")

    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)

    filename = f"qr_{student.matricule}.png"
    student.qr_code.save(filename, ContentFile(buffer.read()), save=True)

    return student.qr_code.url


def decode_qr_data(qr_data):
    """Validate QR code data format."""
    if qr_data and ('NOM:' in qr_data or qr_data.startswith('STU-')):
        return qr_data
    return None
