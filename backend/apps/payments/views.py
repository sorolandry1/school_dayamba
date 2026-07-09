from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum, Count, Q
from apps.users.permissions import (
    IsAdmin, IsAdminOrReadOnly, IsCommunicationStaff, IsCashStaff, IsCashManager,
)
from apps.users.mixins import EcoleScopedMixin
from utils.sms_service import send_sms
from utils.email_service import send_bulk_email
from .models import Payment, Expense
from .serializers import PaymentSerializer, ExpenseSerializer


def _ecole_id(request):
    u = getattr(request, 'user', None)
    if u and u.is_authenticated and u.role != 'ADMIN':
        return getattr(u, 'ecole_id', None)
    eid = request.query_params.get('ecole')
    return int(eid) if eid and str(eid).isdigit() else None


class PaymentViewSet(EcoleScopedMixin, viewsets.ModelViewSet):
    queryset = Payment.objects.select_related('student', 'student__classe', 'recorded_by').all()
    serializer_class = PaymentSerializer
    permission_classes = [IsCashStaff]
    filterset_fields = ['student', 'status', 'payment_type', 'student__classe']
    search_fields = ['student__first_name', 'student__last_name', 'receipt_number']
    ordering_fields = ['payment_date', 'amount']

    def _notify_parent(self, payment):
        student = payment.student
        if not student.parent_phone:
            return
        if payment.status == 'OVERDUE':
            msg = (
                f"Bonjour, le paiement de {int(payment.amount):,} FCFA "
                f"({payment.get_payment_type_display()}) pour votre enfant "
                f"{student.full_name} est en retard. "
                f"Merci de régulariser rapidement."
            )
            send_sms(student.parent_phone, msg)
        elif payment.status == 'PAID':
            msg = (
                f"Bonjour, le paiement de {int(payment.amount):,} FCFA "
                f"({payment.get_payment_type_display()}) pour {student.full_name} "
                f"a bien été reçu. Reçu N°: {payment.receipt_number}. Merci."
            )
            send_sms(student.parent_phone, msg)

    def perform_create(self, serializer):
        payment = serializer.save(recorded_by=self.request.user, **self.ecole_save_kwargs())
        self._notify_parent(payment)
        from apps.users.models import notify
        notify('PAYMENT', f"Paiement reçu : {int(payment.amount):,} FCFA — {payment.student.full_name}".replace(',', ' '))

    def perform_update(self, serializer):
        payment = serializer.save()
        self._notify_parent(payment)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        qs = self.get_queryset()  # déjà filtré par école
        classe_id = request.query_params.get('classe_id')
        if classe_id:
            qs = qs.filter(student__classe_id=classe_id)

        stats = {
            'total_collected': qs.filter(status='PAID').aggregate(
                total=Sum('amount'))['total'] or 0,
            'total_pending': qs.filter(status='PENDING').aggregate(
                total=Sum('amount'))['total'] or 0,
            'total_overdue': qs.filter(status='OVERDUE').aggregate(
                total=Sum('amount'))['total'] or 0,
            'count_paid': qs.filter(status='PAID').count(),
            'count_pending': qs.filter(status='PENDING').count(),
            'count_overdue': qs.filter(status='OVERDUE').count(),
        }
        return Response(stats)

    @action(detail=False, methods=['get'])
    def student_history(self, request):
        student_id = request.query_params.get('student_id')
        if not student_id:
            return Response({'error': 'student_id requis'}, status=400)
        payments = self.get_queryset().filter(student_id=student_id)
        total = payments.filter(status='PAID').aggregate(total=Sum('amount'))['total'] or 0
        return Response({
            'payments': PaymentSerializer(payments, many=True).data,
            'total_paid': total,
        })

    @action(detail=False, methods=['get'])
    def pension(self, request):
        """Situation de pension d'un élève : échéancier, remise, répartition
        automatique des versements sur les tranches et reste à payer."""
        from apps.students.models import Student
        from .pension import build_pension_situation
        student_id = request.query_params.get('student_id')
        if not student_id:
            return Response({'error': 'student_id requis'}, status=400)
        try:
            student = Student.objects.select_related('classe').get(id=student_id)
        except Student.DoesNotExist:
            return Response({'error': 'Élève non trouvé.'}, status=404)
        eid = _ecole_id(request)
        if eid and student.ecole_id and student.ecole_id != eid:
            return Response({'error': 'Élève non trouvé.'}, status=404)
        return Response(build_pension_situation(student))


