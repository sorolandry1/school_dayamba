from django.db import models


class DocumentTemplate(models.Model):
    DOCUMENT_TYPES = [
        ('bulletin', 'Bulletin scolaire'),
        ('receipt', 'Reçu de paiement'),
        ('card', 'Carte scolaire'),
    ]
    STYLE_PRESETS = [
        ('classic', 'Classique scolaire'),
        ('modern', 'Moderne'),
        ('minimalist', 'Minimaliste'),
        ('premium', 'Premium'),
        ('green', 'Nature'),
        ('warm', 'Chaleureux'),
    ]
    SCHOOL_TYPES = [
        ('all',        'Tous les établissements'),
        ('primaire',   'École primaire'),
        ('college',    'Collège'),
        ('lycee',      'Lycée'),
        ('universite', 'Université'),
        ('technique',  'Enseignement technique'),
        ('prive',      'Établissement privé'),
    ]

    ecole = models.ForeignKey('users.Ecole', on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    name = models.CharField(max_length=200)
    document_type = models.CharField(max_length=20, choices=DOCUMENT_TYPES)
    style_preset = models.CharField(max_length=20, choices=STYLE_PRESETS, default='classic')
    school_type = models.CharField(max_length=20, choices=SCHOOL_TYPES, default='all')
    config = models.JSONField(default=dict)
    is_default = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='document_templates',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Modèle de document'
        verbose_name_plural = 'Modèles de documents'

    def __str__(self):
        return f"{self.name} ({self.document_type})"

    def save(self, *args, **kwargs):
        if self.is_default:
            # Only one default per (document_type, school_type) pair
            DocumentTemplate.objects.filter(
                document_type=self.document_type,
                school_type=self.school_type,
                is_default=True,
            ).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)


class PlatformSettings(models.Model):
    """Réglages d'identité de l'établissement (singleton), définis dans le
    panneau Super-Administrateur et appliqués aux documents générés (bulletins…)."""
    school_name = models.CharField(max_length=200, blank=True, default='')
    school_year = models.CharField(max_length=20, blank=True, default='')
    school_type = models.CharField(max_length=20, blank=True, default='all')
    bulletin_header = models.TextField(blank=True, default='')
    logo = models.ImageField(upload_to='platform/', blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'platform_settings'
        verbose_name = 'Réglages plateforme'
        verbose_name_plural = 'Réglages plateforme'

    def __str__(self):
        return self.school_name or 'Réglages plateforme'

    @classmethod
    def get_solo(cls):
        obj = cls.objects.first()
        if obj is None:
            obj = cls.objects.create()
        return obj
