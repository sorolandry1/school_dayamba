from django.db import models
from django.utils import timezone


class Expense(models.Model):
    class Category(models.TextChoices):
        SALAIRES = 'SALAIRES', 'Salaires & Charges'
        FOURNITURES = 'FOURNITURES', 'Fournitures scolaires'
        MAINTENANCE = 'MAINTENANCE', 'Entretien & Maintenance'
        SERVICES = 'SERVICES', 'Services & Abonnements'
        TRANSPORT = 'TRANSPORT', 'Transport'
        EVENEMENTS = 'EVENEMENTS', 'Événements & Sorties'
        AUTRE = 'AUTRE', 'Autre'

    class Method(models.TextChoices):
        CAISSE = 'CAISSE', 'Caisse'
        BANQUE = 'BANQUE', 'Banque'

    label = models.CharField(max_length=200)
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.AUTRE)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    method = models.CharField(max_length=10, choices=Method.choices, default=Method.CAISSE)
    date = models.DateField(default=timezone.now)
    description = models.TextField(blank=True, default='')
    recorded_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, related_name='recorded_expenses'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'expenses'
        ordering = ['-date']

    def __str__(self):
        return f"{self.label} — {self.amount} FCFA ({self.date})"


class Payment(models.Model):
    class Status(models.TextChoices):
        PAID = 'PAID', 'Payé'
        PENDING = 'PENDING', 'En attente'
        OVERDUE = 'OVERDUE', 'En retard'
        PARTIAL = 'PARTIAL', 'Partiel'

    class PaymentType(models.TextChoices):
        INSCRIPTION = 'INSCRIPTION', 'Frais d\'inscription'
        SCOLARITE = 'SCOLARITE', 'Frais de scolarité'
        EXAMEN = 'EXAMEN', 'Frais d\'examen'
        AUTRE = 'AUTRE', 'Autre'

    student = models.ForeignKey(
        'students.Student', on_delete=models.CASCADE, related_name='payments'
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_type = models.CharField(
        max_length=20, choices=PaymentType.choices, default=PaymentType.SCOLARITE
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    method = models.CharField(
        max_length=10,
        choices=[('CAISSE', 'Caisse'), ('BANQUE', 'Banque')],
        default='CAISSE',
    )
    payment_date = models.DateField(default=timezone.now)
    due_date = models.DateField(null=True, blank=True)
    receipt_number = models.CharField(max_length=50, unique=True, blank=True)
    notes = models.TextField(blank=True, default='')
    recorded_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, related_name='recorded_payments'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'payments'
        ordering = ['-payment_date']

    def __str__(self):
        return f"{self.student} - {self.amount} FCFA ({self.get_status_display()})"

    def save(self, *args, **kwargs):
        if not self.receipt_number:
            import uuid
            self.receipt_number = f"REC-{uuid.uuid4().hex[:10].upper()}"
        super().save(*args, **kwargs)
        # Update student payment status
        self._update_student_status()

    def _update_student_status(self):
        student = self.student
        total_paid = sum(
            p.amount for p in student.payments.filter(status='PAID')
        )
        pending = student.payments.filter(status__in=['PENDING', 'OVERDUE']).exists()
        if not pending:
            student.payment_status = 'PAID'
        elif student.payments.filter(status='OVERDUE').exists():
            student.payment_status = 'OVERDUE'
        else:
            student.payment_status = 'PENDING'
        student.save(update_fields=['payment_status'])
