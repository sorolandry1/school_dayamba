"""
Performance: Add database indexes to the most frequently queried fields.
This reduces query time for filtering students by class/status,
attendance by date, grades by student/subject, and payments by student/status.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('students', '0002_add_birth_place_nationality'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='student',
            index=models.Index(fields=['classe', 'is_active'], name='idx_student_classe_active'),
        ),
        migrations.AddIndex(
            model_name='student',
            index=models.Index(fields=['payment_status'], name='idx_student_payment_status'),
        ),
        migrations.AddIndex(
            model_name='student',
            index=models.Index(fields=['last_name', 'first_name'], name='idx_student_fullname'),
        ),
    ]
