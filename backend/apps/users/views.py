from rest_framework import viewsets, status, generics
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate, get_user_model
from .serializers import (
    UserSerializer, UserCreateSerializer, ChangePasswordSerializer, LoginSerializer,
    InvitationSerializer, RegistrationSerializer, EcoleSerializer,
)
from .permissions import IsAdmin, IsPlatformAdmin
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
import logging


class LoginRateThrottle(ScopedRateThrottle):
    scope = 'login'

User = get_user_model()
logger = logging.getLogger('apps')


class LoginView(generics.GenericAPIView):
    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]
    serializer_class = LoginSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        username = serializer.validated_data.get('username', '').strip()
        password = serializer.validated_data.get('password', '')

        user = authenticate(request=request, username=username, password=password)

        if user is None:
            return Response({'error': 'Identifiants invalides.'}, status=status.HTTP_401_UNAUTHORIZED)
        if not user.is_active:
            return Response({'error': 'Compte desactive.'}, status=status.HTTP_403_FORBIDDEN)

        from apps.users.models import log_activity
        log_activity(user, 'LOGIN', f"Connexion réussie — {user.get_role_display()}", request)
        logger.info(f"Connexion reussie: {user.username} ({user.role})")
        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data
        })


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class ChangePasswordView(generics.UpdateAPIView):
    serializer_class = ChangePasswordSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save()
        return Response({'message': 'Mot de passe modifie avec succes.'})


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    permission_classes = [IsAdmin]
    filterset_fields = ['role', 'is_active']
    search_fields = ['username', 'first_name', 'last_name', 'email']
    ordering_fields = ['last_name', 'date_joined']

    def get_queryset(self):
        qs = User.objects.all()
        u = self.request.user
        # Le super-admin voit tous les comptes ; sinon, seulement son école
        if u.role != 'ADMIN' and getattr(u, 'ecole_id', None):
            qs = qs.filter(ecole_id=u.ecole_id)
        return qs

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    def _check_director_cannot_touch_admin(self, request, target_user=None, target_role=None):
        """Directeur ne peut pas créer/modifier/supprimer un compte Admin."""
        if request.user.role == 'DIRECTOR':
            if target_user and target_user.role == 'ADMIN':
                return Response(
                    {'error': 'Le Directeur ne peut pas modifier le compte d\'un Administrateur.'},
                    status=status.HTTP_403_FORBIDDEN
                )
            if target_role == 'ADMIN':
                return Response(
                    {'error': 'Le Directeur ne peut pas créer ou attribuer le rôle Administrateur.'},
                    status=status.HTTP_403_FORBIDDEN
                )
        return None

    def create(self, request, *args, **kwargs):
        err = self._check_director_cannot_touch_admin(request, target_role=request.data.get('role'))
        if err:
            return err
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        target = self.get_object()
        err = self._check_director_cannot_touch_admin(request, target_user=target,
                                                       target_role=request.data.get('role'))
        if err:
            return err
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        target = self.get_object()
        err = self._check_director_cannot_touch_admin(request, target_user=target,
                                                       target_role=request.data.get('role'))
        if err:
            return err
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        target = self.get_object()
        err = self._check_director_cannot_touch_admin(request, target_user=target)
        if err:
            return err
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        user = self.get_object()
        err = self._check_director_cannot_touch_admin(request, target_user=user)
        if err:
            return err
        user.is_active = not user.is_active
        user.save()
        return Response({'is_active': user.is_active})

    @action(detail=True, methods=['post'])
    def reset_password(self, request, pk=None):
        user = self.get_object()
        err = self._check_director_cannot_touch_admin(request, target_user=user)
        if err:
            return err
        new_password = request.data.get('password')
        if not new_password:
            return Response({'error': 'Le mot de passe est requis.'}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(new_password)
        user.save()
        from apps.users.models import log_activity
        log_activity(request.user, 'PASSWORD_RESET', f"Mot de passe réinitialisé pour {user.get_full_name()}", request)
        return Response({'message': 'Mot de passe reinitialise.'})


class InvitationViewSet(viewsets.ModelViewSet):
    """Gestion des liens d'inscription par le directeur/admin."""
    permission_classes = [IsAdmin]
    serializer_class = InvitationSerializer
    http_method_names = ['get', 'post', 'delete']  # pas de modification d'un lien émis

    def get_queryset(self):
        from .models import Invitation
        qs = Invitation.objects.select_related('created_by', 'used_by').all()
        u = self.request.user
        if u.role != 'ADMIN' and getattr(u, 'ecole_id', None):
            qs = qs.filter(ecole_id=u.ecole_id)
        return qs

    def perform_create(self, serializer):
        kw = {'created_by': self.request.user}
        if getattr(self.request.user, 'ecole_id', None):
            kw['ecole'] = self.request.user.ecole
        invitation = serializer.save(**kw)
        from apps.users.models import log_activity
        log_activity(
            self.request.user, 'USER_ADD',
            f"Lien d'inscription généré ({invitation.get_role_display()})",
            self.request,
        )


class PublicInvitationView(APIView):
    """Endpoint public : valider un lien (GET) et créer un compte (POST)."""
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'register'

    def _get_invitation(self, token):
        from .models import Invitation
        try:
            return Invitation.objects.get(token=token)
        except (Invitation.DoesNotExist, ValueError, Exception):
            return None

    def get(self, request, token):
        inv = self._get_invitation(token)
        if not inv:
            return Response({'valid': False, 'reason': 'Lien invalide.'}, status=404)
        if inv.is_used:
            return Response({'valid': False, 'reason': 'Ce lien a déjà été utilisé.'})
        if inv.is_expired:
            return Response({'valid': False, 'reason': 'Ce lien a expiré.'})

        data = {
            'valid': True,
            'role': inv.role,
            'role_display': inv.get_role_display(),
            'note': inv.note,
        }
        # Pour un professeur : liste des matières qu'il pourra cocher
        if inv.role == 'TEACHER':
            from apps.subjects.models import Subject
            subjects = Subject.objects.select_related('classe').order_by('classe__name', 'name')
            # On n'expose pas le professeur actuel d'une matière sur la page
            # publique d'inscription (confidentialité)
            data['subjects'] = [
                {
                    'id': s.id,
                    'name': s.name,
                    'classe_name': s.classe.name if s.classe else None,
                }
                for s in subjects
            ]
        return Response(data)

    def post(self, request, token):
        inv = self._get_invitation(token)
        if not inv:
            return Response({'error': 'Lien invalide.'}, status=404)
        if not inv.is_valid:
            reason = 'Ce lien a déjà été utilisé.' if inv.is_used else 'Ce lien a expiré.'
            return Response({'error': reason}, status=400)

        serializer = RegistrationSerializer(data=request.data, context={'invitation': inv})
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        from apps.users.models import log_activity
        log_activity(user, 'USER_ADD',
                     f"Compte créé via lien d'inscription — {user.get_role_display()}", request)

        # Connexion automatique
        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
        }, status=status.HTTP_201_CREATED)


