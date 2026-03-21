from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.users.permissions import IsAdmin, IsAdminOrReadOnly
from .models import AcademicYear, Level, Classe
from .serializers import (
    AcademicYearSerializer, LevelSerializer,
    ClasseSerializer, ClasseDetailSerializer
)


class AcademicYearViewSet(viewsets.ModelViewSet):
    queryset = AcademicYear.objects.all()
    serializer_class = AcademicYearSerializer
    permission_classes = [IsAdminOrReadOnly]

    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def set_current(self, request, pk=None):
        year = self.get_object()
        year.is_current = True
        year.save()
        return Response({'message': f'{year.name} est maintenant l\'année courante.'})


class LevelViewSet(viewsets.ModelViewSet):
    queryset = Level.objects.all()
    serializer_class = LevelSerializer
    permission_classes = [IsAdminOrReadOnly]
    pagination_class = None


class ClasseViewSet(viewsets.ModelViewSet):
    queryset = Classe.objects.select_related('level', 'academic_year').all()
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ['level', 'academic_year']
    search_fields = ['name']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ClasseDetailSerializer
        return ClasseSerializer

    @action(detail=False, methods=['get'])
    def current_year(self, request):
        """Get classes for the current academic year."""
        current = AcademicYear.objects.filter(is_current=True).first()
        if not current:
            return Response([])
        classes = self.queryset.filter(academic_year=current)
        serializer = ClasseSerializer(classes, many=True)
        return Response(serializer.data)
