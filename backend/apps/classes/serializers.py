from rest_framework import serializers
from .models import AcademicYear, Level, Classe, ScheduleEntry


class ScheduleEntrySerializer(serializers.ModelSerializer):
    day_label = serializers.CharField(source='get_day_display', read_only=True)
    classe_name = serializers.CharField(source='classe.name', read_only=True)
    subject_label = serializers.SerializerMethodField()
    teacher_name = serializers.SerializerMethodField()

    class Meta:
        model = ScheduleEntry
        fields = ['id', 'classe', 'classe_name', 'subject', 'subject_name', 'subject_label',
                  'teacher_name', 'room', 'day', 'day_label', 'start_time', 'end_time']

    def get_subject_label(self, obj):
        if obj.subject:
            return obj.subject.name
        return obj.subject_name or '—'

    def get_teacher_name(self, obj):
        if obj.subject and obj.subject.teacher:
            return obj.subject.teacher.full_name
        return None


class AcademicYearSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicYear
        fields = '__all__'


class LevelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Level
        fields = '__all__'


class ClasseSerializer(serializers.ModelSerializer):
    level_name = serializers.CharField(source='level.name', read_only=True)
    academic_year_name = serializers.CharField(source='academic_year.name', read_only=True)
    student_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Classe
        fields = ['id', 'name', 'level', 'level_name', 'academic_year',
                  'academic_year_name', 'capacity', 'tuition_fee', 'student_count']


class ClasseDetailSerializer(ClasseSerializer):
    students = serializers.SerializerMethodField()

    class Meta(ClasseSerializer.Meta):
        fields = ClasseSerializer.Meta.fields + ['students']

    def get_students(self, obj):
        from apps.students.serializers import StudentListSerializer
        return StudentListSerializer(obj.students.all(), many=True).data
