import io
import zipfile
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.http import HttpResponse
from django.db.models import Sum, Count, Q, Avg as DAvg
from apps.users.permissions import IsAdmin, IsAdminOrTeacher
from apps.students.models import Student
from apps.grades.models import Grade
from apps.subjects.models import Subject
from apps.attendance.models import Attendance
from apps.payments.models import Payment
from apps.classes.models import Classe
from utils.pdf_generator import (
    generate_bulletin_pdf, generate_bulletin_pdf_templated,
    generate_receipt_pdf_templated, generate_card_pdf_templated,
)
from django.db.models import Avg, Count, Q


class BulletinPDFView(APIView):
    permission_classes = [IsAdminOrTeacher]

    def _get_template_config(self, request):
        from .models import DocumentTemplate
        template_id = request.query_params.get('template_id')
        if template_id:
            try:
                return DocumentTemplate.objects.get(id=template_id, document_type='bulletin').config
            except DocumentTemplate.DoesNotExist:
                pass
        tmpl = DocumentTemplate.objects.filter(document_type='bulletin', is_default=True).first()
        return tmpl.config if tmpl else None

    def get(self, request, student_id):
        try:
            student = Student.objects.select_related('classe', 'classe__level').get(id=student_id)
        except Student.DoesNotExist:
            return Response({'error': 'Élève non trouvé.'}, status=404)

        subjects = Subject.objects.filter(classe=student.classe)
        rankings_data = self._calculate_rankings(student)
        template_config = self._get_template_config(request)

        if template_config:
            pdf_buffer = generate_bulletin_pdf_templated(student, subjects, rankings_data, template_config)
        else:
            pdf_buffer = generate_bulletin_pdf(student, subjects, rankings_data)

        response = HttpResponse(pdf_buffer, content_type='application/pdf')
        response['Content-Disposition'] = (
            f'attachment; filename="bulletin_{student.matricule}.pdf"'
        )
        return response

    def _calculate_rankings(self, student):
        if not student.classe:
            return {}
        subjects = Subject.objects.filter(classe=student.classe)
        students_in_class = Student.objects.filter(classe=student.classe, is_active=True)
        rankings = []
        for s in students_in_class:
            total_weighted = 0
            total_coeff = 0
            for subj in subjects:
                grades = Grade.objects.filter(student=s, subject=subj)
                if grades.exists():
                    avg = grades.aggregate(a=Avg('value'))['a']
                    coeff = float(subj.coefficient)
                    total_weighted += float(avg) * coeff
                    total_coeff += coeff
            general_avg = round(total_weighted / total_coeff, 2) if total_coeff > 0 else 0
            rankings.append({'student_id': s.id, 'average': general_avg})
        rankings.sort(key=lambda x: x['average'], reverse=True)
        rank = next((i + 1 for i, r in enumerate(rankings) if r['student_id'] == student.id), 0)
        student_avg = next((r['average'] for r in rankings if r['student_id'] == student.id), 0)
        return {
            'rank': rank,
            'total_students': len(rankings),
            'general_average': student_avg,
            'class_average': round(sum(r['average'] for r in rankings) / len(rankings), 2) if rankings else 0,
        }


