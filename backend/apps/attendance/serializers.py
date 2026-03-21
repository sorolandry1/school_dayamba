from rest_framework import serializers
from .models import Attendance


class AttendanceSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    classe_name = serializers.SerializerMethodField()
    hours_absent = serializers.FloatField(read_only=True)

    class Meta:
        model = Attendance
        fields = ['id', 'student', 'student_name', 'classe_name', 'date',
                  'check_in', 'check_out', 'status', 'hours_absent', 'scanned_by']
        read_only_fields = ['scanned_by']

    def get_student_name(self, obj):
        return obj.student.full_name

    def get_classe_name(self, obj):
        if obj.student.classe:
            return obj.student.classe.name
        return None


class ScanQRSerializer(serializers.Serializer):
    qr_code_data = serializers.CharField()
    scan_type = serializers.ChoiceField(choices=['IN', 'OUT'])
