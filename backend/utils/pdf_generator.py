"""PDF Bulletin Generator using ReportLab."""
import io
import uuid as _uuid
from datetime import date as _date
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


# ────────────────────────────────────────────────────────────────
# TOKEN RESOLUTION ENGINE
# ────────────────────────────────────────────────────────────────

def _appreciation(avg):
    """Return appreciation string for a given average."""
    if avg is None:
        return ''
    if avg >= 16: return 'Très Bien'
    if avg >= 14: return 'Bien'
    if avg >= 12: return 'Assez Bien'
    if avg >= 10: return 'Passable'
    return 'Insuffisant'


def _platform_settings():
    """Réglages d'identité de l'établissement (singleton), ou None."""
    try:
        from apps.reports.models import PlatformSettings
        return PlatformSettings.get_solo()
    except Exception:
        return None


def build_token_context(student=None, rankings_data=None, payment=None, subjects=None):
    """Build a complete token → value map for a given document context."""
    ctx = {}
    ps = _platform_settings()

    # ── Document ──
    doc_number = str(_uuid.uuid4())[:8].upper()
    ctx['{{NUMERO_DOC}}']      = doc_number
    ctx['{{DATE_EMISSION}}']   = _date.today().strftime('%d/%m/%Y')
    # Identité établissement (depuis le Super-Admin)
    ctx['{{NOM_ETABLISSEMENT}}'] = (ps.school_name if ps else '') or ''
    if ps and ps.school_year:
        ctx['{{ANNEE_SCOLAIRE}}'] = ps.school_year

    if student:
        # ── Élève ──
        ctx['{{NOM_PRENOM}}']      = student.full_name
        ctx['{{NOM}}']             = student.last_name
        ctx['{{PRENOM}}']          = student.first_name
        ctx['{{MATRICULE}}']       = student.matricule
        ctx['{{CLASSE}}']          = student.classe.name if student.classe else ''
        ctx['{{DATE_NAISSANCE}}']  = student.date_of_birth.strftime('%d/%m/%Y') if student.date_of_birth else ''
        ctx['{{LIEU_NAISSANCE}}']  = student.birth_place or ''

        # ── Établissement ──
        if student.classe:
            yr = student.classe.academic_year
            # On garde l'année du Super-Admin si définie, sinon celle de la classe
            if not ctx.get('{{ANNEE_SCOLAIRE}}'):
                ctx['{{ANNEE_SCOLAIRE}}'] = yr.name if yr else ''
            ctx['{{TRIMESTRE}}']       = '1er Trimestre'

            from apps.students.models import Student as _S
            ctx['{{EFFECTIF_CLASSE}}'] = str(_S.objects.filter(classe=student.classe, is_active=True).count())

    if rankings_data:
        general_avg = rankings_data.get('general_average', 0) or 0
        rank        = rankings_data.get('rank', '-')
        total_s     = rankings_data.get('total_students', '-')
        class_avg   = rankings_data.get('class_average', 0) or 0
        mention     = _appreciation(general_avg)

        ctx['{{MOYENNE}}']    = f'{general_avg}/20'
        ctx['{{RANG}}']       = f'{rank}/{total_s}'
        ctx['{{MENTION}}']    = mention
        ctx['{{APPRECIATION}}'] = mention
        ctx['{{MOY_CLASSE}}'] = f'{class_avg}/20'

    if subjects is not None:
        total_coeff = sum(float(s.coefficient) for s in subjects)
        ctx['{{TOTAL_COEFF}}']   = str(int(total_coeff))
        ctx['{{NB_MATIERES}}']   = str(len(list(subjects)))

    if payment:
        ctx['{{MONTANT}}']          = f'{float(payment.amount):,.0f} {payment.student.classe.name if payment.student and payment.student.classe else ""}'.strip()
        ctx['{{TYPE_PAIEMENT}}']    = payment.get_payment_type_display()
        ctx['{{NUMERO_RECU}}']      = payment.receipt_number
        ctx['{{DATE_PAIEMENT}}']    = payment.payment_date.strftime('%d/%m/%Y') if payment.payment_date else ''
        ctx['{{STATUT_PAIEMENT}}']  = payment.get_status_display()
        if payment.student:
            ctx['{{NOM_PRENOM}}']   = payment.student.full_name
            ctx['{{MATRICULE}}']    = payment.student.matricule
            ctx['{{CLASSE}}']       = payment.student.classe.name if payment.student.classe else ''
            # Solde : scolarité totale, total payé, reste à payer
            from django.db.models import Sum as _Sum
            _st = payment.student
            _tuition = float(_st.classe.tuition_fee or 0) if _st.classe else 0
            _paid = float(_st.payments.filter(status='PAID').aggregate(t=_Sum('amount'))['t'] or 0)
            ctx['{{SCOLARITE_TOTALE}}'] = f'{_tuition:,.0f}'
            ctx['{{TOTAL_PAYE}}']       = f'{_paid:,.0f}'
            ctx['{{RESTE_A_PAYER}}']    = f'{max(0.0, _tuition - _paid):,.0f}'

    return ctx


