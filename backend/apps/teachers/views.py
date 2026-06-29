from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.users.permissions import IsAdmin, IsAdminOrReadOnly, IsAdminOrTeacher, IsClasseStaff
from .models import Teacher, LessonLog
from .serializers import TeacherSerializer, LessonLogSerializer


class TeacherViewSet(viewsets.ModelViewSet):
    queryset = Teacher.objects.select_related('user').prefetch_related('classes', 'subjects').all()
    serializer_class = TeacherSerializer
    permission_classes = [IsAdminOrReadOnly]
    search_fields = ['user__first_name', 'user__last_name', 'speciality']

    @action(detail=True, methods=['post'], permission_classes=[IsClasseStaff])
    def assign_classes(self, request, pk=None):
        """Affecte des classes à un professeur (directeur, admin ou éducateur)."""
        teacher = self.get_object()
        from apps.classes.models import Classe
        ids = request.data.get('class_ids', [])
        teacher.classes.set(Classe.objects.filter(id__in=ids))
        from apps.users.models import log_activity
        log_activity(request.user, 'USER_EDIT',
                     f"Classes affectées à {teacher.full_name} ({len(ids)})", request)
        return Response(TeacherSerializer(teacher).data)

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

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def dashboard_stats(self, request):
        """Stats for the teacher's own dashboard."""
        if request.user.role != 'TEACHER':
            return Response({'error': 'Réservé aux professeurs.'}, status=403)
        try:
            teacher = Teacher.objects.get(user=request.user)
        except Teacher.DoesNotExist:
            return Response({'error': 'Profil introuvable.'}, status=404)

        from django.core.cache import cache
        cache_key = f'teacher_dashboard_stats_{teacher.id}'
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        subjects = teacher.subjects.select_related('classe').all()
        classes = list({s.classe for s in subjects if s.classe})

        from apps.students.models import Student
        from apps.grades.models import Grade
        from django.db.models import Count as _Count, Avg as _Avg

        total_students = Student.objects.filter(
            classe__in=classes, is_active=True
        ).count()

        total_grades = Grade.objects.filter(subject__in=subjects).count()

        lesson_count = LessonLog.objects.filter(teacher=teacher).count()

        # Per-subject student + grade count
        subject_stats = []
        for s in subjects:
            sc = Student.objects.filter(classe=s.classe, is_active=True).count() if s.classe else 0
            gc = Grade.objects.filter(subject=s).count()
            avg = Grade.objects.filter(subject=s).aggregate(a=_Avg('value'))['a']
            subject_stats.append({
                'subject_id': s.id,
                'subject_name': s.name,
                'classe_name': s.classe.name if s.classe else '—',
                'student_count': sc,
                'grade_count': gc,
                'average': round(float(avg), 2) if avg else None,
            })

        result = {
            'total_subjects': len(subjects),
            'total_classes': len(classes),
            'total_students': total_students,
            'total_grades': total_grades,
            'lesson_count': lesson_count,
            'subjects': subject_stats,
        }
        cache.set(cache_key, result, 120)  # 2 min TTL
        return Response(result)


class LessonLogViewSet(viewsets.ModelViewSet):
    serializer_class = LessonLogSerializer
    permission_classes = [IsAdminOrTeacher]
    filterset_fields = ['subject', 'date']
    ordering_fields = ['date']

    def get_queryset(self):
        qs = LessonLog.objects.select_related(
            'teacher', 'teacher__user', 'subject', 'subject__classe'
        ).all()
        if self.request.user.role == 'TEACHER':
            try:
                teacher = self.request.user.teacher_profile
                return qs.filter(teacher=teacher)
            except Exception:
                return qs.none()
        return qs

    def perform_create(self, serializer):
        try:
            teacher = self.request.user.teacher_profile
        except Exception:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Profil professeur introuvable.')
        # Verify teacher owns the subject
        subject = serializer.validated_data['subject']
        if self.request.user.role == 'TEACHER' and not teacher.subjects.filter(id=subject.id).exists():
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Vous ne pouvez pas créer une entrée pour une matière qui ne vous appartient pas.')
        serializer.save(teacher=teacher)
