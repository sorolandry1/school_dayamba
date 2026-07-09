from rest_framework import serializers
from .models import AdminStaff, SalaryPayment


class AdminStaffSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = AdminStaff
        fields = ['id', 'first_name', 'last_name', 'full_name', 'position',
                  'phone', 'email', 'base_salary', 'hire_date', 'is_active', 'created_at']
        read_only_fields = ['created_at']


class SalaryPaymentSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(read_only=True)
    employee_position = serializers.CharField(read_only=True)
    staff_type_label = serializers.CharField(source='get_staff_type_display', read_only=True)
    method_label = serializers.CharField(source='get_method_display', read_only=True)
    recorded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = SalaryPayment
        fields = ['id', 'staff_type', 'staff_type_label', 'teacher', 'admin_staff',
                  'employee_name', 'employee_position', 'period', 'amount',
                  'method', 'method_label', 'payment_date', 'notes',
                  'recorded_by', 'recorded_by_name', 'created_at']
        read_only_fields = ['recorded_by', 'created_at']

    def get_recorded_by_name(self, obj):
        return obj.recorded_by.get_full_name() if obj.recorded_by else None

    def validate(self, data):
        staff_type = data.get('staff_type', getattr(self.instance, 'staff_type', None))
        teacher = data.get('teacher', getattr(self.instance, 'teacher', None))
        admin_staff = data.get('admin_staff', getattr(self.instance, 'admin_staff', None))
        if staff_type == SalaryPayment.StaffType.TEACHER:
            if not teacher:
                raise serializers.ValidationError({'teacher': "Sélectionnez un enseignant."})
            data['admin_staff'] = None
        elif staff_type == SalaryPayment.StaffType.ADMIN:
            if not admin_staff:
                raise serializers.ValidationError({'admin_staff': "Sélectionnez un membre du personnel administratif."})
            data['teacher'] = None
        else:
            raise serializers.ValidationError({'staff_type': "Type de personnel invalide."})
        if data.get('amount') is not None and data['amount'] <= 0:
            raise serializers.ValidationError({'amount': "Le montant doit être positif."})
        return data
