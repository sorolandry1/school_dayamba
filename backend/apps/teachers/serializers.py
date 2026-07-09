from rest_framework import serializers
from .models import Teacher, LessonLog


class LessonLogSerializer(serializers.ModelSerializer):
    teacher_name = serializers.CharField(source='teacher.full_name', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    classe_name = serializers.CharField(source='subject.classe.name', read_only=True)

    class Meta:
        model = LessonLog
        fields = [
            'id', 'teacher', 'teacher_name', 'subject', 'subject_name', 'classe_name',
            'date', 'topic', 'objectives', 'content_covered', 'homework',
            'progression_percent', 'created_at', 'updated_at',
        ]
        read_only_fields = ['teacher', 'created_at', 'updated_at']


class TeacherSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    subjects = serializers.SerializerMethodField()
    assigned_classes = serializers.SerializerMethodField()
    assigned_class_ids = serializers.SerializerMethodField()

    class Meta:
        model = Teacher
        fields = ['id', 'user', 'username', 'first_name', 'last_name',
                  'email', 'full_name', 'phone', 'speciality', 'hire_date',
                  'base_salary', 'subjects', 'assigned_classes', 'assigned_class_ids']

    def get_subjects(self, obj):
        from apps.subjects.serializers import SubjectSerializer
        return SubjectSerializer(obj.subjects.all(), many=True).data

    def get_assigned_classes(self, obj):
        return [
            {'id': c.id, 'name': c.name, 'level_name': c.level.name if c.level else None}
            for c in obj.classes.select_related('level').all()
        ]

    def get_assigned_class_ids(self, obj):
        return list(obj.classes.values_list('id', flat=True))
