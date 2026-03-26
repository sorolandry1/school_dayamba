from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import LoginView, MeView, ChangePasswordView, UserViewSet, ActivityLogListView

router = DefaultRouter()
router.register('users', UserViewSet)

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', MeView.as_view(), name='me'),
    path('change-password/', ChangePasswordView.as_view(), name='change_password'),
    path('activity-logs/', ActivityLogListView.as_view(), name='activity_logs'),
    path('', include(router.urls)),
]
