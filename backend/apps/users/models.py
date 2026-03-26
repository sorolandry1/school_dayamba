from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


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


class ActivityLog(models.Model):
    class Action(models.TextChoices):
        LOGIN = 'LOGIN', 'Connexion'
        LOGOUT = 'LOGOUT', 'Déconnexion'
        GRADE_ADD = 'GRADE_ADD', 'Note ajoutée'
        GRADE_EDIT = 'GRADE_EDIT', 'Note modifiée'
        GRADE_DELETE = 'GRADE_DELETE', 'Note supprimée'
        PAYMENT_ADD = 'PAYMENT_ADD', 'Paiement enregistré'
        PAYMENT_EDIT = 'PAYMENT_EDIT', 'Paiement modifié'
        STUDENT_ADD = 'STUDENT_ADD', 'Élève ajouté'
        STUDENT_EDIT = 'STUDENT_EDIT', 'Élève modifié'
        USER_ADD = 'USER_ADD', 'Utilisateur créé'
        USER_EDIT = 'USER_EDIT', 'Utilisateur modifié'
        PASSWORD_RESET = 'PASSWORD_RESET', 'Mot de passe réinitialisé'

    user = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True,
        related_name='activity_logs'
    )
    action = models.CharField(max_length=30, choices=Action.choices)
    description = models.TextField()
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'activity_logs'
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.user} — {self.action} — {self.timestamp:%Y-%m-%d %H:%M}"


def log_activity(user, action, description, request=None):
    """Helper to create an ActivityLog entry."""
    ip = None
    if request:
        x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
        ip = x_forwarded.split(',')[0].strip() if x_forwarded else request.META.get('REMOTE_ADDR')
    ActivityLog.objects.create(user=user, action=action, description=description, ip_address=ip)
