from django.db import models
from django.utils import timezone


class Attendance(models.Model):
    class Status(models.TextChoices):
        PRESENT = 'PRESENT', 'Présent'
        ABSENT = 'ABSENT', 'Absent'
        LATE = 'LATE', 'En retard'

    student = models.ForeignKey(
        'students.Student', on_delete=models.CASCADE, related_name='attendances'
    )
    date = models.DateField(default=timezone.now)
    check_in = models.TimeField(null=True, blank=True)
    check_out = models.TimeField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PRESENT)
    scanned_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, related_name='scans'
    )

    class Meta:
        db_table = 'attendance'
        ordering = ['-date', 'student__last_name']
        unique_together = ['student', 'date']

    def __str__(self):
        return f"{self.student} - {self.date} ({self.get_status_display()})"

    @property
    def hours_absent(self):
        """Calculate hours absent based on check_in/check_out."""
        if not self.check_in or not self.check_out:
            return 0
        school_start = timezone.datetime.strptime("07:30", "%H:%M").time()
        school_end = timezone.datetime.strptime("17:00", "%H:%M").time()

        actual_start = max(self.check_in, school_start)
        actual_end = min(self.check_out, school_end)

        total_school = (
            timezone.datetime.combine(self.date, school_end) -
            timezone.datetime.combine(self.date, school_start)
        ).seconds / 3600

        actual_present = (
            timezone.datetime.combine(self.date, actual_end) -
            timezone.datetime.combine(self.date, actual_start)
        ).seconds / 3600

        return round(total_school - actual_present, 1)
