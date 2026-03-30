from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate, get_user_model
from .serializers import UserSerializer, UserCreateSerializer, ChangePasswordSerializer, LoginSerializer
from .permissions import IsAdmin
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
            'timestamp': log.timestamp.strftime('%d/%m/%Y %H:%M:%S'),
        } for log in qs[:200]]
        return Response(data)