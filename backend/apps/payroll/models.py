from django.db import models
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.utils import timezone


class AdminStaff(models.Model):
    """Personnel administratif (non enseignant) : secrétaire, comptable,
    gardien, censeur… avec poste, coordonnées et salaire de base."""
    ecole = models.ForeignKey('users.Ecole', on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    position = models.CharField(max_length=120, blank=True, default='')  # poste
    phone = models.CharField(max_length=30, blank=True, default='')
    email = models.CharField(max_length=200, blank=True, default='')
    base_salary = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    hire_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'admin_staff'
        ordering = ['last_name', 'first_name']
        verbose_name = 'Personnel administratif'
        verbose_name_plural = 'Personnel administratif'

    def __str__(self):
        return f"{self.full_name} — {self.position}" if self.position else self.full_name

    @property
    def full_name(self):
        return f"{self.last_name} {self.first_name}".strip()


class SalaryPayment(models.Model):
    """Versement de salaire à un membre du personnel (enseignant ou
    administratif). Chaque versement génère une dépense liée (catégorie
    SALAIRES) afin d'être intégré au bilan financier au même titre que les
    autres dépenses."""
    class StaffType(models.TextChoices):
        TEACHER = 'TEACHER', 'Enseignant'
        ADMIN = 'ADMIN', 'Personnel administratif'

    class Method(models.TextChoices):
        CAISSE = 'CAISSE', 'Caisse'
        BANQUE = 'BANQUE', 'Banque'

    ecole = models.ForeignKey('users.Ecole', on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    staff_type = models.CharField(max_length=10, choices=StaffType.choices)
    teacher = models.ForeignKey(
        'teachers.Teacher', on_delete=models.CASCADE, null=True, blank=True,
        related_name='salary_payments'
    )
    admin_staff = models.ForeignKey(
        AdminStaff, on_delete=models.CASCADE, null=True, blank=True,
        related_name='salary_payments'
    )
    # Période de paie, ex. « 2026-07 » (mois de rémunération concerné)
    period = models.CharField(max_length=20)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    method = models.CharField(max_length=10, choices=Method.choices, default=Method.CAISSE)
    payment_date = models.DateField(default=timezone.now)
    notes = models.TextField(blank=True, default='')
    # Dépense liée, injectée dans le bilan financier
    expense = models.OneToOneField(
        'payments.Expense', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='salary_payment'
    )
    recorded_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, related_name='recorded_salaries'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'salary_payments'
        ordering = ['-payment_date', '-created_at']
        verbose_name = 'Versement de salaire'
        verbose_name_plural = 'Versements de salaire'

    def __str__(self):
        return f"Salaire {self.period} — {self.employee_name} ({self.amount})"

    @property
    def employee_name(self):
        if self.staff_type == self.StaffType.TEACHER and self.teacher:
            return self.teacher.full_name
        if self.staff_type == self.StaffType.ADMIN and self.admin_staff:
            return self.admin_staff.full_name
        return '—'

    @property
    def employee_position(self):
        if self.staff_type == self.StaffType.TEACHER and self.teacher:
            return self.teacher.speciality or 'Enseignant'
        if self.staff_type == self.StaffType.ADMIN and self.admin_staff:
            return self.admin_staff.position or 'Personnel administratif'
        return ''

    def sync_expense(self):
        """Crée ou met à jour la dépense liée à ce versement de salaire."""
        from apps.payments.models import Expense
        exp = self.expense or Expense()
        exp.ecole = self.ecole
        exp.label = f"Salaire {self.period} — {self.employee_name}"
        exp.category = Expense.Category.SALAIRES
        exp.amount = self.amount
        exp.method = self.method
        exp.date = self.payment_date
        exp.description = self.notes or ''
        exp.recorded_by = self.recorded_by
        exp.save()
        if self.expense_id != exp.id:
            self.expense = exp
            super().save(update_fields=['expense'])


@receiver(post_delete, sender=SalaryPayment)
def _delete_linked_expense(sender, instance, **kwargs):
    """Supprime la dépense liée quand un versement de salaire est supprimé
    (couvre aussi les suppressions en masse et via l'admin)."""
    if instance.expense_id:
        from apps.payments.models import Expense
        Expense.objects.filter(pk=instance.expense_id).delete()