def resolve_tokens(text, context):
    """Replace all {{TOKEN}} placeholders in text with values from context."""
    if not text or not isinstance(text, str):
        return text or ''
    result = text
    for token, value in context.items():
        result = result.replace(token, str(value) if value is not None else '')
    return result


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

    # Identité établissement (Super-Admin)
    ps = _platform_settings()
    if ps and getattr(ps, 'logo', None):
        try:
            from reportlab.platypus import Image as _RLImage
            elements.append(_RLImage(ps.logo.path, width=2.4 * cm, height=2.4 * cm))
            elements.append(Spacer(1, 4))
        except Exception:
            pass
    if ps and ps.school_name:
        elements.append(Paragraph(ps.school_name, title_style))
    if ps and ps.bulletin_header:
        elements.append(Paragraph(
            ps.bulletin_header.replace('\n', '<br/>'),
            ParagraphStyle('BH2', parent=styles['Normal'], fontSize=9,
                           alignment=TA_CENTER, textColor=colors.HexColor('#4a5568'), spaceAfter=4),
        ))

    # Header
    elements.append(Paragraph("BULLETIN DE NOTES", title_style))
    year_name = ''
    if ps and ps.school_year:
        year_name = ps.school_year
    elif student.classe:
        year_name = student.classe.academic_year.name if student.classe.academic_year else ''
    if year_name:
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


# ────────────────────────────────────────────────────────────────
# Templated generators
# ────────────────────────────────────────────────────────────────

def _c(config, *keys, default='#1a365d'):
    """Safely navigate nested config dict."""
    val = config
    for k in keys:
        if not isinstance(val, dict):
            return default
        val = val.get(k, default)
    return val if val else default