class BulletinClassePDFView(APIView):
    """Generate a ZIP containing all bulletins for a given class."""
    permission_classes = [IsAdminOrTeacher]

    def get(self, request, classe_id):
        try:
            classe = Classe.objects.select_related('academic_year', 'level').get(id=classe_id)
        except Classe.DoesNotExist:
            return Response({'error': 'Classe non trouvée.'}, status=404)

        students = Student.objects.filter(classe=classe, is_active=True).order_by('last_name', 'first_name')
        if not students.exists():
            return Response({'error': 'Aucun élève dans cette classe.'}, status=404)

        subjects = Subject.objects.filter(classe=classe)

        # Template support
        from .models import DocumentTemplate
        template_config = None
        template_id = request.query_params.get('template_id')
        if template_id:
            tmpl = DocumentTemplate.objects.filter(id=template_id, document_type='bulletin').first()
            if tmpl:
                template_config = tmpl.config
        else:
            tmpl = DocumentTemplate.objects.filter(document_type='bulletin', is_default=True).first()
            if tmpl:
                template_config = tmpl.config

        # Pre-calculate rankings for all students once
        rankings_map = self._calculate_all_rankings(students, subjects)

        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            for student in students:
                rankings_data = rankings_map.get(student.id, {})
                if template_config:
                    pdf_buffer = generate_bulletin_pdf_templated(student, subjects, rankings_data, template_config)
                else:
                    pdf_buffer = generate_bulletin_pdf(student, subjects, rankings_data)
                filename = f"bulletin_{student.matricule}_{student.last_name}_{student.first_name}.pdf"
                zf.writestr(filename, pdf_buffer.read())

        zip_buffer.seek(0)
        safe_name = classe.name.replace(' ', '_').replace('/', '-')
        response = HttpResponse(zip_buffer, content_type='application/zip')
        response['Content-Disposition'] = f'attachment; filename="bulletins_{safe_name}.zip"'
        return response

    def _calculate_all_rankings(self, students, subjects):
        averages = []
        for s in students:
            total_weighted = 0
            total_coeff = 0
            for subj in subjects:
                grades = Grade.objects.filter(student=s, subject=subj)
                if grades.exists():
                    avg = grades.aggregate(a=Avg('value'))['a']
                    total_weighted += float(avg) * float(subj.coefficient)
                    total_coeff += float(subj.coefficient)
            general_avg = round(total_weighted / total_coeff, 2) if total_coeff > 0 else 0
            averages.append({'student_id': s.id, 'average': general_avg})

        averages.sort(key=lambda x: x['average'], reverse=True)
        class_avg = round(sum(a['average'] for a in averages) / len(averages), 2) if averages else 0
        total_students = len(averages)

        result = {}
        for i, entry in enumerate(averages):
            result[entry['student_id']] = {
                'rank': i + 1,
                'total_students': total_students,
                'general_average': entry['average'],
                'class_average': class_avg,
            }
        return result


class DashboardStatsView(APIView):
    permission_classes = [IsAdmin]
    CACHE_TTL = 60  # seconds — short enough for real-time attendance to feel live

    def get(self, request):
        from django.core.cache import cache
        cache_key = 'dashboard_stats_admin'
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        total_students = Student.objects.filter(is_active=True).count()
        total_teachers = 0
        try:
            from apps.teachers.models import Teacher
            total_teachers = Teacher.objects.count()
        except Exception:
            pass

        from apps.classes.models import Classe, AcademicYear
        current_year = AcademicYear.objects.filter(is_current=True).first()
        total_classes = Classe.objects.filter(academic_year=current_year).count() if current_year else 0

        from django.db.models import Sum as _Sum
        payment_stats = {
            'total_collected': Payment.objects.filter(status='PAID').aggregate(t=_Sum('amount'))['t'] or 0,
            'total_pending': Payment.objects.filter(status='PENDING').aggregate(t=_Sum('amount'))['t'] or 0,
            'total_overdue': Payment.objects.filter(status='OVERDUE').aggregate(t=_Sum('amount'))['t'] or 0,
            'count_paid': Payment.objects.filter(status='PAID').count(),
            'count_pending': Payment.objects.filter(status='PENDING').count(),
            'count_overdue': Payment.objects.filter(status='OVERDUE').count(),
        }

        from django.utils import timezone
        today = timezone.now().date()
        today_attendance = Attendance.objects.filter(date=today)
        scanned_in = today_attendance.filter(status__in=['PRESENT', 'LATE']).count()
        attendance_stats = {
            'present_today': today_attendance.filter(status='PRESENT').count(),
            'late_today': today_attendance.filter(status='LATE').count(),
            'absent_today': max(0, total_students - scanned_in),
        }

        from apps.payments.models import Expense
        from django.db.models import Sum as _Sum2
        expense_stats = {
            'total_expenses': float(Expense.objects.aggregate(t=_Sum2('amount'))['t'] or 0),
            'net_balance': float(
                (Payment.objects.filter(status='PAID').aggregate(t=_Sum2('amount'))['t'] or 0) -
                (Expense.objects.aggregate(t=_Sum2('amount'))['t'] or 0)
            ),
        }

        result = {
            'total_students': total_students,
            'total_teachers': total_teachers,
            'total_classes': total_classes,
            'payments': payment_stats,
            'attendance_today': attendance_stats,
            'expenses': expense_stats,
        }
        cache.set(cache_key, result, self.CACHE_TTL)
        return Response(result)


