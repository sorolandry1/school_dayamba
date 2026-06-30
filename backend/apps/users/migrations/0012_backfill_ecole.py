from django.db import migrations


def backfill(apps, schema_editor):
    Ecole = apps.get_model('users', 'Ecole')
    ecole = Ecole.objects.order_by('id').first()
    if not ecole:
        ecole = Ecole.objects.create(name='École principale', is_active=True)

    targets = [
        ('students', 'Student'),
        ('classes', 'Classe'),
        ('classes', 'AcademicYear'),
        ('subjects', 'Subject'),
        ('teachers', 'Teacher'),
        ('payments', 'Payment'),
        ('payments', 'Expense'),
        ('users', 'Invitation'),
        ('reports', 'DocumentTemplate'),
    ]
    for app_label, model_name in targets:
        Model = apps.get_model(app_label, model_name)
        Model.objects.filter(ecole__isnull=True).update(ecole=ecole)


def reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0011_invitation_ecole'),
        ('students', '0007_student_ecole'),
        ('classes', '0004_academicyear_ecole_classe_ecole_and_more'),
        ('subjects', '0003_subject_ecole'),
        ('teachers', '0004_teacher_ecole'),
        ('payments', '0003_expense_ecole_payment_ecole'),
        ('reports', '0005_documenttemplate_ecole'),
    ]
    operations = [migrations.RunPython(backfill, reverse)]
