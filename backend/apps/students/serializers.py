from rest_framework import serializers
from .models import Student


class StudentListSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    classe_name = serializers.CharField(source='classe.name', read_only=True)

    class Meta:
        model = Student
        fields = ['id', 'first_name', 'last_name', 'full_name', 'matricule',
                  'classe', 'classe_name', 'gender', 'payment_status', 'is_active',
                  'parent_phone', 'qr_code_data']


class StudentDetailSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    classe_name = serializers.CharField(source='classe.name', read_only=True)
    qr_code_url = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = '__all__'

    def get_qr_code_url(self, obj):
        if obj.qr_code:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.qr_code.url)
        return None


class StudentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Student
        fields = ['first_name', 'last_name', 'date_of_birth', 'gender',
                  'classe', 'parent_name', 'parent_phone', 'parent_email', 'address']