def generate_bulletin_pdf_templated(student, subjects, rankings_data, template_config):
    """Generate a bulletin PDF using a saved template config."""
    from apps.grades.models import Grade

    cfg = template_config or {}

    # ── Build token context and resolve all text fields ──
    token_ctx = build_token_context(student=student, rankings_data=rankings_data, subjects=subjects)

    def rt(text):
        """Shorthand: resolve tokens in a string."""
        return resolve_tokens(text, token_ctx)

    col = cfg.get('colors', {})
    hdr = cfg.get('header', {})
    gt = cfg.get('gradesTable', {})
    sum_cfg = cfg.get('summary', {})
    app_cfg = cfg.get('appreciations', {})
    sig_cfg = cfg.get('signatures', {})
    sec_cfg = cfg.get('security', {})
    foot_cfg = cfg.get('footer', {})

    primary = col.get('primary', '#1a365d')
    header_bg = col.get('headerBg', primary)
    header_text_color = col.get('headerText', '#ffffff')
    table_header_bg = col.get('tableHeader', primary)
    row_alt = col.get('tableRowAlt', '#f7fafc')
    border_color = col.get('border', '#e2e8f0')
    accent = col.get('accent', '#ebf8ff')

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=1.5 * cm, leftMargin=1.5 * cm,
        topMargin=1.5 * cm, bottomMargin=1.8 * cm,
    )

    styles = getSampleStyleSheet()
    school_name = rt(hdr.get('schoolName', '')) or rt('{{NOM_ETABLISSEMENT}}') or 'ÉTABLISSEMENT'
    doc_title   = rt(hdr.get('subtitle', 'BULLETIN DE NOTES')) or 'BULLETIN DE NOTES'

    title_style = ParagraphStyle(
        'T', parent=styles['Title'],
        fontSize=14, textColor=colors.HexColor(header_text_color),
        alignment=TA_CENTER, spaceAfter=2,
    )
    sub_style = ParagraphStyle(
        'S', parent=styles['Normal'],
        fontSize=9, textColor=colors.HexColor(header_text_color),
        alignment=TA_CENTER, spaceAfter=0,
    )

    elements = []

    # ── Logo + en-tête personnalisé (Super-Admin) ──
    ps = _platform_settings()
    if ps and getattr(ps, 'logo', None):
        try:
            from reportlab.platypus import Image as _RLImage
            elements.append(_RLImage(ps.logo.path, width=2.6 * cm, height=2.6 * cm))
            elements.append(Spacer(1, 4))
        except Exception:
            pass
    if ps and ps.bulletin_header:
        elements.append(Paragraph(
            ps.bulletin_header.replace('\n', '<br/>'),
            ParagraphStyle('BH', parent=styles['Normal'], fontSize=9,
                           alignment=TA_CENTER, textColor=colors.HexColor('#344054'), spaceAfter=6),
        ))

    # ── Header band ──
    school_name_para = Paragraph(school_name, title_style)
    year_name = ''
    if student.classe and student.classe.academic_year:
        year_name = student.classe.academic_year.name
    sub_parts = []
    if hdr.get('showAcademicYear', True) and year_name:
        sub_parts.append(f"Année scolaire {year_name}")
    if hdr.get('showTrimester', True):
        sub_parts.append(rt(hdr.get('trimesterText', '{{TRIMESTRE}}')) or '1er Trimestre')
    sub_text = '  ·  '.join(sub_parts) if sub_parts else ''
    header_table_data = [
        [school_name_para],
        [Paragraph(doc_title, ParagraphStyle(
            'DT', parent=styles['Normal'],
            fontSize=13, textColor=colors.HexColor(header_text_color),
            alignment=TA_CENTER, fontName='Helvetica-Bold', spaceAfter=2,
        ))],
    ]
    if sub_text:
        header_table_data.append([Paragraph(sub_text, sub_style)])

    header_tbl = Table(header_table_data, colWidths=['100%'])
    header_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor(header_bg)),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ]))
    elements.append(header_tbl)
    elements.append(Spacer(1, 8))

    # ── Student Info ──
    if cfg.get('studentInfo', {}).get('show', True):
        si = cfg.get('studentInfo', {})
        rank = rankings_data.get('rank', '-')
        total_s = rankings_data.get('total_students', '-')
        rows = [
            ['Nom & Prénom :', student.full_name,
             'Matricule :' if si.get('showMatricule', True) else '', student.matricule if si.get('showMatricule', True) else ''],
            ['Classe :', student.classe.name if student.classe else '-',
             'Rang :', f"{rank}/{total_s}"],
        ]
        if si.get('showDateOfBirth', True) and student.date_of_birth:
            rows.append(['Date de naissance :', str(student.date_of_birth), 'Lieu :', student.birth_place or '-'])

        info_tbl = Table(rows, colWidths=[3.5 * cm, 6.5 * cm, 3 * cm, 4.5 * cm])
        info_tbl.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#4a5568')),
            ('TEXTCOLOR', (2, 0), (2, -1), colors.HexColor('#4a5568')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
        ]))
        elements.append(info_tbl)
        elements.append(Spacer(1, 8))
        elements.append(HRFlowable(width='100%', thickness=1, color=colors.HexColor(border_color)))
        elements.append(Spacer(1, 8))

    # ── Grades Table ──
    if gt.get('show', True):
        DEFAULT_COL_ORDER = ['matiere', 'coeff', 'moy', 'moyPond', 'appreciation', 'teacher', 'signature']
        col_order = gt.get('columnsOrder', DEFAULT_COL_ORDER)

        # Visibility map
        col_visible = {
            'matiere':      True,
            'coeff':        gt.get('showCoefficient', True),
            'moy':          True,
            'moyPond':      gt.get('showWeightedAverage', True),
            'appreciation': gt.get('showAppreciation', True),
            'teacher':      gt.get('showTeacherName', False),
            'signature':    gt.get('showSignatureCol', False),
        }
        col_header = {
            'matiere':      'Matière',
            'coeff':        'Coeff.',
            'moy':          'Moyenne',
            'moyPond':      'Moy. Pond.',
            'appreciation': 'Appréciation',
            'teacher':      'Professeur',
            'signature':    'Signature',
        }
        col_width_map = {
            'matiere':      6.0 * cm,
            'coeff':        1.8 * cm,
            'moy':          2.5 * cm,
            'moyPond':      2.5 * cm,
            'appreciation': 4.0 * cm,
            'teacher':      3.5 * cm,
            'signature':    3.0 * cm,
        }

        visible_cols = [k for k in col_order if col_visible.get(k, False)]
        headers    = [col_header[k] for k in visible_cols]
        col_widths = [col_width_map[k] for k in visible_cols]

        table_data = [headers]
        total_weighted = 0
        total_coeff = 0

        for subject in subjects:
            grades = Grade.objects.filter(student=student, subject=subject)
            avg = round(float(grades.aggregate(a=Avg('value'))['a']), 2) if grades.exists() else 0
            coeff = float(subject.coefficient)
            total_weighted += avg * coeff
            total_coeff += coeff
            appreciation = (
                'Très Bien' if avg >= 16 else 'Bien' if avg >= 14 else
                'Assez Bien' if avg >= 12 else 'Passable' if avg >= 10 else 'Insuffisant'
            )
            teacher_name = ''
            if subject.teacher and subject.teacher.user:
                teacher_name = subject.teacher.user.get_full_name() or subject.teacher.user.username

            col_value = {
                'matiere':      subject.name,
                'coeff':        str(subject.coefficient),
                'moy':          f'{avg}/20',
                'moyPond':      f'{round(avg * coeff, 2)}',
                'appreciation': appreciation,
                'teacher':      teacher_name,
                'signature':    '',
            }
            table_data.append([col_value[k] for k in visible_cols])

        general_avg = round(total_weighted / total_coeff, 2) if total_coeff > 0 else 0

        grades_tbl = Table(table_data, colWidths=col_widths)
        grade_style = [
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(table_header_bg)),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('ALIGN', (1, 1), (-1, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor(border_color)),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]
        if gt.get('stripeRows', True):
            for i in range(1, len(table_data)):
                if i % 2 == 0:
                    grade_style.append(('BACKGROUND', (0, i), (-1, i), colors.HexColor(row_alt)))
        grades_tbl.setStyle(TableStyle(grade_style))
        elements.append(grades_tbl)
        elements.append(Spacer(1, 10))

    # ── Summary ──
    if sum_cfg.get('show', True):
        class_avg = rankings_data.get('class_average', 0)
        rank = rankings_data.get('rank', '-')
        total_s = rankings_data.get('total_students', '-')
        gen_appr = (
            'Très Bien' if general_avg >= 16 else 'Bien' if general_avg >= 14 else
            'Assez Bien' if general_avg >= 12 else 'Passable' if general_avg >= 10 else 'Insuffisant'
        )
        sum_rows = []
        if sum_cfg.get('showGeneralAverage', True):
            sum_rows.append(['Moyenne générale', f'{general_avg}/20'])
        if sum_cfg.get('showClassAverage', True):
            sum_rows.append(['Moyenne de la classe', f'{class_avg}/20'])
        if sum_cfg.get('showRank', True):
            sum_rows.append(['Rang', f'{rank}/{total_s}'])
        if sum_cfg.get('showMention', True):
            sum_rows.append(['Mention', gen_appr])

        if sum_rows:
            sum_tbl = Table(sum_rows, colWidths=[7 * cm, 5 * cm])
            sum_tbl.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor(accent)),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor(border_color)),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('LEFTPADDING', (0, 0), (-1, -1), 10),
                ('TEXTCOLOR', (1, -1), (1, -1), colors.HexColor(primary)),
            ]))
            elements.append(sum_tbl)
            elements.append(Spacer(1, 10))

    # ── Appreciations ──
    if app_cfg.get('show', True):
        appr_data = [[
            rt(app_cfg.get('mainTeacherLabel', 'Prof. Principal')) + ' :',
            rt(app_cfg.get('adminLabel', 'Administration')) + ' :',
        ], [rt(app_cfg.get('defaultText', '')), '']]
        appr_tbl = Table(appr_data, colWidths=[9 * cm, 9 * cm])
        appr_tbl.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor(border_color)),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor(border_color)),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 24),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(appr_tbl)
        elements.append(Spacer(1, 10))

    # ── Signatures ──
    if sig_cfg.get('show', True):
        sig_items = []
        if sig_cfg.get('showDirector', True):
            sig_items.append(rt(sig_cfg.get('directorLabel', 'Le Directeur')))
        if sig_cfg.get('showSupervisor', True):
            sig_items.append(rt(sig_cfg.get('supervisorLabel', "L'Encadreur")))
        if sig_items:
            sig_row = [[Paragraph(lbl, ParagraphStyle(
                'SigL', parent=styles['Normal'],
                fontSize=9, fontName='Helvetica-Bold', alignment=TA_CENTER,
            ))] for lbl in sig_items]
            # Put all sigs in one row
            sig_row_data = [sig_items]
            sig_row_data.append(['_' * 20] * len(sig_items))
            sig_tbl = Table(sig_row_data, colWidths=[18 * cm / len(sig_items)] * len(sig_items))
            sig_tbl.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('TOPPADDING', (0, 0), (-1, -1), 20),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('LINEABOVE', (0, 1), (-1, 1), 0.5, colors.HexColor(border_color)),
            ]))
            elements.append(sig_tbl)
            elements.append(Spacer(1, 8))

    # ── Footer / Security ──
    footer_parts = []
    if sec_cfg.get('showUniqueId', True):
        uid = token_ctx.get('{{NUMERO_DOC}}', str(_uuid.uuid4())[:8].upper())
        footer_parts.append(f'ID: {uid}')
    if foot_cfg.get('show', True) and foot_cfg.get('text'):
        footer_parts.append(rt(foot_cfg['text']))
    if footer_parts:
        elements.append(HRFlowable(width='100%', thickness=0.5, color=colors.HexColor(border_color)))
        elements.append(Spacer(1, 4))
        elements.append(Paragraph(
            '   |   '.join(footer_parts),
            ParagraphStyle('Foot', parent=styles['Normal'],
                           fontSize=7, textColor=colors.HexColor('#667085'), alignment=TA_CENTER),
        ))

    doc.build(elements)
    buffer.seek(0)
    return buffer


