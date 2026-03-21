from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.http import HttpResponse
from apps.users.permissions import IsAdmin, IsAdminOrTeacher
from apps.students.models import Student
from apps.grades.models import Grade
from apps.subjects.models import Subject
from apps.attendance.models import Attendance
from apps.payments.models import Payment
from utils.pdf_generator import generate_bulletin_pdf
from django.db.models import Avg, Count, Q


class BulletinPDFView(APIView):
    permission_classes = [IsAdminOrTeacher]

    def get(self, request, student_id):
        try:
            student = Student.objects.select_related('classe', 'classe__level').get(id=student_id)
        except Student.DoesNotExist:
            return Response({'error': 'Élève non trouvé.'}, status=404)

        subjects = Subject.objects.filter(classe=student.classe)
        rankings_data = self._calculate_rankings(student)

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


class DashboardStatsView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
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

        payment_stats = Payment.objects.aggregate(
            total_collected=Avg('amount'),
            paid=Count('id', filter=Q(status='PAID')),
            pending=Count('id', filter=Q(status='PENDING')),
            overdue=Count('id', filter=Q(status='OVERDUE')),
        )

        from django.utils import timezone
        today = timezone.now().date()
        today_attendance = Attendance.objects.filter(date=today)
        attendance_stats = {
            'present_today': today_attendance.filter(status='PRESENT').count(),
            'late_today': today_attendance.filter(status='LATE').count(),
            'absent_today': total_students - today_attendance.count(),
        }

        return Response({
            'total_students': total_students,
            'total_teachers': total_teachers,
            'total_classes': total_classes,
            'payments': payment_stats,
            'attendance_today': attendance_stats,
        })
