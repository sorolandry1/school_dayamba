from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TeacherViewSet, LessonLogViewSet

router = DefaultRouter()
router.register('', TeacherViewSet, basename='teacher')
router.register('lesson-logs', LessonLogViewSet, basename='lessonlog')

urlpatterns = [path('', include(router.urls))]