def generate_class_list_pdf(classe, subjects, rows, order='merit'):
    """Génère le relevé d'une classe en PDF (A4 paysage).

    `subjects` : liste de dicts {'name', 'coefficient'}.
    `rows`     : liste de dicts {'name', 'averages': [par matière|None], 'total', 'average'} déjà triés.
    `order`    : 'merit' (avec rang) ou 'alpha'.
    """
    from reportlab.lib.pagesizes import landscape

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=landscape(A4),
        rightMargin=1.2 * cm, leftMargin=1.2 * cm,
        topMargin=1.2 * cm, bottomMargin=1.2 * cm,
    )
    styles = getSampleStyleSheet()
    elements = []
    ps = _platform_settings()

    # ── En-tête établissement ──
    school_name = (ps.school_name if ps else '') or ''
    if school_name:
        elements.append(Paragraph(school_name, ParagraphStyle(
            'CLS', parent=styles['Title'], fontSize=14,
            textColor=colors.HexColor('#1a365d'), alignment=TA_CENTER, spaceAfter=2)))

    year_name = (ps.school_year if ps and ps.school_year else
                 (classe.academic_year.name if classe.academic_year else ''))
    elements.append(Paragraph(f"RELEVÉ DE NOTES — CLASSE {classe.name}", ParagraphStyle(
        'CLT', parent=styles['Normal'], fontSize=13, fontName='Helvetica-Bold',
        alignment=TA_CENTER, spaceAfter=2, textColor=colors.HexColor('#2d3748'))))
    sub = ("Par ordre de mérite" if order == 'merit' else "Par ordre alphabétique")
    if year_name:
        sub += f"  ·  Année scolaire {year_name}"
    sub += f"  ·  {len(rows)} élève(s)"
    elements.append(Paragraph(sub, ParagraphStyle(
        'CLSub', parent=styles['Normal'], fontSize=9, alignment=TA_CENTER,
        textColor=colors.HexColor('#667085'), spaceAfter=10)))

    # ── En-têtes de colonnes ──
    head_cell = ParagraphStyle('HC', parent=styles['Normal'], fontSize=7,
                               textColor=colors.white, alignment=TA_CENTER, leading=8)
    first_label = 'Rang' if order == 'merit' else 'N°'
    header = [first_label, 'Nom & Prénom']
    for subj in subjects:
        coeff = subj.get('coefficient')
        coeff_str = f"\n(coef {int(coeff) if float(coeff).is_integer() else coeff})" if coeff else ''
        header.append(Paragraph((subj['name'] + coeff_str).replace('\n', '<br/>'), head_cell))
    header.append('Total')
    header.append('Moy.')

    # ── Largeurs de colonnes (paysage ≈ 27 cm utiles) ──
    n = max(1, len(subjects))
    fixed = 1.2 + 5.0 + 2.0 + 2.0  # rang + nom + total + moy (cm)
    subj_w = max(1.4, (27.0 - fixed) / n)
    col_widths = ([1.2 * cm, 5.0 * cm] + [subj_w * cm] * n + [2.0 * cm, 2.0 * cm])

    data = [header]
    for i, r in enumerate(rows, start=1):
        line = [str(i), r['name']]
        for a in r.get('averages', []):
            line.append(f"{a}" if a is not None else '—')
        line.append(f"{r.get('total', 0)}")
        avg = r.get('average')
        line.append(f"{avg}" if avg is not None else '—')
        data.append(line)

    tbl = Table(data, colWidths=col_widths, repeatRows=1)
    style = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2b6cb0')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 7),
        ('FONTSIZE', (0, 1), (-1, -1), 7.5),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('ALIGN', (2, 0), (-1, -1), 'CENTER'),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#cbd5e0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f7fafc')]),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        # Colonnes Total + Moyenne mises en avant
        ('FONTNAME', (-2, 1), (-1, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (-1, 1), (-1, -1), colors.HexColor('#2b6cb0')),
    ]
    tbl.setStyle(TableStyle(style))
    elements.append(tbl)

    doc.build(elements)
    buffer.seek(0)
    return buffer


