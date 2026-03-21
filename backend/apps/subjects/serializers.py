from rest_framework import serializers
from .models import Subject


class SubjectSerializer(serializers.ModelSerializer):
    teacher_name = serializers.SerializerMethodField()
    classe_name = serializers.CharField(source='classe.name', read_only=True)

    class Meta:
        model = Subject
        fields = ['id', 'name', 'coefficient', 'teacher', 'teacher_name', 'classe', 'classe_name']

    def get_teacher_name(self, obj):
        if obj.teacher:
            return obj.teacher.full_name
        return None
