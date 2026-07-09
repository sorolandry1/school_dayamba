from rest_framework import serializers
from .models import Student, StudentDocument


class StudentDocumentSerializer(serializers.ModelSerializer):
    category_label = serializers.CharField(source='get_category_display', read_only=True)
    file_url = serializers.SerializerMethodField()
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = StudentDocument
        fields = ['id', 'student', 'category', 'category_label', 'label',
                  'file', 'file_url', 'uploaded_by_name', 'created_at']
        read_only_fields = ['uploaded_by_name', 'created_at']
        extra_kwargs = {'file': {'write_only': True}}

    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.file.url) if request else obj.file.url
        return None

    def get_uploaded_by_name(self, obj):
        return obj.uploaded_by.get_full_name() if obj.uploaded_by else None


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
    tuition_fee = serializers.FloatField(read_only=True)
    net_tuition = serializers.FloatField(read_only=True)
    discount_amount = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = '__all__'

    def get_qr_code_url(self, obj):
        if obj.qr_code:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.qr_code.url)
        return None

    def get_discount_amount(self, obj):
        return obj.discount_amount()


class StudentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Student
        fields = ['first_name', 'last_name', 'date_of_birth', 'birth_place',
                  'nationality', 'gender', 'classe', 'parent_name', 'parent_phone',
                  'parent_email', 'address', 'photo',
                  'discount_type', 'discount_value', 'discount_reason']