class PasswordResetRequestView(APIView):
    """Demande de réinitialisation : envoie un lien par email (public)."""
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'register'

    def post(self, request):
        from datetime import timedelta
        from django.conf import settings
        from django.utils import timezone
        from .models import PasswordResetToken
        from utils.email_service import send_email

        identifier = (request.data.get('identifier') or '').strip()
        # Réponse générique : on ne révèle jamais si le compte existe
        generic = Response({
            'message': "Si un compte correspond, un email de réinitialisation a été envoyé."
        })
        if not identifier:
            return generic

        user = (
            User.objects.filter(email__iexact=identifier).first()
            or User.objects.filter(username__iexact=identifier).first()
        )
        if not user or not user.is_active or not user.email:
            logger.info("Reset mot de passe demandé pour identifiant inconnu/sans email: %s", identifier)
            return generic

        # Invalide les anciens jetons non utilisés
        PasswordResetToken.objects.filter(user=user, used_at__isnull=True).delete()
        token = PasswordResetToken.objects.create(
            user=user, expires_at=timezone.now() + timedelta(hours=1)
        )
        link = f"{settings.FRONTEND_URL}/reset-password/{token.token}"
        send_email(
            to=user.email,
            template='custom',
            subject="Réinitialisation de votre mot de passe",
            body=(
                f"Bonjour {user.first_name or user.username},\n\n"
                f"Vous avez demandé à réinitialiser votre mot de passe.\n"
                f"Cliquez sur le lien ci-dessous (valable 1 heure) :\n\n"
                f"{link}\n\n"
                f"Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.\n\n"
                f"Cordialement,\n{getattr(settings, 'SCHOOL_NAME', 'SchoolPro')}"
            ),
        )
        logger.info("Email de réinitialisation envoyé à %s", user.email)
        return generic