class ExpenseViewSet(EcoleScopedMixin, viewsets.ModelViewSet):
    queryset = Expense.objects.select_related('recorded_by').all()
    serializer_class = ExpenseSerializer
    permission_classes = [IsCashManager]
    filterset_fields = ['category']
    search_fields = ['label', 'description']
    ordering_fields = ['date', 'amount']

    def perform_create(self, serializer):
        serializer.save(recorded_by=self.request.user, **self.ecole_save_kwargs())

    @action(detail=False, methods=['get'])
    def stats(self, request):
        from django.db.models import Sum as _Sum
        qs = self.get_queryset()
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)

        total = qs.aggregate(t=_Sum('amount'))['t'] or 0
        by_category = list(
            qs.values('category')
            .annotate(total=_Sum('amount'), count=Count('id'))
            .order_by('-total')
        )
        # Add display labels
        cat_map = {k: v for k, v in Expense.Category.choices}
        for row in by_category:
            row['category_label'] = cat_map.get(row['category'], row['category'])

        return Response({'total': float(total), 'by_category': by_category})


class BroadcastSMSView(viewsets.ViewSet):
    """Send SMS to all parents of a given class or all active students."""
    permission_classes = [IsCommunicationStaff]

    @action(detail=False, methods=['post'])
    def send(self, request):
        message = request.data.get('message', '').strip()
        classe_id = request.data.get('classe_id')

        if not message:
            return Response({'error': 'Le message est requis.'}, status=400)

        from apps.students.models import Student
        eid = _ecole_id(request)
        students_qs = Student.objects.filter(is_active=True, parent_phone__isnull=False).exclude(parent_phone='')
        if classe_id:
            students_qs = students_qs.filter(classe_id=classe_id)
        if eid:
            students_qs = students_qs.filter(ecole_id=eid)

        sent = 0
        failed = 0
        for student in students_qs:
            ok = send_sms(student.parent_phone, message)
            if ok:
                sent += 1
            else:
                failed += 1

        from apps.users.models import log_activity
        log_activity(
            request.user, 'LOGIN',
            f"Broadcast SMS envoyé à {sent} parents (classe_id={classe_id or 'tous'})",
            request
        )

        return Response({
            'sent': sent,
            'failed': failed,
            'total': sent + failed,
            'message': f'{sent} SMS envoyés avec succès.',
        })

    @action(detail=False, methods=['post'])
    def email(self, request):
        """Send broadcast email to all parents of a class or all active students."""
        subject = request.data.get('subject', '').strip()
        body = request.data.get('message', '').strip()
        classe_id = request.data.get('classe_id')

        if not subject or not body:
            return Response({'error': 'Sujet et message requis.'}, status=400)

        from apps.students.models import Student
        eid = _ecole_id(request)
        students_qs = (
            Student.objects
            .filter(is_active=True)
            .exclude(parent_email__isnull=True)
            .exclude(parent_email='')
        )
        if classe_id:
            students_qs = students_qs.filter(classe_id=classe_id)
        if eid:
            students_qs = students_qs.filter(ecole_id=eid)

        recipients = [
            {
                'to': s.parent_email,
                'parent_name': s.parent_name or 'Parent',
                'subject': subject,
                'body': body,
            }
            for s in students_qs
        ]

        result = send_bulk_email(recipients, template='custom')

        from apps.users.models import log_activity
        log_activity(
            request.user, 'LOGIN',
            f"Broadcast email envoyé à {result['sent']} parents (classe_id={classe_id or 'tous'})",
            request
        )

        return Response({
            **result,
            'message': f"{result['sent']} email(s) envoyé(s) avec succès.",
        })
