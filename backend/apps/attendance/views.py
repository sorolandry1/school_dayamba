from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Count, Q
from apps.users.permissions import IsAttendanceStaff
from apps.users.mixins import EcoleScopedMixin
from apps.students.models import Student
from utils.sms_service import send_sms
from utils.email_service import send_email
from utils.whatsapp_service import send_whatsapp_template
from .models import Attendance
from .serializers import AttendanceSerializer, ScanQRSerializer
import logging
from apps.payments.models import Payment

logger = logging.getLogger('apps')


def _scan_student_info(student):
    """Infos élève renvoyées au scan, avec le **statut de scolarité** (à jour ou
    non) pour l'agent, et l'id pour l'accès au dossier complet (dir./éducateur)."""
    info = {
        'id': student.id,
        'name': student.full_name,
        'matricule': student.matricule,
        'classe': student.classe.name if student.classe else '',
        'photo': student.photo.url if student.photo else None,
    }
    try:
        from apps.payments.pension import build_pension_situation
        situ = build_pension_situation(student)
        reste = situ['reste']
        overdue = any(t.get('overdue') for t in situ.get('tranches', []))
        if reste <= 0:
            statut, label = 'A_JOUR', 'À jour'
        elif overdue:
            statut, label = 'EN_RETARD', 'En retard'
        else:
            statut, label = 'EN_COURS', 'Reste à payer'
        info['scolarite'] = {
            'a_jour': reste <= 0,
            'statut': statut,
            'label': label,
            'reste': reste,
            'total_paid': situ['total_paid'],
            'net_due': situ['net_due'],
            'next_due_date': situ.get('next_due_date'),
            'payment_status': student.payment_status,
        }
    except Exception:
        ps = student.payment_status
        info['scolarite'] = {
            'a_jour': ps == 'PAID',
            'statut': 'A_JOUR' if ps == 'PAID' else ('EN_RETARD' if ps == 'OVERDUE' else 'EN_COURS'),
            'label': student.get_payment_status_display(),
            'payment_status': ps,
        }
    return info


