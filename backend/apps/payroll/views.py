from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum, Count
from django.db.models.functions import TruncMonth
from django.http import HttpResponse

from apps.users.permissions import IsCashManager
from apps.users.mixins import EcoleScopedMixin
from .models import AdminStaff, SalaryPayment
from .serializers import AdminStaffSerializer, SalaryPaymentSerializer


class AdminStaffViewSet(EcoleScopedMixin, viewsets.ModelViewSet):
    """Gestion du personnel administratif (poste, coordonnées, salaire de base)."""
    queryset = AdminStaff.objects.all()
    serializer_class = AdminStaffSerializer
    permission_classes = [IsCashManager]
    filterset_fields = ['is_active', 'position']
    search_fields = ['first_name', 'last_name', 'position']
    ordering_fields = ['last_name', 'base_salary', 'created_at']

    def perform_create(self, serializer):
        serializer.save(**self.ecole_save_kwargs())


class SalaryPaymentViewSet(EcoleScopedMixin, viewsets.ModelViewSet):
    """Versements de salaire. Chaque enregistrement génère une dépense liée
    (catégorie SALAIRES) intégrée au bilan financier."""
    queryset = SalaryPayment.objects.select_related(
        'teacher', 'teacher__user', 'admin_staff', 'recorded_by', 'expense'
    ).all()
    serializer_class = SalaryPaymentSerializer
    permission_classes = [IsCashManager]
    filterset_fields = ['staff_type', 'teacher', 'admin_staff', 'method', 'period']
    search_fields = ['period', 'notes']
    ordering_fields = ['payment_date', 'amount']

    def perform_create(self, serializer):
        salary = serializer.save(recorded_by=self.request.user, **self.ecole_save_kwargs())
        salary.sync_expense()
        from apps.users.models import notify
        notify('PAYMENT', f"Salaire versé : {int(salary.amount):,} FCFA — {salary.employee_name}".replace(',', ' '))

    def perform_update(self, serializer):
        salary = serializer.save()
        salary.sync_expense()

    def perform_destroy(self, instance):
        # La suppression déclenche le signal qui retire la dépense liée
        instance.delete()

    @action(detail=True, methods=['get'])
    def payslip(self, request, pk=None):
        """Fiche de paie PDF individuelle."""
        from utils.pdf_generator import generate_payslip_pdf
        salary = self.get_object()
        pdf = generate_payslip_pdf(salary)
        response = HttpResponse(pdf, content_type='application/pdf')
        response['Content-Disposition'] = (
            f'attachment; filename="fiche_paie_{salary.period}_{salary.employee_name}.pdf"'
        )
        return response

    @action(detail=False, methods=['get'])
    def stats(self, request):
        qs = self.get_queryset()
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        if date_from:
            qs = qs.filter(payment_date__gte=date_from)
        if date_to:
            qs = qs.filter(payment_date__lte=date_to)

        total = float(qs.aggregate(t=Sum('amount'))['t'] or 0)
        by_type = list(
            qs.values('staff_type')
            .annotate(total=Sum('amount'), count=Count('id'))
            .order_by('-total')
        )
        type_map = dict(SalaryPayment.StaffType.choices)
        for row in by_type:
            row['staff_type_label'] = type_map.get(row['staff_type'], row['staff_type'])
            row['total'] = float(row['total'] or 0)

        by_month = list(
            qs.annotate(m=TruncMonth('payment_date')).values('m')
            .annotate(total=Sum('amount'), count=Count('id')).order_by('m')
        )
        monthly = [{
            'period': r['m'].strftime('%m/%Y') if r['m'] else '—',
            'total': float(r['total'] or 0),
            'count': r['count'],
        } for r in by_month]

        return Response({
            'total': total,
            'count': qs.count(),
            'by_type': by_type,
            'monthly': monthly,
        })
