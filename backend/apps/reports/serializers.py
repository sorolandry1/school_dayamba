from rest_framework import serializers

class ReportRequestSerializer(serializers.Serializer):
    student_id = serializers.IntegerField(required=False)
    classe_id = serializers.IntegerField(required=False)
    report_type = serializers.ChoiceField(
        choices=['bulletin', 'attendance', 'payments', 'class_summary'],
        default='bulletin'
    )
