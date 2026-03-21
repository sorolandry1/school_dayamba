from django.db import models
import uuid


class Student(models.Model):
    class PaymentStatus(models.TextChoices):
        PAID = 'PAID', 'Payé'
        PENDING = 'PENDING', 'En attente'
        OVERDUE = 'OVERDUE', 'En retard'

    class Gender(models.TextChoices):
        MALE = 'M', 'Masculin'
        FEMALE = 'F', 'Féminin'

    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=1, choices=Gender.choices, default=Gender.MALE)
    matricule = models.CharField(max_length=20, unique=True, blank=True)
    classe = models.ForeignKey(
        'classes.Classe', on_delete=models.SET_NULL,
        null=True, related_name='students'
    )
    qr_code = models.ImageField(upload_to='qrcodes/', blank=True, null=True)
    qr_code_data = models.CharField(max_length=100, unique=True, blank=True)
    parent_name = models.CharField(max_length=200, blank=True, default='')
    parent_phone = models.CharField(max_length=20, blank=True, default='')
    parent_email = models.CharField(max_length=200, blank=True, default='')
    address = models.TextField(blank=True, default='')
    payment_status = models.CharField(
        max_length=10, choices=PaymentStatus.choices, default=PaymentStatus.PENDING
    )
    is_active = models.BooleanField(default=True)
    enrolled_date = models.DateField(auto_now_add=True)
    photo = models.ImageField(upload_to='students/', blank=True, null=True)

    class Meta:
        db_table = 'students'
        ordering = ['last_name', 'first_name']

    def __str__(self):
        return f"{self.last_name} {self.first_name} ({self.matricule})"

    @property
    def full_name(self):
        return f"{self.last_name} {self.first_name}"

    def save(self, *args, **kwargs):
        if not self.matricule:
            self.matricule = f"ELV-{uuid.uuid4().hex[:8].upper()}"
        if not self.qr_code_data:
            self.qr_code_data = f"STU-{uuid.uuid4().hex[:12].upper()}"
        super().save(*args, **kwargs)
