from django.contrib import admin
from .models import Teacher

@admin.register(Teacher)
class TeacherAdmin(admin.ModelAdmin):
    list_display = ['user', 'phone', 'speciality', 'hire_date']
    search_fields = ['user__first_name', 'user__last_name']
