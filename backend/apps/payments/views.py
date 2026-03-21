from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum, Count, Q
from apps.users.permissions import IsAdmin, IsAdminOrReadOnly
from .models import Payment
from .serializers import PaymentSerializer


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.select_related('student', 'student__classe', 'recorded_by').all()
    serializer_class = PaymentSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ['student', 'status', 'payment_type', 'student__classe']
    search_fields = ['student__first_name', 'student__last_name', 'receipt_number']
    ordering_fields = ['payment_date', 'amount']

    def perform_create(self, serializer):
        serializer.save(recorded_by=self.request.user)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        qs = Payment.objects.all()
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
        payments = self.queryset.filter(student_id=student_id)
        total = payments.filter(status='PAID').aggregate(total=Sum('amount'))['total'] or 0
        return Response({
            'payments': PaymentSerializer(payments, many=True).data,
            'total_paid': total,
        })
