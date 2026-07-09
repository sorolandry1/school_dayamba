from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AdminStaffViewSet, SalaryPaymentViewSet

router = DefaultRouter()
router.register('staff', AdminStaffViewSet, basename='admin-staff')
router.register('salaries', SalaryPaymentViewSet, basename='salary')

urlpatterns = [path('', include(router.urls))]
