from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.users.permissions import IsAdmin, IsAdminOrReadOnly
from utils.qr_generator import generate_qr_for_student
from .models import Student
from .serializers import StudentListSerializer, StudentDetailSerializer, StudentCreateSerializer


class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.select_related('classe', 'classe__level').all()
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ['classe', 'payment_status', 'is_active', 'gender']
    search_fields = ['first_name', 'last_name', 'matricule', 'parent_phone']
    ordering_fields = ['last_name', 'enrolled_date']

    def get_serializer_class(self):
        if self.action == 'list':
            return StudentListSerializer
        if self.action == 'create':
            return StudentCreateSerializer
        return StudentDetailSerializer

    def perform_create(self, serializer):
        student = serializer.save()
        generate_qr_for_student(student)

    @action(detail=True, methods=['post'])
    def generate_qr(self, request, pk=None):
        student = self.get_object()
        generate_qr_for_student(student)
        return Response({
            'message': 'QR Code généré avec succès.',
            'qr_code_data': student.qr_code_data
        })

    @action(detail=False, methods=['get'])
    def by_class(self, request):
        classe_id = request.query_params.get('classe_id')
        if not classe_id:
            return Response({'error': 'classe_id requis'}, status=status.HTTP_400_BAD_REQUEST)
        students = self.queryset.filter(classe_id=classe_id)
        serializer = StudentListSerializer(students, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        total = Student.objects.filter(is_active=True).count()
        by_gender = {
            'male': Student.objects.filter(is_active=True, gender='M').count(),
            'female': Student.objects.filter(is_active=True, gender='F').count(),
        }
        by_payment = {
            'paid': Student.objects.filter(payment_status='PAID').count(),
            'pending': Student.objects.filter(payment_status='PENDING').count(),
            'overdue': Student.objects.filter(payment_status='OVERDUE').count(),
        }
        return Response({
            'total': total,
            'by_gender': by_gender,
            'by_payment': by_payment,
        })