class AttendanceReportView(APIView):
    """Absence report per class with optional date range."""
    permission_classes = [IsAdmin]

    def get(self, request):
        classe_id = request.query_params.get('classe_id')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')

        students_qs = Student.objects.filter(is_active=True)
        if classe_id:
            students_qs = students_qs.filter(classe_id=classe_id)

        attendance_qs = Attendance.objects.all()
        if classe_id:
            attendance_qs = attendance_qs.filter(student__classe_id=classe_id)
        if date_from:
            attendance_qs = attendance_qs.filter(date__gte=date_from)
        if date_to:
            attendance_qs = attendance_qs.filter(date__lte=date_to)

        # Per-student summary
        result = []
        for student in students_qs.select_related('classe'):
            records = attendance_qs.filter(student=student)
            agg = records.aggregate(
                total=Count('id'),
                present=Count('id', filter=Q(status='PRESENT')),
                absent=Count('id', filter=Q(status='ABSENT')),
                late=Count('id', filter=Q(status='LATE')),
            )
            total_hours_absent = sum(
                r.hours_absent for r in records if r.hours_absent
            )
            result.append({
                'student_id': student.id,
                'student_name': student.full_name,
                'classe': student.classe.name if student.classe else '—',
                'total_days': agg['total'],
                'present': agg['present'],
                'absent': agg['absent'],
                'late': agg['late'],
                'hours_absent': round(total_hours_absent, 1),
            })

        result.sort(key=lambda x: (x['classe'], x['student_name']))

        # Class-level aggregates
        global_stats = attendance_qs.aggregate(
            total=Count('id'),
            present=Count('id', filter=Q(status='PRESENT')),
            absent=Count('id', filter=Q(status='ABSENT')),
            late=Count('id', filter=Q(status='LATE')),
        )

        return Response({'students': result, 'global': global_stats})


class PaymentReportView(APIView):
    """Payment rates per class."""
    permission_classes = [IsAdmin]

    def get(self, request):
        classe_id = request.query_params.get('classe_id')

        classes_qs = Classe.objects.all()
        if classe_id:
            classes_qs = classes_qs.filter(id=classe_id)

        result = []
        for cls in classes_qs.prefetch_related('students'):
            students = cls.students.filter(is_active=True)
            total = students.count()
            paid = students.filter(payment_status='PAID').count()
            pending = students.filter(payment_status='PENDING').count()
            overdue = students.filter(payment_status='OVERDUE').count()

            payments = Payment.objects.filter(student__classe=cls)
            collected = payments.filter(status='PAID').aggregate(t=Sum('amount'))['t'] or 0
            pending_amt = payments.filter(status='PENDING').aggregate(t=Sum('amount'))['t'] or 0
            overdue_amt = payments.filter(status='OVERDUE').aggregate(t=Sum('amount'))['t'] or 0

            result.append({
                'classe_id': cls.id,
                'classe_name': cls.name,
                'total_students': total,
                'paid_count': paid,
                'pending_count': pending,
                'overdue_count': overdue,
                'rate': round(paid / total * 100, 1) if total > 0 else 0,
                'total_collected': float(collected),
                'total_pending': float(pending_amt),
                'total_overdue': float(overdue_amt),
            })

        return Response(result)