class PasswordResetConfirmView(APIView):
    """Valide un jeton (GET) et applique le nouveau mot de passe (POST). Public."""
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'register'

    def _get_token(self, token):
        from .models import PasswordResetToken
        try:
            return PasswordResetToken.objects.select_related('user').get(token=token)
        except (PasswordResetToken.DoesNotExist, ValueError, Exception):
            return None

    def get(self, request, token):
        t = self._get_token(token)
        if not t:
            return Response({'valid': False, 'reason': 'Lien invalide.'}, status=404)
        if not t.is_valid:
            reason = 'Ce lien a déjà été utilisé.' if t.is_used else 'Ce lien a expiré.'
            return Response({'valid': False, 'reason': reason})
        return Response({'valid': True, 'username': t.user.username})

    def post(self, request, token):
        from django.utils import timezone
        from .serializers import validate_strong_password

        t = self._get_token(token)
        if not t:
            return Response({'error': 'Lien invalide.'}, status=404)
        if not t.is_valid:
            reason = 'Ce lien a déjà été utilisé.' if t.is_used else 'Ce lien a expiré.'
            return Response({'error': reason}, status=400)

        password = request.data.get('password') or ''
        try:
            validate_strong_password(password)
        except Exception as exc:
            from rest_framework.exceptions import ValidationError as DRFValidationError
            detail = exc.detail if isinstance(exc, DRFValidationError) else str(exc)
            return Response({'password': detail}, status=400)

        user = t.user
        user.set_password(password)
        user.save(update_fields=['password'])
        t.used_at = timezone.now()
        t.save(update_fields=['used_at'])

        from apps.users.models import log_activity
        log_activity(user, 'PASSWORD_RESET',
                     "Mot de passe réinitialisé via lien email", request)
        return Response({'message': 'Mot de passe réinitialisé avec succès.'})


class EcoleViewSet(viewsets.ModelViewSet):
    """Gestion des établissements (super-administrateur plateforme)."""
    permission_classes = [IsPlatformAdmin]
    serializer_class = EcoleSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        from .models import Ecole
        return Ecole.objects.all()

    def create(self, request, *args, **kwargs):
        # Mode mono-établissement : 1 seule école par installation
        from django.conf import settings as dj_settings
        from .models import Ecole
        if getattr(dj_settings, 'SINGLE_SCHOOL_MODE', True) and Ecole.objects.exists():
            return Response(
                {'error': "Mode mono-établissement : cette installation ne gère qu'une "
                          "seule école. Impossible d'en créer une autre."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().create(request, *args, **kwargs)


class NotificationListView(APIView):
    """Notifications récentes (polling temps réel). `?since=<id>` ne renvoie que
    les plus récentes que cet id."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import Notification
        qs = Notification.objects.all()
        since = request.query_params.get('since')
        if since and str(since).isdigit():
            qs = qs.filter(id__gt=int(since))
            items = list(qs.order_by('id'))  # ordre croissant pour les nouveautés
        else:
            items = list(qs.order_by('-id')[:20])
            items.reverse()
        data = [{
            'id': n.id, 'type': n.type, 'message': n.message,
            'created_at': n.created_at.isoformat(),
        } for n in items]
        last_id = Notification.objects.order_by('-id').values_list('id', flat=True).first() or 0
        return Response({'results': data, 'last_id': last_id})


class ActivityLogListView(generics.ListAPIView):
    """List activity logs — Director/Admin only."""
    permission_classes = [IsAdmin]

    def get(self, request):
        from apps.users.models import ActivityLog
        qs = ActivityLog.objects.select_related('user').all()
        action_filter = request.query_params.get('action')
        user_filter = request.query_params.get('user_id')
        if action_filter:
            qs = qs.filter(action=action_filter)
        if user_filter:
            qs = qs.filter(user_id=user_filter)
        data = [{
            'id': log.id,
            'user': log.user.get_full_name() if log.user else '—',
            'role': log.user.get_role_display() if log.user else '—',
            'action': log.action,
            'action_label': log.get_action_display(),
            'description': log.description,
            'ip_address': log.ip_address,
            'old_value': log.old_value,
            'new_value': log.new_value,
            'browser': log.browser,
            'os': log.os,
            'location': log.location,
            'timestamp': log.timestamp.strftime('%d/%m/%Y %H:%M:%S'),
        } for log in qs[:200]]
        return Response(data)