from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    LoginView, MeView, ChangePasswordView, UserViewSet, ActivityLogListView,
    InvitationViewSet, PublicInvitationView,
    PasswordResetRequestView, PasswordResetConfirmView, NotificationListView,
)

router = DefaultRouter()
router.register('users', UserViewSet)
router.register('invitations', InvitationViewSet, basename='invitation')

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', MeView.as_view(), name='me'),
    path('change-password/', ChangePasswordView.as_view(), name='change_password'),
    path('activity-logs/', ActivityLogListView.as_view(), name='activity_logs'),
    path('notifications/', NotificationListView.as_view(), name='notifications'),
    # Inscription publique via lien d'invitation
    path('register/<uuid:token>/', PublicInvitationView.as_view(), name='register'),
    # Réinitialisation de mot de passe (mot de passe oublié)
    path('password-reset/request/', PasswordResetRequestView.as_view(), name='password_reset_request'),
    path('password-reset/<uuid:token>/', PasswordResetConfirmView.as_view(), name='password_reset_confirm'),
    path('', include(router.urls)),
]
