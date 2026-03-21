from django.contrib import admin
from .models import Attendance

@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ['student', 'date', 'check_in', 'check_out', 'status']
    list_filter = ['status', 'date', 'student__classe']
    search_fields = ['student__first_name', 'student__last_name']
