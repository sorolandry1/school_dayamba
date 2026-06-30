from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.users.permissions import IsAdminOrReadOnly
from apps.users.mixins import EcoleScopedMixin
from .models import Subject
from .serializers import SubjectSerializer


class SubjectViewSet(EcoleScopedMixin, viewsets.ModelViewSet):
    queryset = Subject.objects.select_related('teacher', 'teacher__user', 'classe').all()
    serializer_class = SubjectSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ['classe', 'teacher']
    search_fields = ['name']

    def perform_create(self, serializer):
        serializer.save(**self.ecole_save_kwargs())

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def my_subjects(self, request):
        """Get subjects assigned to the current teacher."""
        if request.user.role != 'TEACHER':
            return Response({'error': 'Accès réservé aux professeurs.'}, status=403)
        try:
            teacher = request.user.teacher_profile
            subjects = Subject.objects.filter(teacher=teacher).select_related('classe')
            return Response(SubjectSerializer(subjects, many=True).data)
        except Exception:
            return Response([])
