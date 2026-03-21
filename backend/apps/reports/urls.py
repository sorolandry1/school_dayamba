from django.urls import path
from .views import BulletinPDFView, DashboardStatsView

urlpatterns = [
    path('bulletin/<int:student_id>/', BulletinPDFView.as_view(), name='bulletin_pdf'),
    path('dashboard/', DashboardStatsView.as_view(), name='dashboard_stats'),
]