class ExcelExportView(APIView):
    """Export grades, absences, or payments to Excel."""
    permission_classes = [IsAdmin]

    def get(self, request):
        export_type = request.query_params.get('type', 'grades')
        classe_id = request.query_params.get('classe_id')

        wb = openpyxl.Workbook()
        ws = wb.active

        # Styles
        header_font = Font(bold=True, color='FFFFFF', size=11)
        header_fill = PatternFill(start_color='1E40AF', end_color='1E40AF', fill_type='solid')
        header_align = Alignment(horizontal='center', vertical='center')
        thin = Side(style='thin', color='D1D5DB')
        border = Border(left=thin, right=thin, top=thin, bottom=thin)

        def style_header(row_num, num_cols):
            for col in range(1, num_cols + 1):
                cell = ws.cell(row=row_num, column=col)
                cell.font = header_font
                cell.fill = header_fill
                cell.alignment = header_align
                cell.border = border

        def style_row(row_num, num_cols, even):
            fill_color = 'F8FAFF' if even else 'FFFFFF'
            for col in range(1, num_cols + 1):
                cell = ws.cell(row=row_num, column=col)
                cell.fill = PatternFill(start_color=fill_color, end_color=fill_color, fill_type='solid')
                cell.border = border
                cell.alignment = Alignment(vertical='center')

        if export_type == 'grades':
            ws.title = 'Notes'
            headers = ['Élève', 'Classe', 'Matière', 'Type', 'Note', 'Note Max', 'Note /20', 'Date']
            ws.append(headers)
            style_header(1, len(headers))

            qs = Grade.objects.select_related('student', 'student__classe', 'subject').all()
            if classe_id:
                qs = qs.filter(student__classe_id=classe_id)

            for i, g in enumerate(qs):
                row = [
                    g.student.full_name,
                    g.student.classe.name if g.student.classe else '—',
                    g.subject.name,
                    g.get_type_evaluation_display(),
                    float(g.value),
                    float(g.max_value),
                    g.normalized_value,
                    str(g.date),
                ]
                ws.append(row)
                style_row(i + 2, len(headers), i % 2 == 0)

            col_widths = [25, 12, 20, 15, 8, 8, 8, 12]

        elif export_type == 'absences':
            ws.title = 'Absences'
            headers = ['Élève', 'Classe', 'Date', 'Heure Entrée', 'Heure Sortie', 'Statut', 'Heures Absence']
            ws.append(headers)
            style_header(1, len(headers))

            qs = Attendance.objects.select_related('student', 'student__classe').all()
            if classe_id:
                qs = qs.filter(student__classe_id=classe_id)

            for i, a in enumerate(qs):
                row = [
                    a.student.full_name,
                    a.student.classe.name if a.student.classe else '—',
                    str(a.date),
                    str(a.check_in) if a.check_in else '—',
                    str(a.check_out) if a.check_out else '—',
                    a.get_status_display(),
                    a.hours_absent,
                ]
                ws.append(row)
                style_row(i + 2, len(headers), i % 2 == 0)

            col_widths = [25, 12, 12, 12, 12, 12, 15]

        elif export_type == 'payments':
            ws.title = 'Paiements'
            headers = ['Élève', 'Classe', 'Type', 'Montant (FCFA)', 'Statut', 'Date Paiement', 'Échéance', 'N° Reçu']
            ws.append(headers)
            style_header(1, len(headers))

            qs = Payment.objects.select_related('student', 'student__classe').all()
            if classe_id:
                qs = qs.filter(student__classe_id=classe_id)

            for i, p in enumerate(qs):
                row = [
                    p.student.full_name,
                    p.student.classe.name if p.student.classe else '—',
                    p.get_payment_type_display(),
                    float(p.amount),
                    p.get_status_display(),
                    str(p.payment_date),
                    str(p.due_date) if p.due_date else '—',
                    p.receipt_number,
                ]
                ws.append(row)
                style_row(i + 2, len(headers), i % 2 == 0)

            col_widths = [25, 12, 20, 15, 12, 14, 12, 18]

        elif export_type == 'rankings':
            ws.title = 'Classement'
            headers = ['Rang', 'Élève', 'Classe', 'Moyenne Générale', 'Appréciation']
            ws.append(headers)
            style_header(1, len(headers))

            if not classe_id:
                return Response({'error': 'classe_id requis pour le classement'}, status=400)

            students = Student.objects.filter(classe_id=classe_id, is_active=True)
            subjects = Subject.objects.filter(classe_id=classe_id)
            rankings = []
            for s in students:
                tw, tc = 0, 0
                for subj in subjects:
                    grades = Grade.objects.filter(student=s, subject=subj)
                    if grades.exists():
                        avg = grades.aggregate(a=DAvg('value'))['a']
                        tw += float(avg) * float(subj.coefficient)
                        tc += float(subj.coefficient)
                general_avg = round(tw / tc, 2) if tc > 0 else 0
                appreciation = (
                    'Très Bien' if general_avg >= 16 else
                    'Bien' if general_avg >= 14 else
                    'Assez Bien' if general_avg >= 12 else
                    'Passable' if general_avg >= 10 else 'Insuffisant'
                )
                rankings.append((s, general_avg, appreciation))

            rankings.sort(key=lambda x: x[1], reverse=True)
            for i, (s, avg, appr) in enumerate(rankings):
                row = [i + 1, s.full_name, s.classe.name if s.classe else '—', avg, appr]
                ws.append(row)
                style_row(i + 2, len(headers), i % 2 == 0)

            col_widths = [8, 28, 14, 18, 15]

        else:
            return Response({'error': 'type invalide'}, status=400)

        # Set column widths
        for i, width in enumerate(col_widths, 1):
            ws.column_dimensions[openpyxl.utils.get_column_letter(i)].width = width

        ws.row_dimensions[1].height = 22

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)

        filename = f"export_{export_type}.xlsx"
        response = HttpResponse(
            output,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


class ClassStatsView(APIView):
    """Per-class statistics: student count, grade average, attendance rates."""
    permission_classes = [IsAdmin]

    def get(self, request):
        from django.utils import timezone
        today = timezone.now().date()

        classes = Classe.objects.select_related('level').all()
        class_ids = list(classes.values_list('id', flat=True))

        # --- Bulk grade averages per class ---
        grade_rows = (
            Grade.objects
            .filter(student__classe_id__in=class_ids)
            .values('student__classe_id')
            .annotate(avg=Avg('value'))
        )
        grade_avg_map = {row['student__classe_id']: row['avg'] for row in grade_rows}

        # --- Bulk attendance totals per class (all time) ---
        attendance_rows = (
            Attendance.objects
            .filter(student__classe_id__in=class_ids)
            .values('student__classe_id')
            .annotate(
                total=Count('id'),
                absent=Count('id', filter=Q(status='ABSENT')),
            )
        )
        attendance_map = {
            row['student__classe_id']: row
            for row in attendance_rows
        }

        # --- Bulk today's attendance per class ---
        today_rows = (
            Attendance.objects
            .filter(student__classe_id__in=class_ids, date=today)
            .values('student__classe_id')
            .annotate(
                present_count=Count('id', filter=Q(status='PRESENT')),
                absent_count=Count('id', filter=Q(status='ABSENT')),
                late_count=Count('id', filter=Q(status='LATE')),
            )
        )
        today_map = {row['student__classe_id']: row for row in today_rows}

        # --- Bulk student counts per class ---
        student_counts = (
            Student.objects
            .filter(classe_id__in=class_ids, is_active=True)
            .values('classe_id')
            .annotate(count=Count('id'))
        )
        student_count_map = {row['classe_id']: row['count'] for row in student_counts}

        result = []
        for cls in classes:
            cid = cls.id

            raw_avg = grade_avg_map.get(cid)
            average = round(raw_avg, 1) if raw_avg is not None else None

            att = attendance_map.get(cid, {})
            total_att = att.get('total', 0) or 0
            absent_att = att.get('absent', 0) or 0
            absent_rate = round(absent_att / total_att * 100, 1) if total_att > 0 else 0

            td = today_map.get(cid, {})

            result.append({
                'id': cid,
                'name': cls.name,
                'level_id': cls.level_id,
                'level_name': cls.level.name if cls.level else None,
                'student_count': student_count_map.get(cid, 0),
                'average': average,
                'absent_rate': absent_rate,
                'present_count': td.get('present_count', 0) or 0,
                'absent_count': td.get('absent_count', 0) or 0,
                'late_count': td.get('late_count', 0) or 0,
            })

        return Response(result)


# ────────────────────────────────────────────────────────────────
# Document Template CRUD
# ────────────────────────────────────────────────────────────────

class DocumentTemplateListCreateView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        from .models import DocumentTemplate
        from .serializers import DocumentTemplateSerializer
        doc_type = request.query_params.get('document_type')
        qs = DocumentTemplate.objects.all()
        if doc_type:
            qs = qs.filter(document_type=doc_type)
        return Response(DocumentTemplateSerializer(qs, many=True).data)

    def post(self, request):
        from .models import DocumentTemplate
        from .serializers import DocumentTemplateSerializer
        ser = DocumentTemplateSerializer(data=request.data)
        if ser.is_valid():
            ser.save(created_by=request.user)
            return Response(ser.data, status=201)
        return Response(ser.errors, status=400)


class DocumentTemplateDetailView(APIView):
    permission_classes = [IsAdmin]

    def _get_obj(self, pk):
        from .models import DocumentTemplate
        try:
            return DocumentTemplate.objects.get(pk=pk)
        except DocumentTemplate.DoesNotExist:
            return None

    def get(self, request, pk):
        from .serializers import DocumentTemplateSerializer
        obj = self._get_obj(pk)
        if not obj:
            return Response({'error': 'Modèle introuvable.'}, status=404)
        return Response(DocumentTemplateSerializer(obj).data)

    def put(self, request, pk):
        from .serializers import DocumentTemplateSerializer
        obj = self._get_obj(pk)
        if not obj:
            return Response({'error': 'Modèle introuvable.'}, status=404)
        ser = DocumentTemplateSerializer(obj, data=request.data, partial=True)
        if ser.is_valid():
            ser.save()
            return Response(ser.data)
        return Response(ser.errors, status=400)

    def delete(self, request, pk):
        obj = self._get_obj(pk)
        if not obj:
            return Response({'error': 'Modèle introuvable.'}, status=404)
        obj.delete()
        return Response(status=204)


# ────────────────────────────────────────────────────────────────
# Receipt & Card PDF with template support
# ────────────────────────────────────────────────────────────────

class ReceiptPDFView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request, payment_id):
        try:
            payment = Payment.objects.select_related(
                'student', 'student__classe', 'recorded_by'
            ).get(id=payment_id)
        except Payment.DoesNotExist:
            return Response({'error': 'Paiement non trouvé.'}, status=404)

        from .models import DocumentTemplate
        template_config = {}
        template_id = request.query_params.get('template_id')
        if template_id:
            tmpl = DocumentTemplate.objects.filter(id=template_id, document_type='receipt').first()
            if tmpl:
                template_config = tmpl.config
        else:
            tmpl = DocumentTemplate.objects.filter(document_type='receipt', is_default=True).first()
            if tmpl:
                template_config = tmpl.config

        pdf_buffer = generate_receipt_pdf_templated(payment, template_config)
        response = HttpResponse(pdf_buffer, content_type='application/pdf')
        response['Content-Disposition'] = (
            f'attachment; filename="recu_{payment.receipt_number}.pdf"'
        )
        return response


class StudentCardPDFView(APIView):
    permission_classes = [IsAdminOrTeacher]

    def get(self, request, student_id):
        try:
            student = Student.objects.select_related(
                'classe', 'classe__academic_year'
            ).get(id=student_id)
        except Student.DoesNotExist:
            return Response({'error': 'Élève non trouvé.'}, status=404)

        from .models import DocumentTemplate
        template_config = {}
        template_id = request.query_params.get('template_id')
        if template_id:
            tmpl = DocumentTemplate.objects.filter(id=template_id, document_type='card').first()
            if tmpl:
                template_config = tmpl.config
        else:
            tmpl = DocumentTemplate.objects.filter(document_type='card', is_default=True).first()
            if tmpl:
                template_config = tmpl.config

        pdf_buffer = generate_card_pdf_templated(student, template_config)
        response = HttpResponse(pdf_buffer, content_type='application/pdf')
        response['Content-Disposition'] = (
            f'attachment; filename="carte_{student.matricule}.pdf"'
        )
        return response
