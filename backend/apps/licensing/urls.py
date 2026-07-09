from django.urls import path
from .views import LicenseStatusView, LicenseActivateView

urlpatterns = [
    path('status/', LicenseStatusView.as_view(), name='license_status'),
    path('activate/', LicenseActivateView.as_view(), name='license_activate'),
]
