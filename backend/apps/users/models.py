from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = 'ADMIN', 'Administrateur'
        DIRECTOR = 'DIRECTOR', 'Directeur'
        TEACHER = 'TEACHER', 'Professeur'
        AGENT = 'AGENT', 'Agent d\'accueil'

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.TEACHER)
    phone = models.CharField(max_length=20, blank=True, default='')
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)

    class Meta:
        db_table = 'users'
        ordering = ['last_name', 'first_name']

    def __str__(self):
        return f"{self.get_full_name()} ({self.get_role_display()})"

    @property
    def is_admin_or_director(self):
        return self.role in [self.Role.ADMIN, self.Role.DIRECTOR]
