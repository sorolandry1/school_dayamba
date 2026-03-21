from django.db import models
from django.conf import settings


class Teacher(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='teacher_profile'
    )
    phone = models.CharField(max_length=20, blank=True, default='')
    speciality = models.CharField(max_length=100, blank=True, default='')
    hire_date = models.DateField(null=True, blank=True)

    class Meta:
        db_table = 'teachers'
        ordering = ['user__last_name']

    def __str__(self):
        return self.user.get_full_name()

    @property
    def full_name(self):
        return self.user.get_full_name()

    @property
    def assigned_subjects(self):
        return self.subjects.all()
