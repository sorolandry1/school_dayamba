from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('reports', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='documenttemplate',
            name='school_type',
            field=models.CharField(
                choices=[
                    ('all',        'Tous les établissements'),
                    ('primaire',   'École primaire'),
                    ('college',    'Collège'),
                    ('lycee',      'Lycée'),
                    ('universite', 'Université'),
                    ('technique',  'Enseignement technique'),
                    ('prive',      'Établissement privé'),
                ],
                default='all',
                max_length=20,
            ),
        ),
    ]
