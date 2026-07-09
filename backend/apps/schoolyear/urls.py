from django.urls import path
from .views import ArchivesView, ArchiveNowView, NewYearView, RestoreArchiveView

urlpatterns = [
    path('archives/', ArchivesView.as_view(), name='schoolyear_archives'),
    path('archive/', ArchiveNowView.as_view(), name='schoolyear_archive'),
    path('new/', NewYearView.as_view(), name='schoolyear_new'),
    path('restore/', RestoreArchiveView.as_view(), name='schoolyear_restore'),
]