def generate_subject_sheet_pdf(classe, subject, rows, order='merit'):
    """Feuille de notes imprimable pour le professeur : Rang, Nom & Prénom, Notes
    saisies (détail), Total, Moyenne — pour une matière et une classe données.

    `rows`  : liste de dicts {'name', 'grades', 'average', 'total_value', 'total_max', 'rank'} déjà triés.
    `order` : 'merit' ou 'alpha'.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=1.5 * cm, leftMargin=1.5 * cm,
        topMargin=1.5 * cm, bottomMargin=1.5 * cm,
    )
    styles = getSampleStyleSheet()
    elements = []
    ps = _platform_settings()

    school_name = (ps.school_name if ps else '') or ''
    if school_name:
        elements.append(Paragraph(school_name, ParagraphStyle(
            'SS', parent=styles['Title'], fontSize=14,
            textColor=colors.HexColor('#1a365d'), alignment=TA_CENTER, spaceAfter=2)))

    year_name = (ps.school_year if ps and ps.school_year else
                 (classe.academic_year.name if classe and classe.academic_year else ''))
    elements.append(Paragraph(
        f"FEUILLE DE NOTES — {subject.name} — Classe {classe.name if classe else ''}",
        ParagraphStyle('SST', parent=styles['Normal'], fontSize=12, fontName='Helvetica-Bold',
                       alignment=TA_CENTER, spaceAfter=2, textColor=colors.HexColor('#2d3748'))))
    sub = ("Par ordre de mérite" if order == 'merit' else "Par ordre alphabétique") + f"  ·  {len(rows)} élève(s)"
    if year_name:
        sub = f"Année scolaire {year_name}  ·  " + sub
    elements.append(Paragraph(sub, ParagraphStyle(
        'SSs', parent=styles['Normal'], fontSize=9, alignment=TA_CENTER,
        textColor=colors.HexColor('#667085'), spaceAfter=12)))

    cell = ParagraphStyle('SSC', parent=styles['Normal'], fontSize=8.5, leading=11)
    header = ['Rang', 'Nom & Prénom', 'Notes saisies', 'Total', 'Moyenne']
    data = [header]
    for r in rows:
        notes = r.get('grades', [])
        if notes:
            notes_str = ', '.join(
                f"{g['value']:g}/{g['max']:g}" + (f" ({g['type']})" if g.get('type') else '')
                for g in notes
            )
        else:
            notes_str = '—'
        tv, tm = r.get('total_value'), r.get('total_max')
        total_str = f"{tv:g}/{tm:g}" if tv is not None else '—'
        avg = r.get('average')
        avg_str = f"{avg}/20" if avg is not None else '—'
        rank = r.get('rank')
        rank_str = str(rank) if rank is not None else '—'
        data.append([rank_str, Paragraph(r['name'], cell), Paragraph(notes_str, cell), total_str, avg_str])

    tbl = Table(data, colWidths=[1.2 * cm, 6.0 * cm, 6.3 * cm, 2.3 * cm, 2.2 * cm], repeatRows=1)
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2b6cb0')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('ALIGN', (3, 0), (-1, -1), 'CENTER'),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f7fafc')]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('FONTNAME', (3, 1), (-1, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (-1, 1), (-1, -1), colors.HexColor('#2b6cb0')),
    ]))
    elements.append(tbl)

    doc.build(elements)
    buffer.seek(0)
    return buffer


def generate_receipt_pdf_templated(payment, template_config):
    """Generate a payment receipt PDF using a template config."""
    cfg = template_config or {}

    # ── Token context ──
    token_ctx = build_token_context(payment=payment)
    def rt(text): return resolve_tokens(text, token_ctx)

    col = cfg.get('colors', {})
    hdr = cfg.get('header', {})
    body_cfg = cfg.get('body', {})
    sig_cfg = cfg.get('signatures', {})
    foot_cfg = cfg.get('footer', {})
    sec_cfg = cfg.get('security', {})

    primary = col.get('primary', '#1a365d')
    header_bg = col.get('headerBg', primary)
    header_text = col.get('headerText', '#ffffff')
    border_color = col.get('border', '#e2e8f0')
    accent = col.get('accent', '#ebf8ff')
    currency = body_cfg.get('currency', 'FCFA')

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=2 * cm, leftMargin=2 * cm,
        topMargin=1.5 * cm, bottomMargin=1.5 * cm,
    )
    styles = getSampleStyleSheet()
    elements = []

    school_name = rt(hdr.get('schoolName', '')) or 'ÉTABLISSEMENT'
    doc_title   = rt(hdr.get('subtitle', 'REÇU DE PAIEMENT')) or 'REÇU DE PAIEMENT'

    # ── Header ──
    header_data = [
        [Paragraph(school_name, ParagraphStyle(
            'RH', parent=styles['Normal'],
            fontSize=14, textColor=colors.HexColor(header_text),
            fontName='Helvetica-Bold', alignment=TA_CENTER,
        ))],
        [Paragraph(doc_title, ParagraphStyle(
            'RHs', parent=styles['Normal'],
            fontSize=11, textColor=colors.HexColor(header_text),
            alignment=TA_CENTER,
        ))],
    ]
    hdr_tbl = Table(header_data, colWidths=['100%'])
    hdr_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor(header_bg)),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(hdr_tbl)
    elements.append(Spacer(1, 16))

    # ── Receipt number ──
    if sec_cfg.get('showReceiptNumber', True):
        elements.append(Paragraph(
            f'N° Reçu : <b>{payment.receipt_number}</b>   |   Date : <b>{payment.payment_date}</b>',
            ParagraphStyle('RN', parent=styles['Normal'], fontSize=10, alignment=TA_RIGHT),
        ))
        elements.append(Spacer(1, 12))

    # ── Student info ──
    if body_cfg.get('showStudentInfo', True):
        student = payment.student
        info_rows = [
            ['Élève :', student.full_name if student else '-'],
            ['Matricule :', student.matricule if student else '-'],
            ['Classe :', student.classe.name if student and student.classe else '-'],
        ]
        info_tbl = Table(info_rows, colWidths=[4 * cm, 13 * cm])
        info_tbl.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor(accent)),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor(border_color)),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ]))
        elements.append(info_tbl)
        elements.append(Spacer(1, 12))

    # ── Payment details ──
    if body_cfg.get('showPaymentDetails', True):
        detail_rows = [
            ['Type de paiement :', payment.get_payment_type_display()],
            ['Montant payé :', f'{float(payment.amount):,.0f} {currency}'],
            ['Statut :', payment.get_status_display()],
        ]
        if payment.due_date:
            detail_rows.append(['Échéance :', str(payment.due_date)])
        detail_tbl = Table(detail_rows, colWidths=[4 * cm, 13 * cm])
        detail_tbl.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor(border_color)),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ]))
        elements.append(detail_tbl)
        elements.append(Spacer(1, 20))

    # ── Solde : scolarité totale, payé, reste à payer ──
    if body_cfg.get('showBalance', True) and payment.student and payment.student.classe:
        from django.db.models import Sum as _Sum
        student = payment.student
        tuition = float(student.classe.tuition_fee or 0)
        total_paid = float(student.payments.filter(status='PAID').aggregate(t=_Sum('amount'))['t'] or 0)
        reste = max(0.0, tuition - total_paid)
        bal_rows = [
            ['Scolarité totale :', f'{tuition:,.0f} {currency}'],
            ['Total payé :', f'{total_paid:,.0f} {currency}'],
            ['Reste à payer :', f'{reste:,.0f} {currency}'],
        ]
        bal_tbl = Table(bal_rows, colWidths=[5 * cm, 12 * cm])
        bal_tbl.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor(border_color)),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor(accent)),
            # Reste à payer en évidence
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('TEXTCOLOR', (1, -1), (1, -1), colors.HexColor('#c53030')),
        ]))
        elements.append(bal_tbl)
        elements.append(Spacer(1, 20))

    # ── Amount box ──
    amount_style = ParagraphStyle(
        'Amt', parent=styles['Normal'],
        fontSize=20, fontName='Helvetica-Bold',
        textColor=colors.HexColor(primary), alignment=TA_CENTER,
    )
    elements.append(Table(
        [[Paragraph(f'{float(payment.amount):,.0f} {currency}', amount_style)]],
        colWidths=['100%'],
    ))
    elements.append(Spacer(1, 20))

    # ── Custom text block ──
    custom_text = rt(body_cfg.get('customText', ''))
    if custom_text:
        elements.append(Spacer(1, 8))
        elements.append(Paragraph(
            custom_text,
            ParagraphStyle('CT', parent=styles['Normal'], fontSize=9, alignment=TA_CENTER),
        ))

    # ── Signatures ──
    if sig_cfg.get('show', True):
        sigs = [
            rt(sig_cfg.get('cashierLabel', 'Le Caissier')),
            rt(sig_cfg.get('directorLabel', 'Le Directeur')),
        ]
        sig_tbl = Table([[s for s in sigs], ['_' * 20] * len(sigs)], colWidths=[9 * cm] * 2)
        sig_tbl.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('TOPPADDING', (0, 0), (-1, -1), 20),
            ('BOTTOMPADDING', (0, 1), (-1, 1), 4),
            ('LINEABOVE', (0, 1), (-1, 1), 0.5, colors.HexColor(border_color)),
        ]))
        elements.append(sig_tbl)

    # ── Footer ──
    if foot_cfg.get('show', True) and foot_cfg.get('text'):
        elements.append(Spacer(1, 16))
        elements.append(HRFlowable(width='100%', thickness=0.5, color=colors.HexColor(border_color)))
        elements.append(Paragraph(
            rt(foot_cfg['text']),
            ParagraphStyle('RF', parent=styles['Normal'],
                           fontSize=8, textColor=colors.HexColor('#667085'), alignment=TA_CENTER),
        ))

    doc.build(elements)
    buffer.seek(0)
    return buffer


def generate_card_pdf_templated(student, template_config):
    """Generate a student ID card PDF (A4 sheet with 4 cards)."""
    from reportlab.lib.pagesizes import A4
    from reportlab.platypus import Image as RLImage
    import os

    cfg = template_config or {}

    # ── Token context ──
    token_ctx = build_token_context(student=student)
    def rt(text): return resolve_tokens(text, token_ctx)

    col = cfg.get('colors', {})
    hdr = cfg.get('header', {})
    body_cfg = cfg.get('body', {})
    sec_cfg = cfg.get('security', {})
    foot_cfg = cfg.get('footer', {})

    primary = col.get('primary', '#1a365d')
    header_bg = col.get('headerBg', primary)
    header_text = col.get('headerText', '#ffffff')
    card_bg = col.get('cardBg', '#ffffff')
    border_color = col.get('border', primary)

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=1 * cm, leftMargin=1 * cm,
        topMargin=1 * cm, bottomMargin=1 * cm,
    )
    styles = getSampleStyleSheet()
    elements = []

    school_name = rt(hdr.get('schoolName', '')) or rt('{{NOM_ETABLISSEMENT}}') or 'ÉTABLISSEMENT'
    card_title  = rt(hdr.get('subtitle', 'CARTE SCOLAIRE')) or 'CARTE SCOLAIRE'
    year_name   = token_ctx.get('{{ANNEE_SCOLAIRE}}', '')
    if not year_name and student.classe and student.classe.academic_year:
        year_name = student.classe.academic_year.name

    # Build a single card as a Table (85.6mm × 54mm ≈ card size, scaled for A4)
    card_w = 9 * cm
    card_h = 5.5 * cm

    # Card header
    card_header = Table(
        [[Paragraph(school_name, ParagraphStyle(
            'CH', parent=styles['Normal'],
            fontSize=8, textColor=colors.HexColor(header_text),
            fontName='Helvetica-Bold', alignment=TA_CENTER,
        )),
          Paragraph(card_title, ParagraphStyle(
              'CTs', parent=styles['Normal'],
              fontSize=7, textColor=colors.HexColor(header_text),
              alignment=TA_CENTER,
          ))]],
        colWidths=[card_w / 2, card_w / 2],
    )
    card_header.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor(header_bg)),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('SPAN', (0, 0), (-1, -1)),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ]))

    # Card body — token-resolved
    info_lines = []
    if body_cfg.get('showName', True):
        info_lines.append(f"<b>{token_ctx.get('{{NOM_PRENOM}}', student.full_name)}</b>")
    if body_cfg.get('showMatricule', True):
        info_lines.append(f"Matr.: {token_ctx.get('{{MATRICULE}}', student.matricule)}")
    if body_cfg.get('showClasse', True):
        info_lines.append(f"Classe: {token_ctx.get('{{CLASSE}}', student.classe.name if student.classe else '-')}")
    if body_cfg.get('showYear', True) and year_name:
        info_lines.append(f"Année: {year_name}")
    if body_cfg.get('showDateOfBirth', False) and token_ctx.get('{{DATE_NAISSANCE}}'):
        info_lines.append(f"Né(e): {token_ctx['{{DATE_NAISSANCE}}']}")
    if sec_cfg.get('showUniqueId', True):
        info_lines.append(f"ID: {token_ctx.get('{{NUMERO_DOC}}', '')}")
    info_text = '<br/>'.join(info_lines)

    body_para = Paragraph(info_text, ParagraphStyle(
        'CB', parent=styles['Normal'],
        fontSize=7.5, leading=11,
    ))

    # Photo placeholder
    photo_cell = ''
    if body_cfg.get('showPhoto', True) and student.photo:
        try:
            from django.conf import settings as django_settings
            photo_path = student.photo.path
            photo_cell = RLImage(photo_path, width=1.5 * cm, height=2 * cm)
        except Exception:
            photo_cell = Paragraph('[ Photo ]', ParagraphStyle(
                'Ph', parent=styles['Normal'], fontSize=7, alignment=TA_CENTER,
            ))
    else:
        photo_cell = Paragraph('[ Photo ]', ParagraphStyle(
            'Ph', parent=styles['Normal'], fontSize=7, alignment=TA_CENTER,
        ))

    card_body = Table(
        [[photo_cell, body_para]],
        colWidths=[1.8 * cm, card_w - 1.8 * cm],
    )
    card_body.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))

    # Footer strip
    footer_text = rt(foot_cfg.get('text', 'Document officiel')) if foot_cfg.get('show', True) else ''
    card_footer = Table(
        [[Paragraph(footer_text, ParagraphStyle(
            'CF', parent=styles['Normal'],
            fontSize=6, textColor=colors.HexColor('#667085'), alignment=TA_CENTER,
        ))]],
        colWidths=[card_w],
    )
    card_footer.setStyle(TableStyle([
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LINEABOVE', (0, 0), (-1, 0), 0.5, colors.HexColor(border_color)),
    ]))

    # Assemble full card
    full_card = Table(
        [[card_header], [card_body], [card_footer]],
        colWidths=[card_w],
    )
    full_card.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor(border_color)),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor(card_bg)),
    ]))

    # Place 4 cards per page (2 columns × 2 rows)
    page_tbl = Table(
        [[full_card, full_card], [full_card, full_card]],
        colWidths=[card_w + 0.5 * cm, card_w + 0.5 * cm],
        rowHeights=[card_h + 0.5 * cm, card_h + 0.5 * cm],
    )
    page_tbl.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(page_tbl)

    doc.build(elements)
    buffer.seek(0)
    return buffer
