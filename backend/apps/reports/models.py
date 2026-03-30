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
    ]

    name = models.CharField(max_length=200)
    document_type = models.CharField(max_length=20, choices=DOCUMENT_TYPES)
    style_preset = models.CharField(max_length=20, choices=STYLE_PRESETS, default='classic')
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
            DocumentTemplate.objects.filter(
                document_type=self.document_type,
                is_default=True,
            ).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)
