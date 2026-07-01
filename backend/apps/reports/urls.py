from django.urls import path
from .views import (
    BulletinPDFView, BulletinClassePDFView, DashboardStatsView,
    AttendanceReportView, AttendanceReportPDFView, PaymentReportView, ExcelExportView,
    ClassStatsView, DocumentTemplateListCreateView, DocumentTemplateDetailView,
    ReceiptPDFView, StudentCardPDFView, PlatformSettingsView, ClassListPDFView,
    SubjectSheetPDFView, ChartsView, AccountingView, AccountingExportView,
)

urlpatterns = [
    path('bulletin/<int:student_id>/', BulletinPDFView.as_view(), name='bulletin_pdf'),
    path('bulletin/classe/<int:classe_id>/', BulletinClassePDFView.as_view(), name='bulletin_classe_pdf'),
    path('dashboard/', DashboardStatsView.as_view(), name='dashboard_stats'),
    path('attendance/', AttendanceReportView.as_view(), name='attendance_report'),
    path('attendance/pdf/', AttendanceReportPDFView.as_view(), name='attendance_report_pdf'),
    path('payments/', PaymentReportView.as_view(), name='payment_report'),
    path('export/', ExcelExportView.as_view(), name='excel_export'),
    path('class_stats/', ClassStatsView.as_view(), name='class_stats'),
    path('charts/', ChartsView.as_view(), name='charts'),
    path('accounting/', AccountingView.as_view(), name='accounting'),
    path('accounting/export/', AccountingExportView.as_view(), name='accounting_export'),
    path('platform-settings/', PlatformSettingsView.as_view(), name='platform_settings'),
    path('class-list/<int:classe_id>/', ClassListPDFView.as_view(), name='class_list_pdf'),
    path('subject-sheet/', SubjectSheetPDFView.as_view(), name='subject_sheet_pdf'),
    # Template management
    path('templates/', DocumentTemplateListCreateView.as_view(), name='template_list'),
    path('templates/<int:pk>/', DocumentTemplateDetailView.as_view(), name='template_detail'),
    # Document PDFs with template
    path('receipt/<int:payment_id>/', ReceiptPDFView.as_view(), name='receipt_pdf'),
    path('card/<int:student_id>/', StudentCardPDFView.as_view(), name='card_pdf'),
]
