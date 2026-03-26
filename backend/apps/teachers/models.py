from django.db import models
from django.conf import settings
from django.utils import timezone


class Teacher(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='teacher_profile'
    )
    phone = models.CharField(max_length=20, blank=True, default='')
    speciality = models.CharField(max_length=100, blank=True, default='')
    hire_date = models.DateField(null=True, blank=True)

    class Meta:
        db_table = 'teachers'
        ordering = ['user__last_name']

    def __str__(self):
        return self.user.get_full_name()

    @property
    def full_name(self):
        return self.user.get_full_name()

    @property
    def assigned_subjects(self):
        return self.subjects.all()


class LessonLog(models.Model):
    """Cahier de texte — teacher lesson journal."""
    teacher = models.ForeignKey(
        Teacher, on_delete=models.CASCADE, related_name='lesson_logs'
    )
    subject = models.ForeignKey(
        'subjects.Subject', on_delete=models.CASCADE, related_name='lesson_logs'
    )
    date = models.DateField(default=timezone.now)
    topic = models.CharField(max_length=200)
    objectives = models.TextField(blank=True, default='')
    content_covered = models.TextField(blank=True, default='')
    homework = models.TextField(blank=True, default='', verbose_name='Travail à la maison')
    progression_percent = models.PositiveSmallIntegerField(
        default=0, help_text='Pourcentage du programme couvert'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'lesson_logs'
        ordering = ['-date', 'subject__name']

    def __str__(self):
        return f"{self.subject.name} — {self.topic} ({self.date})"
