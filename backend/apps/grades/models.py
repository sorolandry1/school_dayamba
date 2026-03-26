from django.db import models


class Grade(models.Model):
    class EvaluationType(models.TextChoices):
        DEVOIR = 'DEVOIR', 'Devoir'
        EXAMEN = 'EXAMEN', 'Examen'
        ORAL = 'ORAL', 'Oral'
        TP = 'TP', 'Travaux Pratiques'
        COMPOSITION = 'COMPOSITION', 'Composition'

    student = models.ForeignKey(
        'students.Student', on_delete=models.CASCADE, related_name='grades'
    )
    subject = models.ForeignKey(
        'subjects.Subject', on_delete=models.CASCADE, related_name='grades'
    )
    value = models.DecimalField(max_digits=5, decimal_places=2)
    max_value = models.DecimalField(max_digits=5, decimal_places=2, default=20.00)
    type_evaluation = models.CharField(
        max_length=20, choices=EvaluationType.choices, default=EvaluationType.DEVOIR
    )
    comment = models.TextField(blank=True, default='')
    date = models.DateField(auto_now_add=True)
    created_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, related_name='grades_created'
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'grades'
        ordering = ['-date', 'student__last_name']

    def __str__(self):
        return f"{self.student} - {self.subject.name}: {self.value}/{self.max_value}"

    @property
    def normalized_value(self):
        """Normalize to /20."""
        if self.max_value and self.max_value > 0:
            return round(float(self.value) * 20 / float(self.max_value), 2)
        return 0


class GradeHistory(models.Model):
    class ChangeType(models.TextChoices):
        CREATED = 'CREATED', 'Créée'
        UPDATED = 'UPDATED', 'Modifiée'
        DELETED = 'DELETED', 'Supprimée'

    grade = models.ForeignKey(
        Grade, on_delete=models.SET_NULL, null=True, related_name='history'
    )
    student_name = models.CharField(max_length=200)
    subject_name = models.CharField(max_length=100)
    changed_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True
    )
    change_type = models.CharField(max_length=10, choices=ChangeType.choices)
    old_value = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    new_value = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'grade_history'
        ordering = ['-changed_at']

    def __str__(self):
        return f"{self.change_type} — {self.student_name} — {self.subject_name}"
