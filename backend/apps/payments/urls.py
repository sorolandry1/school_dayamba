from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PaymentViewSet, ExpenseViewSet, BroadcastSMSView

router = DefaultRouter()
# Les préfixes spécifiques DOIVENT être enregistrés avant le préfixe vide '',
# sinon la route détail de PaymentViewSet (^(?P<pk>[^/.]+)/$) capture
# 'expenses/' et 'broadcast/' comme des id de paiement → 404.
router.register('expenses', ExpenseViewSet, basename='expense')
router.register('broadcast', BroadcastSMSView, basename='broadcast')
router.register('', PaymentViewSet, basename='payment')

urlpatterns = [path('', include(router.urls))]
