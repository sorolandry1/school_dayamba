import re
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.utils import timezone
from apps.subjects.models import Subject
from apps.teachers.models import Teacher
from .models import Invitation, Ecole

User = get_user_model()


class EcoleSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()
    user_count = serializers.SerializerMethodField()

    class Meta:
        model = Ecole
        fields = ['id', 'name', 'address', 'phone', 'email', 'logo', 'logo_url',
                  'is_active', 'user_count', 'created_at']
        read_only_fields = ['created_at']
        extra_kwargs = {'logo': {'write_only': True, 'required': False}}

    def get_logo_url(self, obj):
        if obj.logo:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.logo.url) if request else obj.logo.url
        return None

    def get_user_count(self, obj):
        return obj.users.count()


def sync_teacher_profile(user, subjects):
    """Garantit qu'un profil Teacher existe pour un utilisateur TEACHER et
    (ré)affecte les matières sélectionnées.

    `subjects` : liste d'instances Subject à affecter, ou None pour ne pas
    toucher aux affectations existantes (ex. édition sans changement de matières).
    """
    if user.role != 'TEACHER':
        return
    teacher, _ = Teacher.objects.get_or_create(
        user=user, defaults={'phone': user.phone or ''}
    )
    if subjects is None:
        return
    new_ids = [s.id for s in subjects]
    # Libère les matières que ce prof n'enseigne plus
    teacher.subjects.exclude(id__in=new_ids).update(teacher=None)
    # Affecte les matières sélectionnées à ce prof
    Subject.objects.filter(id__in=new_ids).update(teacher=teacher)


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    assigned_subject_ids = serializers.SerializerMethodField()
    subject_ids = serializers.PrimaryKeyRelatedField(
        many=True, write_only=True, required=False, queryset=Subject.objects.all(),
    )

    ecole_name = serializers.CharField(source='ecole.name', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name',
                  'full_name', 'role', 'phone', 'is_active', 'date_joined',
                  'assigned_subject_ids', 'subject_ids', 'ecole', 'ecole_name']
        read_only_fields = ['id', 'date_joined']

    def get_full_name(self, obj):
        return obj.get_full_name()

    def get_assigned_subject_ids(self, obj):
        try:
            teacher = obj.teacher_profile
        except Teacher.DoesNotExist:
            return []
        return list(teacher.subjects.values_list('id', flat=True))

    def update(self, instance, validated_data):
        subjects = validated_data.pop('subject_ids', None)
        instance = super().update(instance, validated_data)
        sync_teacher_profile(instance, subjects)
        return instance


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    subject_ids = serializers.PrimaryKeyRelatedField(
        many=True, write_only=True, required=False, queryset=Subject.objects.all(),
    )

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name',
                  'role', 'phone', 'password', 'subject_ids', 'ecole']

    def create(self, validated_data):
        password = validated_data.pop('password')
        subjects = validated_data.pop('subject_ids', None)
        # Rattachement à l'école : celle fournie, sinon celle du créateur
        request = self.context.get('request')
        if not validated_data.get('ecole') and request and getattr(request.user, 'ecole_id', None):
            validated_data['ecole'] = request.user.ecole
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        sync_teacher_profile(user, subjects)
        return user


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=8)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Ancien mot de passe incorrect.")
        return value


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()


class InvitationSerializer(serializers.ModelSerializer):
    """Lecture/création des liens d'inscription (réservé au directeur/admin)."""
    expires_in_days = serializers.IntegerField(
        write_only=True, required=False, min_value=1, max_value=365,
        help_text="Durée de validité en jours (facultatif)"
    )
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    used_by_name = serializers.SerializerMethodField()
    is_used = serializers.BooleanField(read_only=True)
    is_expired = serializers.BooleanField(read_only=True)
    is_valid = serializers.BooleanField(read_only=True)

    class Meta:
        model = Invitation
        fields = [
            'id', 'token', 'role', 'role_display', 'note',
            'created_by_name', 'created_at', 'expires_at', 'expires_in_days',
            'used_at', 'used_by_name', 'is_used', 'is_expired', 'is_valid',
        ]
        read_only_fields = ['id', 'token', 'created_at', 'used_at']

    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() if obj.created_by else None

    def get_used_by_name(self, obj):
        return obj.used_by.get_full_name() if obj.used_by else None

    def validate_role(self, value):
        # Le directeur ne peut inviter que des professeurs, agents ou éducateurs
        if value not in ('TEACHER', 'AGENT', 'EDUCATEUR', 'CAISSE'):
            raise serializers.ValidationError(
                "Seuls les rôles Professeur, Agent, Éducateur et Caisse peuvent être invités."
            )
        return value

    def create(self, validated_data):
        days = validated_data.pop('expires_in_days', None)
        if days:
            validated_data['expires_at'] = timezone.now() + timezone.timedelta(days=days)
        return super().create(validated_data)


def validate_strong_password(value):
    """Exige un mot de passe robuste : ≥ 8 caractères, majuscule, minuscule,
    chiffre et symbole."""
    manquants = []
    if len(value) < 8:
        manquants.append("au moins 8 caractères")
    if not re.search(r'[A-Z]', value):
        manquants.append("une majuscule")
    if not re.search(r'[a-z]', value):
        manquants.append("une minuscule")
    if not re.search(r'\d', value):
        manquants.append("un chiffre")
    if not re.search(r'[^A-Za-z0-9]', value):
        manquants.append("un symbole")
    if manquants:
        raise serializers.ValidationError(
            "Le mot de passe doit contenir " + ", ".join(manquants) + "."
        )
    return value


class RegistrationSerializer(serializers.Serializer):
    """Création de compte par un invité via un lien valide.
    Tous les champs sont obligatoires et le mot de passe doit être robuste."""
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=20)
    # Matières choisies par le professeur (facultatif, ignoré pour un agent)
    subject_ids = serializers.PrimaryKeyRelatedField(
        many=True, required=False, queryset=Subject.objects.all(),
    )

    def validate_username(self, value):
        value = value.strip()
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Cet identifiant est déjà pris.")
        return value

    def validate_password(self, value):
        return validate_strong_password(value)

    def create(self, validated_data):
        invitation = self.context['invitation']
        subjects = validated_data.get('subject_ids', None)
        user = User(
            username=validated_data['username'].strip(),
            first_name=validated_data['first_name'].strip(),
            last_name=validated_data['last_name'].strip(),
            email=validated_data.get('email', '').strip(),
            phone=validated_data.get('phone', '').strip(),
            role=invitation.role,
        )
        user.set_password(validated_data['password'])
        user.save()
        # Crée le profil Teacher si besoin + affecte les matières choisies
        sync_teacher_profile(user, subjects if invitation.role == 'TEACHER' else None)
        # Marque l'invitation comme utilisée
        invitation.used_at = timezone.now()
        invitation.used_by = user
        invitation.save(update_fields=['used_at', 'used_by'])
        return user
