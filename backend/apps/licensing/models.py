import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class License(models.Model):
    """Licence de l'installation (unique). Démarre par un essai gratuit ;
    prolongée par un code d'activation lié à `machine_id`."""
    class Plan(models.TextChoices):
        TRIAL = 'TRIAL', 'Essai'
        LICENSED = 'LICENSED', 'Sous licence'

    machine_id = models.CharField(max_length=64, unique=True)
    plan = models.CharField(max_length=10, choices=Plan.choices, default=Plan.TRIAL)
    trial_start = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()
    activated_at = models.DateTimeField(null=True, blank=True)
    last_code = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'license'
        verbose_name = 'Licence'
        verbose_name_plural = 'Licence'

    def __str__(self):
        return f"{self.get_plan_display()} — expire {self.expires_at:%d/%m/%Y}"

    @property
    def is_valid(self):
        return timezone.now() < self.expires_at

    @property
    def days_left(self):
        import math
        secs = (self.expires_at - timezone.now()).total_seconds()
        return math.ceil(secs / 86400) if secs > 0 else 0

    @classmethod
    def get_solo(cls):
        """Retourne la licence (créée en mode essai au premier accès)."""
        obj = cls.objects.first()
        if obj is None:
            trial_days = getattr(settings, 'LICENSE_TRIAL_DAYS', 28)
            now = timezone.now()
            obj = cls.objects.create(
                machine_id=uuid.uuid4().hex[:16].upper(),
                plan=cls.Plan.TRIAL,
                trial_start=now,
                expires_at=now + timezone.timedelta(days=trial_days),
            )
        return obj

    def status_dict(self):
        return {
            'machine_id': self.machine_id,
            'plan': self.plan,
            'plan_label': self.get_plan_display(),
            'is_valid': self.is_valid,
            'days_left': self.days_left,
            'expires_at': self.expires_at.isoformat(),
            'trial': self.plan == self.Plan.TRIAL,
            'single_school_mode': getattr(settings, 'SINGLE_SCHOOL_MODE', True),
        }
