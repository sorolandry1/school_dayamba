from django.db import models


class Subject(models.Model):
    ecole = models.ForeignKey('users.Ecole', on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    name = models.CharField(max_length=100)
    coefficient = models.DecimalField(max_digits=4, decimal_places=2, default=1.00)
    teacher = models.ForeignKey(
        'teachers.Teacher', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='subjects'
    )
    classe = models.ForeignKey(
        'classes.Classe', on_delete=models.CASCADE, related_name='subjects',
        null=True, blank=True,
    )

    class Meta:
        db_table = 'subjects'
        ordering = ['name']
        unique_together = ['name', 'classe']

    def __str__(self):
        return f"{self.name} - {self.classe.name}" if self.classe else self.name
