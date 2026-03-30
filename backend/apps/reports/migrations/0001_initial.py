from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='DocumentTemplate',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('document_type', models.CharField(
                    choices=[
                        ('bulletin', 'Bulletin scolaire'),
                        ('receipt', 'Reçu de paiement'),
                        ('card', 'Carte scolaire'),
                    ],
                    max_length=20,
                )),
                ('style_preset', models.CharField(
                    choices=[
                        ('classic', 'Classique scolaire'),
                        ('modern', 'Moderne'),
                        ('minimalist', 'Minimaliste'),
                        ('premium', 'Premium'),
                    ],
                    default='classic',
                    max_length=20,
                )),
                ('config', models.JSONField(default=dict)),
                ('is_default', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='document_templates',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Modèle de document',
                'verbose_name_plural': 'Modèles de documents',
                'ordering': ['-created_at'],
            },
        ),
    ]
