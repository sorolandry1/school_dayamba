from django.db import models


class AcademicYear(models.Model):
    ecole = models.ForeignKey('users.Ecole', on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    name = models.CharField(max_length=20)  # e.g. "2025-2026"
    start_date = models.DateField()
    end_date = models.DateField()
    is_current = models.BooleanField(default=False)

    class Meta:
        db_table = 'academic_years'
        ordering = ['-start_date']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if self.is_current:
            # Une seule année courante PAR ÉCOLE
            AcademicYear.objects.filter(is_current=True, ecole=self.ecole).exclude(pk=self.pk).update(is_current=False)
        super().save(*args, **kwargs)


class Level(models.Model):
    name = models.CharField(max_length=50)  # e.g. "6ème", "5ème", "Terminale"
    order = models.IntegerField(default=0)

    class Meta:
        db_table = 'levels'
        ordering = ['order']

    def __str__(self):
        return self.name


class Classe(models.Model):
    ecole = models.ForeignKey('users.Ecole', on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    name = models.CharField(max_length=50)  # e.g. "6ème A"
    level = models.ForeignKey(Level, on_delete=models.CASCADE, related_name='classes')
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.CASCADE, related_name='classes')
    capacity = models.IntegerField(default=50)
    # Frais de scolarité annuels de la classe (sert au calcul du reste sur le reçu)
    tuition_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        db_table = 'classes'
        ordering = ['level__order', 'name']
        unique_together = ['name', 'academic_year']

    def __str__(self):
        return f"{self.name} ({self.academic_year})"

    @property
    def student_count(self):
        return self.students.count()


class ScheduleEntry(models.Model):
    """Créneau d'emploi du temps : classe, matière, salle, jour, horaires."""
    DAYS = [
        (0, 'Lundi'), (1, 'Mardi'), (2, 'Mercredi'),
        (3, 'Jeudi'), (4, 'Vendredi'), (5, 'Samedi'),
    ]
    classe = models.ForeignKey(Classe, on_delete=models.CASCADE, related_name='schedule')
    subject = models.ForeignKey(
        'subjects.Subject', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='schedule_entries'
    )
    subject_name = models.CharField(max_length=100, blank=True, default='')  # libellé libre si pas de matière liée
    room = models.CharField(max_length=50, blank=True, default='')  # salle
    day = models.IntegerField(choices=DAYS, default=0)
    start_time = models.TimeField()
    end_time = models.TimeField()

    class Meta:
        db_table = 'schedule_entries'
        ordering = ['day', 'start_time']

    def __str__(self):
        return f"{self.classe.name} — {self.get_day_display()} {self.start_time}"
