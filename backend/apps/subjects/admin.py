from django.contrib import admin
from .models import Subject

@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ['name', 'coefficient', 'teacher', 'classe']
    list_filter = ['classe', 'teacher']
