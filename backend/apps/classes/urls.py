from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AcademicYearViewSet, LevelViewSet, ClasseViewSet, ScheduleEntryViewSet, ScheduleFileViewSet

router = DefaultRouter()
router.register('academic-years', AcademicYearViewSet)
router.register('levels', LevelViewSet)
router.register('schedule', ScheduleEntryViewSet, basename='schedule')
router.register('schedule-files', ScheduleFileViewSet, basename='schedule-file')
router.register('', ClasseViewSet, basename='classe')

urlpatterns = [
    path('', include(router.urls)),
]
