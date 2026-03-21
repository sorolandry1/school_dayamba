from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.users.permissions import IsAdmin, IsAdminOrReadOnly
from .models import Teacher
from .serializers import TeacherSerializer


class TeacherViewSet(viewsets.ModelViewSet):
    queryset = Teacher.objects.select_related('user').all()
    serializer_class = TeacherSerializer
    permission_classes = [IsAdminOrReadOnly]
    search_fields = ['user__first_name', 'user__last_name', 'speciality']

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def me(self, request):
        try:
            teacher = Teacher.objects.get(user=request.user)
            return Response(TeacherSerializer(teacher).data)
        except Teacher.DoesNotExist:
            return Response({'error': 'Profil professeur non trouvé.'}, status=404)

    @action(detail=True, methods=['get'])
    def classes(self, request, pk=None):
        teacher = self.get_object()
        classes = set()
        for subject in teacher.subjects.select_related('classe').all():
            classes.add(subject.classe)
        from apps.classes.serializers import ClasseSerializer
        return Response(ClasseSerializer(list(classes), many=True).data)
