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

    class DiscountType(models.TextChoices):
        NONE = 'NONE', 'Aucune'
        PERCENT = 'PERCENT', 'Pourcentage'
        FIXED = 'FIXED', 'Montant fixe'

    ecole = models.ForeignKey('users.Ecole', on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
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
    birth_place = models.CharField(max_length=100, blank=True, default='')
    nationality = models.CharField(max_length=100, blank=True, default='')
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
    # Remise sur la scolarité (bourse, fratrie, personnel…)
    discount_type = models.CharField(
        max_length=10, choices=DiscountType.choices, default=DiscountType.NONE
    )
    discount_value = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount_reason = models.CharField(max_length=200, blank=True, default='')

    class Meta:
        db_table = 'students'
        ordering = ['last_name', 'first_name']
        indexes = [
            models.Index(fields=['classe', 'is_active'],   name='idx_student_classe_active'),
            models.Index(fields=['payment_status'],         name='idx_student_payment_status'),
            models.Index(fields=['last_name', 'first_name'],name='idx_student_fullname'),
        ]

    def __str__(self):
        return f"{self.last_name} {self.first_name} ({self.matricule})"

    @property
    def full_name(self):
        return f"{self.last_name} {self.first_name}"

    @property
    def tuition_fee(self):
        """Frais de scolarité bruts (avant remise), depuis la classe."""
        return float(self.classe.tuition_fee) if self.classe else 0.0

    def discount_amount(self, tuition=None):
        """Montant de la remise en FCFA appliqué à la scolarité."""
        base = self.tuition_fee if tuition is None else float(tuition)
        value = float(self.discount_value or 0)
        if self.discount_type == self.DiscountType.PERCENT:
            return round(base * value / 100.0, 2)
        if self.discount_type == self.DiscountType.FIXED:
            return min(value, base)
        return 0.0

    @property
    def net_tuition(self):
        """Scolarité nette due après remise (jamais négative)."""
        tuition = self.tuition_fee
        return max(0.0, round(tuition - self.discount_amount(tuition), 2))

    def save(self, *args, **kwargs):
        if not self.matricule:
            from utils.numbering import next_matricule
            self.matricule = next_matricule(getattr(self, 'ecole', None))
        if not self.qr_code_data:
            dob = str(self.date_of_birth) if self.date_of_birth else ''
            self.qr_code_data = (
                f"NOM:{self.last_name}|PRENOM:{self.first_name}"
                f"|DDN:{dob}|MAT:{self.matricule}"
            )
        super().save(*args, **kwargs)


class StudentDocument(models.Model):
    """Espace documentaire de l'élève : certificat, acte de naissance, photo,
    diplôme, bulletin signé…"""
    class Category(models.TextChoices):
        CERTIFICAT = 'CERTIFICAT', 'Certificat'
        ACTE_NAISSANCE = 'ACTE_NAISSANCE', 'Acte de naissance'
        PHOTO = 'PHOTO', 'Photo'
        DIPLOME = 'DIPLOME', 'Diplôme'
        BULLETIN_SIGNE = 'BULLETIN_SIGNE', 'Bulletin signé'
        AUTRE = 'AUTRE', 'Autre'

    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name='documents'
    )
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.AUTRE)
    label = models.CharField(max_length=200, blank=True, default='')
    file = models.FileField(upload_to='documents/')
    uploaded_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='uploaded_documents'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'student_documents'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_category_display()} — {self.student.full_name}"
