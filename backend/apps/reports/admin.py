from django.contrib import admin
from .models import DocumentTemplate


@admin.register(DocumentTemplate)
class DocumentTemplateAdmin(admin.ModelAdmin):
    list_display = ['name', 'document_type', 'style_preset', 'is_default', 'created_by', 'updated_at']
    list_filter = ['document_type', 'style_preset', 'is_default']
    search_fields = ['name']
    readonly_fields = ['created_at', 'updated_at']
