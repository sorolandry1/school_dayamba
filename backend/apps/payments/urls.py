from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PaymentViewSet, ExpenseViewSet, BroadcastSMSView

router = DefaultRouter()
router.register('', PaymentViewSet, basename='payment')
router.register('expenses', ExpenseViewSet, basename='expense')
router.register('broadcast', BroadcastSMSView, basename='broadcast')

urlpatterns = [path('', include(router.urls))]
