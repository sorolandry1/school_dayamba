from rest_framework import serializers
from .models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    recorded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = ['id', 'student', 'student_name', 'amount', 'payment_type',
                  'status', 'payment_date', 'due_date', 'receipt_number',
                  'notes', 'recorded_by', 'recorded_by_name', 'created_at']
        read_only_fields = ['recorded_by', 'receipt_number', 'created_at']

    def get_student_name(self, obj):
        return obj.student.full_name

    def get_recorded_by_name(self, obj):
        if obj.recorded_by:
            return obj.recorded_by.get_full_name()
        return None
