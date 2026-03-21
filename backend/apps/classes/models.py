from django.db import models


class AcademicYear(models.Model):
    name = models.CharField(max_length=20, unique=True)  # e.g. "2025-2026"
    start_date = models.DateField()
    end_date = models.DateField()
    is_current = models.BooleanField(default=False)

    class Meta:
        db_table = 'academic_years'
        ordering = ['-start_date']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if self.is_current:
            AcademicYear.objects.filter(is_current=True).exclude(pk=self.pk).update(is_current=False)
        super().save(*args, **kwargs)


class Level(models.Model):
    name = models.CharField(max_length=50)  # e.g. "6ème", "5ème", "Terminale"
    order = models.IntegerField(default=0)

    class Meta:
        db_table = 'levels'
        ordering = ['order']

    def __str__(self):
        return self.name


class Classe(models.Model):
    name = models.CharField(max_length=50)  # e.g. "6ème A"
    level = models.ForeignKey(Level, on_delete=models.CASCADE, related_name='classes')
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.CASCADE, related_name='classes')
    capacity = models.IntegerField(default=50)

    class Meta:
        db_table = 'classes'
        ordering = ['level__order', 'name']
        unique_together = ['name', 'academic_year']

    def __str__(self):
        return f"{self.name} ({self.academic_year})"

    @property
    def student_count(self):
        return self.students.count()
