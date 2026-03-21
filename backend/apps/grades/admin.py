from django.contrib import admin
from .models import Grade

@admin.register(Grade)
class GradeAdmin(admin.ModelAdmin):
    list_display = ['student', 'subject', 'value', 'max_value', 'type_evaluation', 'date']
    list_filter = ['type_evaluation', 'subject', 'date']
    search_fields = ['student__first_name', 'student__last_name']
