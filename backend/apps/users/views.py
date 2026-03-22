import sys
from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate, get_user_model
from .serializers import UserSerializer, UserCreateSerializer, ChangePasswordSerializer, LoginSerializer
from .permissions import IsAdmin
import logging

User = get_user_model()
logger = logging.getLogger('apps')


class LoginView(generics.GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = LoginSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        username = serializer.validated_data.get('username', '').strip()
        password = serializer.validated_data.get('password', '')

        print(f">>> USERNAME: {username}", file=sys.stderr, flush=True)
        print(f">>> PASSWORD: {password}", file=sys.stderr, flush=True)

        from apps.users.models import User as U
        exists = U.objects.filter(username=username).exists()
        print(f">>> EXISTS: {exists}", file=sys.stderr, flush=True)
        if exists:
            u = U.objects.get(username=username)
            print(f">>> CHECK_PASSWORD: {u.check_password(password)}", file=sys.stderr, flush=True)
            print(f">>> IS_ACTIVE: {u.is_active}", file=sys.stderr, flush=True)

        user = authenticate(request=request, username=username, password=password)
        print(f">>> AUTH RESULT: {user}", file=sys.stderr, flush=True)

        if user is None:
            return Response({'error': 'Identifiants invalides.'}, status=status.HTTP_401_UNAUTHORIZED)
        if not user.is_active:
            return Response({'error': 'Compte desactive.'}, status=status.HTTP_403_FORBIDDEN)

        refresh = RefreshToken.for_user(user)
        logger.info(f"Connexion reussie: {user.username} ({user.role})")
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

    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        user = self.get_object()
        user.is_active = not user.is_active
        user.save()
        return Response({'is_active': user.is_active})

    @action(detail=True, methods=['post'])
    def reset_password(self, request, pk=None):
        user = self.get_object()
        new_password = request.data.get('password', 'changeme123')
        user.set_password(new_password)
        user.save()
        return Response({'message': 'Mot de passe reinitialise.'})