from rest_framework import serializers
from .models import DocumentTemplate, PlatformSettings


class PlatformSettingsSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()
    ecole_id = serializers.IntegerField(source='ecole_id', read_only=True)

    class Meta:
        model = PlatformSettings
        fields = ['id', 'ecole_id', 'school_name', 'school_year', 'school_type',
                  'bulletin_header', 'logo', 'logo_url',
                  'matricule_format', 'matricule_counter',
                  'receipt_format', 'receipt_counter',
                  'period_system', 'hours_per_day', 'decision_rules', 'updated_at']
        read_only_fields = ['id', 'updated_at', 'ecole_id', 'matricule_counter', 'receipt_counter']
        extra_kwargs = {'logo': {'write_only': True, 'required': False}}

    def get_logo_url(self, obj):
        if obj.logo:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.logo.url) if request else obj.logo.url
        return None


class ReportRequestSerializer(serializers.Serializer):
    student_id = serializers.IntegerField(required=False)
    classe_id = serializers.IntegerField(required=False)
    report_type = serializers.ChoiceField(
        choices=['bulletin', 'attendance', 'payments', 'class_summary'],
        default='bulletin'
    )


class DocumentTemplateSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    ecole_id = serializers.IntegerField(source='ecole_id', read_only=True)
    ecole_name = serializers.CharField(source='ecole.name', read_only=True)

    class Meta:
        model = DocumentTemplate
        fields = [
            'id', 'name', 'document_type', 'style_preset', 'school_type', 'config',
            'ecole_id', 'ecole_name', 'is_default', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by_name', 'created_at', 'updated_at', 'ecole_id', 'ecole_name']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
        return None
