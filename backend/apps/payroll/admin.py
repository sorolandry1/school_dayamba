from django.contrib import admin
from .models import AdminStaff, SalaryPayment


@admin.register(AdminStaff)
class AdminStaffAdmin(admin.ModelAdmin):
    list_display = ['full_name', 'position', 'base_salary', 'phone', 'is_active']
    list_filter = ['is_active', 'position']
    search_fields = ['first_name', 'last_name', 'position']


@admin.register(SalaryPayment)
class SalaryPaymentAdmin(admin.ModelAdmin):
    list_display = ['period', 'employee_name', 'staff_type', 'amount', 'method', 'payment_date']
    list_filter = ['staff_type', 'method', 'payment_date']
    search_fields = ['period', 'notes']
