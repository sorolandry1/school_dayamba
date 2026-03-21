from django.contrib import admin
from .models import Student

@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ['matricule', 'last_name', 'first_name', 'classe', 'gender', 'payment_status', 'is_active']
    list_filter = ['classe', 'payment_status', 'gender', 'is_active']
    search_fields = ['first_name', 'last_name', 'matricule']
