from rest_framework import serializers
from .models import Grade


class GradeSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    normalized_value = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)

    class Meta:
        model = Grade
        fields = ['id', 'student', 'student_name', 'subject', 'subject_name',
                  'value', 'max_value', 'normalized_value', 'period', 'type_evaluation',
                  'comment', 'date', 'created_by', 'created_by_name', 'updated_at']
        read_only_fields = ['created_by', 'date', 'updated_at']

    def get_student_name(self, obj):
        return obj.student.full_name

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name()
        return None


class GradeCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Grade
        fields = ['student', 'subject', 'value', 'max_value', 'period', 'type_evaluation', 'comment']

    def validate_value(self, value):
        if value < 0:
            raise serializers.ValidationError("La note ne peut pas être négative.")
        return value

    def validate(self, data):
        if data['value'] > data.get('max_value', 20):
            raise serializers.ValidationError("La note ne peut pas dépasser la valeur maximale.")
        return data


class BulkGradeSerializer(serializers.Serializer):
    grades = GradeCreateSerializer(many=True)


class StudentAverageSerializer(serializers.Serializer):
    student_id = serializers.IntegerField()
    student_name = serializers.CharField()
    subject_name = serializers.CharField()
    average = serializers.DecimalField(max_digits=5, decimal_places=2)
    grade_count = serializers.IntegerField()
