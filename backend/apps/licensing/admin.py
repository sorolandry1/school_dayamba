from django.contrib import admin
from .models import License


@admin.register(License)
class LicenseAdmin(admin.ModelAdmin):
    list_display = ['machine_id', 'plan', 'expires_at', 'is_valid', 'days_left']
    readonly_fields = ['machine_id', 'trial_start', 'created_at', 'updated_at']
