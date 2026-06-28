from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TeacherViewSet, LessonLogViewSet

router = DefaultRouter()
# Les préfixes spécifiques DOIVENT être enregistrés avant le préfixe vide '',
# sinon la route détail de TeacherViewSet (^(?P<pk>[^/.]+)/$) capture
# 'lesson-logs/' comme un id de professeur → 404.
router.register('lesson-logs', LessonLogViewSet, basename='lessonlog')
router.register('', TeacherViewSet, basename='teacher')

urlpatterns = [path('', include(router.urls))]
