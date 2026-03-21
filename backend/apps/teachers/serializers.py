from rest_framework import serializers
from .models import Teacher


class TeacherSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    subjects = serializers.SerializerMethodField()

    class Meta:
        model = Teacher
        fields = ['id', 'user', 'username', 'first_name', 'last_name',
                  'email', 'full_name', 'phone', 'speciality', 'hire_date', 'subjects']

    def get_subjects(self, obj):
        from apps.subjects.serializers import SubjectSerializer
        return SubjectSerializer(obj.subjects.all(), many=True).data
