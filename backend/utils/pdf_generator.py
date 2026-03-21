"""PDF Bulletin Generator using ReportLab."""
import io
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph,
    Spacer, HRFlowable
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from django.db.models import Avg


def generate_bulletin_pdf(student, subjects, rankings_data):
    """Generate a PDF bulletin for a student."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=1.5 * cm, leftMargin=1.5 * cm,
        topMargin=1.5 * cm, bottomMargin=1.5 * cm
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle', parent=styles['Title'],
        fontSize=16, textColor=colors.HexColor('#1a365d'),
        spaceAfter=6
    )
    subtitle_style = ParagraphStyle(
        'Subtitle', parent=styles['Normal'],
        fontSize=11, textColor=colors.HexColor('#4a5568'),
        alignment=TA_CENTER, spaceAfter=12
    )
    header_style = ParagraphStyle(
        'Header', parent=styles['Normal'],
        fontSize=10, textColor=colors.HexColor('#2d3748'),
        spaceAfter=4
    )

    elements = []

    # Header
    elements.append(Paragraph("BULLETIN DE NOTES", title_style))
    if student.classe:
        year_name = student.classe.academic_year.name if student.classe.academic_year else ''
        elements.append(Paragraph(f"Année scolaire {year_name}", subtitle_style))

    elements.append(Spacer(1, 8))

    # Student info table
    student_info = [
        ['Nom & Prénom:', student.full_name, 'Matricule:', student.matricule],
        ['Classe:', student.classe.name if student.classe else '-',
         'Rang:', f"{rankings_data.get('rank', '-')}/{rankings_data.get('total_students', '-')}"],
    ]
    info_table = Table(student_info, colWidths=[3.5 * cm, 6 * cm, 3 * cm, 5 * cm])
    info_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#4a5568')),
        ('TEXTCOLOR', (2, 0), (2, -1), colors.HexColor('#4a5568')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 12))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e2e8f0')))
    elements.append(Spacer(1, 12))

    # Grades table
    from apps.grades.models import Grade

    table_data = [['Matière', 'Coefficient', 'Moyenne', 'Appréciation']]
    total_weighted = 0
    total_coeff = 0

    for subject in subjects:
        grades = Grade.objects.filter(student=student, subject=subject)
        if grades.exists():
            avg = grades.aggregate(a=Avg('value'))['a']
            avg = round(float(avg), 2)
        else:
            avg = 0

        coeff = float(subject.coefficient)
        total_weighted += avg * coeff
        total_coeff += coeff

        if avg >= 16:
            appreciation = 'Très Bien'
        elif avg >= 14:
            appreciation = 'Bien'
        elif avg >= 12:
            appreciation = 'Assez Bien'
        elif avg >= 10:
            appreciation = 'Passable'
        else:
            appreciation = 'Insuffisant'

        table_data.append([
            subject.name,
            str(subject.coefficient),
            f"{avg}/20",
            appreciation
        ])

    general_avg = round(total_weighted / total_coeff, 2) if total_coeff > 0 else 0
    table_data.append(['', '', '', ''])
    table_data.append(['MOYENNE GÉNÉRALE', '', f'{general_avg}/20', ''])

    grades_table = Table(table_data, colWidths=[6.5 * cm, 3 * cm, 3.5 * cm, 5 * cm])
    grades_table.setStyle(TableStyle([
        # Header row
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2b6cb0')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        # Body
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('ALIGN', (1, 1), (2, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -3), 0.5, colors.HexColor('#cbd5e0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -3), [colors.white, colors.HexColor('#f7fafc')]),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        # Average row
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, -1), (-1, -1), 11),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#ebf8ff')),
        ('TEXTCOLOR', (0, -1), (-1, -1), colors.HexColor('#2b6cb0')),
        ('LINEABOVE', (0, -1), (-1, -1), 1.5, colors.HexColor('#2b6cb0')),
    ]))
    elements.append(grades_table)
    elements.append(Spacer(1, 20))

    # Summary
    class_avg = rankings_data.get('class_average', 0)
    rank = rankings_data.get('rank', '-')
    total_s = rankings_data.get('total_students', '-')

    if general_avg >= 16:
        gen_appreciation = 'Très Bien'
    elif general_avg >= 14:
        gen_appreciation = 'Bien'
    elif general_avg >= 12:
        gen_appreciation = 'Assez Bien'
    elif general_avg >= 10:
        gen_appreciation = 'Passable'
    else:
        gen_appreciation = 'Insuffisant'

    summary_data = [
        ['Moyenne de l\'élève', f'{general_avg}/20'],
        ['Moyenne de la classe', f'{class_avg}/20'],
        ['Rang', f'{rank}/{total_s}'],
        ['Appréciation générale', gen_appreciation],
    ]
    summary_table = Table(summary_data, colWidths=[7 * cm, 5 * cm])
    summary_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f7fafc')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(summary_table)

    doc.build(elements)
    buffer.seek(0)
    return buffer
