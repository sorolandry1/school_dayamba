from django.urls import path
from .views import (
    BulletinPDFView, BulletinClassePDFView, DashboardStatsView,
    AttendanceReportView, PaymentReportView, ExcelExportView,
    ClassStatsView,
)

urlpatterns = [
    path('bulletin/<int:student_id>/', BulletinPDFView.as_view(), name='bulletin_pdf'),
    path('bulletin/classe/<int:classe_id>/', BulletinClassePDFView.as_view(), name='bulletin_classe_pdf'),
    path('dashboard/', DashboardStatsView.as_view(), name='dashboard_stats'),
    path('attendance/', AttendanceReportView.as_view(), name='attendance_report'),
    path('payments/', PaymentReportView.as_view(), name='payment_report'),
    path('export/', ExcelExportView.as_view(), name='excel_export'),
    path('class_stats/', ClassStatsView.as_view(), name='class_stats'),
]
