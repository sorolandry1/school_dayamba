from django.contrib import admin
from .models import AcademicYear, Level, Classe

@admin.register(AcademicYear)
class AcademicYearAdmin(admin.ModelAdmin):
    list_display = ['name', 'start_date', 'end_date', 'is_current']

@admin.register(Level)
class LevelAdmin(admin.ModelAdmin):
    list_display = ['name', 'order']

@admin.register(Classe)
class ClasseAdmin(admin.ModelAdmin):
    list_display = ['name', 'level', 'academic_year', 'capacity']
    list_filter = ['level', 'academic_year']
