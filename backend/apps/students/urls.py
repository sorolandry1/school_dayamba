from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import StudentViewSet, StudentDocumentViewSet

router = DefaultRouter()
# 'documents' AVANT '' sinon la route détail de StudentViewSet capture le préfixe
router.register('documents', StudentDocumentViewSet, basename='studentdocument')
router.register('', StudentViewSet)

urlpatterns = [path('', include(router.urls))]
