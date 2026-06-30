from django.db import migrations


def create_default_ecole(apps, schema_editor):
    Ecole = apps.get_model('users', 'Ecole')
    User = apps.get_model('users', 'User')
    ecole, _ = Ecole.objects.get_or_create(
        name='École principale',
        defaults={'is_active': True},
    )
    # Rattache tous les utilisateurs existants à cette école par défaut
    User.objects.filter(ecole__isnull=True).update(ecole=ecole)


def reverse(apps, schema_editor):
    # On ne supprime pas l'école par défaut au rollback
    pass


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0009_ecole_user_ecole'),
    ]
    operations = [
        migrations.RunPython(create_default_ecole, reverse),
    ]