class AttendanceViewSet(EcoleScopedMixin, viewsets.ModelViewSet):
    ecole_lookup = 'student__ecole'
    queryset = Attendance.objects.select_related('student', 'student__classe', 'scanned_by').all()
    serializer_class = AttendanceSerializer
    permission_classes = [IsAttendanceStaff]
    filterset_fields = ['student', 'date', 'status', 'student__classe']
    ordering_fields = ['date', 'check_in']

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def scan(self, request):
        """Process QR code scan for attendance."""
        serializer = ScanQRSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        qr_data = serializer.validated_data['qr_code_data']
        scan_type = serializer.validated_data['scan_type']

        try:
            student = Student.objects.get(qr_code_data=qr_data, is_active=True)
        except Student.DoesNotExist:
            return Response(
                {'error': 'Élève non trouvé ou QR code invalide.'},
                status=status.HTTP_404_NOT_FOUND
            )

        today = timezone.now().date()
        current_time = timezone.now().time()

        if scan_type == 'IN':
            attendance, created = Attendance.objects.get_or_create(
                student=student, date=today,
                defaults={
                    'check_in': current_time,
                    'status': 'PRESENT',
                    'scanned_by': request.user,
                }
            )
            if not created and attendance.check_in:
                return Response(
                    {'warning': 'Présence déjà enregistrée pour aujourd\'hui.',
                     'attendance': AttendanceSerializer(attendance).data,
                     'student': _scan_student_info(student)}
                )

            if not created:
                attendance.check_in = current_time
                attendance.status = 'PRESENT'
                attendance.scanned_by = request.user
                attendance.save()

            # Check if late (after 7:45)
            late_threshold = timezone.datetime.strptime("07:45", "%H:%M").time()
            if current_time > late_threshold:
                attendance.status = 'LATE'
                attendance.save()

            # Notify parent: SMS + WhatsApp + Email
            arrival_msg = (
                f"Bonjour, votre enfant {student.first_name} "
                f"est arrivé à l'école à {current_time.strftime('%H:%M')}. "
                f"Bonne journée."
            )
            if student.parent_phone:
                send_sms(student.parent_phone, arrival_msg)
                send_whatsapp_template(
                    student.parent_phone, 'arrival',
                    {
                        'parent_name': student.parent_name or 'Parent',
                        'student_name': student.full_name,
                        'time': current_time.strftime('%H:%M'),
                    },
                )
            if getattr(student, 'parent_email', None):
                send_email(
                    to=student.parent_email,
                    template='custom',
                    context={
                        'subject': f'Arrivée de {student.first_name} à l\'école',
                        'body': arrival_msg,
                    },
                )

            logger.info(f"Check-in: {student.full_name} à {current_time}")
            from apps.users.models import notify
            notify('SCAN', f"Entrée scannée : {student.full_name} à {current_time.strftime('%H:%M')}")
            return Response({
                'message': f'{student.full_name} - Entrée enregistrée à {current_time.strftime("%H:%M")}',
                'attendance': AttendanceSerializer(attendance).data,
                'student': _scan_student_info(student),
            })

        elif scan_type == 'OUT':
            try:
                attendance = Attendance.objects.get(student=student, date=today)
            except Attendance.DoesNotExist:
                return Response(
                    {'error': 'Aucune entrée enregistrée aujourd\'hui pour cet élève.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            attendance.check_out = current_time
            attendance.save()

            # Notify parent: SMS + WhatsApp + Email on checkout
            departure_msg = (
                f"{student.first_name} a quitté l'école à "
                f"{current_time.strftime('%H:%M')}. Merci."
            )
            if student.parent_phone:
                send_sms(student.parent_phone, departure_msg)
                send_whatsapp_template(
                    student.parent_phone, 'departure',
                    {
                        'parent_name': student.parent_name or 'Parent',
                        'student_name': student.full_name,
                        'time': current_time.strftime('%H:%M'),
                    },
                )
            if getattr(student, 'parent_email', None):
                send_email(
                    to=student.parent_email,
                    template='custom',
                    context={
                        'subject': f'Départ de {student.first_name}',
                        'body': departure_msg,
                    },
                )

            logger.info(f"Check-out: {student.full_name} à {current_time}")
            from apps.users.models import notify
            notify('SCAN', f"Sortie scannée : {student.full_name} à {current_time.strftime('%H:%M')}")
            return Response({
                'message': f'{student.full_name} - Sortie enregistrée à {current_time.strftime("%H:%M")}',
                'attendance': AttendanceSerializer(attendance).data,
                'student': _scan_student_info(student),
            })

    @action(detail=False, methods=['get'])
    def today(self, request):
        """Get today's attendance records."""
        today = timezone.now().date()
        records = self.get_queryset().filter(date=today)
        classe_id = request.query_params.get('classe_id')
        if classe_id:
            records = records.filter(student__classe_id=classe_id)
        return Response(AttendanceSerializer(records, many=True).data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Attendance statistics."""
        classe_id = request.query_params.get('classe_id')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')

        qs = Attendance.objects.all()
        if classe_id:
            qs = qs.filter(student__classe_id=classe_id)
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)

        stats = qs.aggregate(
            total=Count('id'),
            present=Count('id', filter=Q(status='PRESENT')),
            absent=Count('id', filter=Q(status='ABSENT')),
            late=Count('id', filter=Q(status='LATE')),
        )
        return Response(stats)

    @action(detail=False, methods=['get'])
    def student_summary(self, request):
        """Get attendance summary for a student."""
        student_id = request.query_params.get('student_id')
        if not student_id:
            return Response({'error': 'student_id requis'}, status=400)

        records = Attendance.objects.filter(student_id=student_id)
        summary = records.aggregate(
            total_days=Count('id'),
            present=Count('id', filter=Q(status='PRESENT')),
            absent=Count('id', filter=Q(status='ABSENT')),
            late=Count('id', filter=Q(status='LATE')),
        )
        total_hours_absent = sum(
            r.hours_absent for r in records if r.hours_absent
        )
        summary['total_hours_absent'] = round(total_hours_absent, 1)
        return Response(summary)
