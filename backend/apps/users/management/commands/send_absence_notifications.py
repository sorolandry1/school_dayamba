"""
Management command: send_absence_notifications
Usage: python manage.py send_absence_notifications [--date YYYY-MM-DD]

Finds all active students with no attendance record (or status=ABSENT) for the
given date and notifies their parents by SMS and/or email.
Run this once at end of school day, e.g. via cron at 18:00.
"""
from datetime import date as dt_date
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.students.models import Student
from apps.attendance.models import Attendance
from utils.sms_service import send_sms
from utils.email_service import send_email
from utils.whatsapp_service import send_whatsapp_template
import logging

logger = logging.getLogger('apps')


class Command(BaseCommand):
    help = 'Envoie des notifications (SMS + email) aux parents des élèves absents'

    def add_arguments(self, parser):
        parser.add_argument(
            '--date',
            type=str,
            default=None,
            help='Date cible YYYY-MM-DD (défaut: aujourd\'hui)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            default=False,
            help='Simule l\'envoi sans envoyer réellement',
        )

    def handle(self, *args, **options):
        raw_date = options['date']
        dry_run = options['dry_run']

        if raw_date:
            try:
                target_date = dt_date.fromisoformat(raw_date)
            except ValueError:
                self.stderr.write(f'Date invalide: {raw_date}. Format attendu: YYYY-MM-DD')
                return
        else:
            target_date = timezone.now().date()

        self.stdout.write(f'Date cible : {target_date}{"  [DRY RUN]" if dry_run else ""}')

        # Students who have an ABSENT record today
        absent_ids = set(
            Attendance.objects
            .filter(date=target_date, status='ABSENT')
            .values_list('student_id', flat=True)
        )

        # Students with no record at all today
        present_ids = set(
            Attendance.objects
            .filter(date=target_date)
            .exclude(status='ABSENT')
            .values_list('student_id', flat=True)
        )

        all_active_ids = set(
            Student.objects.filter(is_active=True).values_list('id', flat=True)
        )

        # Absent = explicitly marked absent OR no record and not present
        no_record_ids = all_active_ids - present_ids - absent_ids
        target_ids = absent_ids | no_record_ids

        students = Student.objects.filter(id__in=target_ids).select_related('classe')

        if not students.exists():
            self.stdout.write(self.style.SUCCESS('Aucun élève absent aujourd\'hui. Rien à envoyer.'))
            return

        self.stdout.write(f'{students.count()} élève(s) absent(s) trouvé(s).')

        sms_sent = sms_failed = email_sent = email_failed = 0

        for student in students:
            date_str = target_date.strftime('%d/%m/%Y')
            sms_msg = (
                f"Bonjour, votre enfant {student.first_name} {student.last_name} "
                f"a été absent(e) ce {date_str}. "
                f"Merci de contacter l'établissement si nécessaire."
            )

            if not dry_run:
                if student.parent_phone:
                    ok = send_sms(student.parent_phone, sms_msg)
                    if ok:
                        sms_sent += 1
                    else:
                        sms_failed += 1
                    # WhatsApp notification (parallel channel)
                    send_whatsapp_template(
                        student.parent_phone, 'absence',
                        {
                            'parent_name': student.parent_name or 'Parent',
                            'student_name': student.full_name,
                            'date': date_str,
                        },
                    )

                parent_email = getattr(student, 'parent_email', None)
                if parent_email:
                    ok = send_email(
                        to=parent_email,
                        template='absence',
                        context={
                            'parent_name': student.parent_name or 'Parent',
                            'student_name': student.full_name,
                            'date': date_str,
                        },
                    )
                    if ok:
                        email_sent += 1
                    else:
                        email_failed += 1
            else:
                self.stdout.write(
                    f'  [DRY] {student.full_name} — SMS: {student.parent_phone or "—"}'
                    f' | Email: {getattr(student, "parent_email", None) or "—"}'
                )

        if not dry_run:
            self.stdout.write(
                self.style.SUCCESS(
                    f'SMS: {sms_sent} envoyé(s), {sms_failed} échoué(s). '
                    f'Email: {email_sent} envoyé(s), {email_failed} échoué(s).'
                )
            )
