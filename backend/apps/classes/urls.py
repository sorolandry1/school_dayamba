from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AcademicYearViewSet, LevelViewSet, ClasseViewSet, ScheduleEntryViewSet,
    ScheduleFileViewSet, PensionTrancheViewSet,
)

router = DefaultRouter()
router.register('academic-years', AcademicYearViewSet)
router.register('levels', LevelViewSet)
router.register('schedule', ScheduleEntryViewSet, basename='schedule')
router.register('schedule-files', ScheduleFileViewSet, basename='schedule-file')
router.register('tranches', PensionTrancheViewSet, basename='tranche')
router.register('', ClasseViewSet, basename='classe')

urlpatterns = [
    path('', include(router.urls)),
]
