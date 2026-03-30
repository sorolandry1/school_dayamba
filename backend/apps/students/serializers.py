from rest_framework import serializers
from .models import Student


class StudentListSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    classe_name = serializers.CharField(source='classe.name', read_only=True)
    photo_url = serializers.SerializerMethodField()
    qr_code_url = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = ['id', 'first_name', 'last_name', 'full_name', 'matricule',
                  'classe', 'classe_name', 'gender', 'payment_status', 'is_active',
                  'date_of_birth', 'birth_place', 'nationality', 'parent_name',
                  'parent_phone', 'qr_code_data', 'photo_url', 'qr_code_url']

    def get_photo_url(self, obj):
        if obj.photo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.photo.url)
        return None

    def get_qr_code_url(self, obj):
        if obj.qr_code:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.qr_code.url)
        return None


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
        fields = ['first_name', 'last_name', 'date_of_birth', 'birth_place',
                  'nationality', 'gender', 'classe', 'parent_name', 'parent_phone',
                  'parent_email', 'address', 'photo']
