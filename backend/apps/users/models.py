import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class Ecole(models.Model):
    """Établissement scolaire. Une seule plateforme peut en gérer plusieurs."""
    name = models.CharField(max_length=200)
    address = models.CharField(max_length=255, blank=True, default='')
    phone = models.CharField(max_length=30, blank=True, default='')
    email = models.CharField(max_length=200, blank=True, default='')
    logo = models.ImageField(upload_to='ecoles/', blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ecoles'
        ordering = ['name']
        verbose_name = 'École'

    def __str__(self):
        return self.name


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = 'ADMIN', 'Administrateur'
        DIRECTOR = 'DIRECTOR', 'Directeur'
        TEACHER = 'TEACHER', 'Professeur'
        AGENT = 'AGENT', 'Agent d\'accueil'
        EDUCATEUR = 'EDUCATEUR', 'Éducateur'
        CAISSE = 'CAISSE', 'Caisse'

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.TEACHER)
    phone = models.CharField(max_length=20, blank=True, default='')
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    # École de rattachement (null = super-admin plateforme / non rattaché)
    ecole = models.ForeignKey(
        'users.Ecole', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='users'
    )

    class Meta:
        db_table = 'users'
        ordering = ['last_name', 'first_name']

    def __str__(self):
        return f"{self.get_full_name()} ({self.get_role_display()})"

    @property
    def is_admin_or_director(self):
        return self.role in [self.Role.ADMIN, self.Role.DIRECTOR]


class ActivityLog(models.Model):
    class Action(models.TextChoices):
        LOGIN = 'LOGIN', 'Connexion'
        LOGOUT = 'LOGOUT', 'Déconnexion'
        GRADE_ADD = 'GRADE_ADD', 'Note ajoutée'
        GRADE_EDIT = 'GRADE_EDIT', 'Note modifiée'
        GRADE_DELETE = 'GRADE_DELETE', 'Note supprimée'
        PAYMENT_ADD = 'PAYMENT_ADD', 'Paiement enregistré'
        PAYMENT_EDIT = 'PAYMENT_EDIT', 'Paiement modifié'
        STUDENT_ADD = 'STUDENT_ADD', 'Élève ajouté'
        STUDENT_EDIT = 'STUDENT_EDIT', 'Élève modifié'
        USER_ADD = 'USER_ADD', 'Utilisateur créé'
        USER_EDIT = 'USER_EDIT', 'Utilisateur modifié'
        PASSWORD_RESET = 'PASSWORD_RESET', 'Mot de passe réinitialisé'

    user = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True,
        related_name='activity_logs'
    )
    action = models.CharField(max_length=30, choices=Action.choices)
    description = models.TextField()
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    # Traçabilité enrichie
    old_value = models.TextField(blank=True, default='')
    new_value = models.TextField(blank=True, default='')
    user_agent = models.TextField(blank=True, default='')
    browser = models.CharField(max_length=50, blank=True, default='')
    os = models.CharField(max_length=50, blank=True, default='')
    location = models.CharField(max_length=120, blank=True, default='')
    timestamp = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'activity_logs'
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.user} — {self.action} — {self.timestamp:%Y-%m-%d %H:%M}"


class Invitation(models.Model):
    """Lien d'inscription généré par le directeur pour qu'un professeur ou un
    agent crée lui-même son compte."""
    ROLE_CHOICES = [
        ('TEACHER', 'Professeur'),
        ('AGENT', "Agent d'accueil"),
        ('EDUCATEUR', 'Éducateur'),
        ('CAISSE', 'Caisse'),
    ]

    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    note = models.CharField(
        max_length=200, blank=True, default='',
        help_text="Repère facultatif (ex. nom de la personne invitée)"
    )
    created_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True,
        related_name='invitations_created'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    used_at = models.DateTimeField(null=True, blank=True)
    used_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='invitation_used'
    )

    class Meta:
        db_table = 'invitations'
        ordering = ['-created_at']

    def __str__(self):
        return f"Invitation {self.get_role_display()} ({self.token})"

    @property
    def is_used(self):
        return self.used_at is not None

    @property
    def is_expired(self):
        return self.expires_at is not None and timezone.now() > self.expires_at

    @property
    def is_valid(self):
        return not self.is_used and not self.is_expired


class PasswordResetToken(models.Model):
    """Jeton de réinitialisation de mot de passe envoyé par email (usage unique)."""
    user = models.ForeignKey(
        'users.User', on_delete=models.CASCADE, related_name='password_reset_tokens'
    )
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'password_reset_tokens'
        ordering = ['-created_at']

    @property
    def is_used(self):
        return self.used_at is not None

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at

    @property
    def is_valid(self):
        return not self.is_used and not self.is_expired


class Notification(models.Model):
    """Événements affichés en temps réel (polling) : inscription, paiement, scan QR."""
    class Type(models.TextChoices):
        STUDENT = 'STUDENT', 'Nouvel élève'
        PAYMENT = 'PAYMENT', 'Paiement'
        SCAN = 'SCAN', 'Présence (QR)'
        OTHER = 'OTHER', 'Autre'

    type = models.CharField(max_length=20, choices=Type.choices, default=Type.OTHER)
    message = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.type}] {self.message}"


def notify(ntype, message):
    """Crée une notification (silencieux en cas d'erreur)."""
    try:
        Notification.objects.create(type=ntype, message=message[:255])
    except Exception:
        pass


def _parse_user_agent(ua):
    """Déduit (navigateur, système d'exploitation) d'un User-Agent, sans dépendance."""
    u = (ua or '').lower()
    if 'edg' in u:           browser = 'Edge'
    elif 'opr' in u or 'opera' in u: browser = 'Opera'
    elif 'chrome' in u:      browser = 'Chrome'
    elif 'firefox' in u:     browser = 'Firefox'
    elif 'safari' in u:      browser = 'Safari'
    else:                    browser = 'Autre'
    if 'windows' in u:       os_ = 'Windows'
    elif 'android' in u:     os_ = 'Android'
    elif 'iphone' in u or 'ipad' in u or 'ios' in u: os_ = 'iOS'
    elif 'mac os' in u or 'macintosh' in u: os_ = 'macOS'
    elif 'linux' in u:       os_ = 'Linux'
    else:                    os_ = 'Autre'
    return browser, os_


def log_activity(user, action, description, request=None, old_value=None, new_value=None):
    """Crée une entrée de journal en conservant navigateur, OS, IP, localisation
    approximative, et l'ancienne/nouvelle valeur le cas échéant."""
    ip = None
    ua = ''
    location = ''
    browser = os_ = ''
    if request:
        x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
        ip = x_forwarded.split(',')[0].strip() if x_forwarded else request.META.get('REMOTE_ADDR')
        ua = request.META.get('HTTP_USER_AGENT', '')
        browser, os_ = _parse_user_agent(ua)
        # Localisation approximative via en-têtes de proxy/CDN si disponibles
        country = (request.META.get('HTTP_CF_IPCOUNTRY')
                   or request.META.get('HTTP_X_APPENGINE_COUNTRY') or '')
        city = request.META.get('HTTP_CF_IPCITY', '')
        location = ', '.join([p for p in (city, country) if p and p != 'XX'])
    ActivityLog.objects.create(
        user=user, action=action, description=description, ip_address=ip,
        old_value='' if old_value is None else str(old_value),
        new_value='' if new_value is None else str(new_value),
        user_agent=ua, browser=browser, os=os_, location=location,
    )
