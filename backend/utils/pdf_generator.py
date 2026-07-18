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
from django.db.models import Avg, FloatField
from django.db.models.functions import Cast


def _subject_normalized_avg(grades_qs):
    """Moyenne d'une matière normalisée sur 20 (``value * 20 / max_value``).

    Utilise ``normalized_value`` au niveau base plutôt qu'``Avg('value')`` brut,
    afin qu'une note /10 ou /100 soit correctement ramenée sur /20 avant moyenne.
    Retourne 0 si aucune note.
    """
    res = grades_qs.aggregate(
        a=Avg(Cast('value', FloatField()) * 20.0 / Cast('max_value', FloatField()))
    )['a']
    return round(float(res), 2) if res is not None else 0


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


def _platform_settings(ecole=None):
    """Réglages d'identité de l'établissement (singleton) pour l'école donnée."""
    try:
        from apps.reports.models import PlatformSettings
        return PlatformSettings.get_solo(ecole=ecole)
    except Exception:
        return None


def build_token_context(student=None, rankings_data=None, payment=None, subjects=None, platform_settings=None, period_label=None):
    """Build a complete token → value map for a given document context."""
    ctx = {}
    if platform_settings is not None:
        ps = platform_settings
    else:
        ecole = None
        if student is not None and getattr(student, 'ecole', None) is not None:
            ecole = student.ecole
        elif payment is not None and getattr(payment, 'student', None) is not None and getattr(payment.student, 'ecole', None) is not None:
            ecole = payment.student.ecole
        ps = _platform_settings(ecole=ecole)

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
            ctx['{{TRIMESTRE}}']       = period_label or '1er Trimestre'
            ctx['{{PERIODE}}']         = period_label or '1er Trimestre'

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
            # Solde : scolarité totale, remise, net dû, total payé, reste à payer
            from django.db.models import Sum as _Sum
            _st = payment.student
            _tuition = _st.tuition_fee
            _remise = _st.discount_amount(_tuition)
            _net = _st.net_tuition
            _paid = float(_st.payments.filter(status__in=['PAID', 'PARTIAL']).aggregate(t=_Sum('amount'))['t'] or 0)
            ctx['{{SCOLARITE_TOTALE}}'] = f'{_tuition:,.0f}'
            ctx['{{REMISE}}']           = f'{_remise:,.0f}'
            ctx['{{NET_A_PAYER}}']      = f'{_net:,.0f}'
            ctx['{{TOTAL_PAYE}}']       = f'{_paid:,.0f}'
            ctx['{{RESTE_A_PAYER}}']    = f'{max(0.0, _net - _paid):,.0f}'

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
        avg = _subject_normalized_avg(grades) if grades.exists() else 0

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


def generate_bulletin_pdf_templated(student, subjects, rankings_data, template_config, extra=None):
    """Generate a bulletin PDF using a saved template config.

    `extra` (optionnel) porte les données périodiques/annuelles :
        period      : entier 1..N ou None (annuel) — filtre les notes
        period_label: libellé de période affiché
        attendance  : dict d'assiduité (absences horaires)
        distinction : distinction du conseil de classe
        decision    : dict décision de fin d'année (annuel uniquement)
        is_annual   : bool
    """
    from apps.grades.models import Grade

    cfg = template_config or {}
    extra = extra or {}
    period = extra.get('period')  # None => annuel (toutes les notes)
    period_label = extra.get('period_label')

    def _grades_for(subj):
        qs = Grade.objects.filter(student=student, subject=subj)
        if period:
            qs = qs.filter(period=period)
        return qs

    # ── Build token context and resolve all text fields ──
    platform_settings = _platform_settings(ecole=getattr(student, 'ecole', None))
    token_ctx = build_token_context(
        student=student,
        rankings_data=rankings_data,
        subjects=subjects,
        platform_settings=platform_settings,
        period_label=period_label,
    )

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
            grades = _grades_for(subject)
            avg = _subject_normalized_avg(grades) if grades.exists() else 0
            coeff = float(subject.coefficient)
            total_weighted += avg * coeff
            total_coeff += coeff
            appreciation = (
                'Très Bien' if avg >= 16 else 'Bien' if avg >= 14 else
                'Assez Bien' if avg >= 12 else 'Passable' if avg >= 10 else
                'Insuffisant' if avg >= 8 else 'Très insuffisant'
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
        from apps.reports.academics import appreciation as _appr, distinction as _distinction
        gen_appr = _appr(general_avg)
        distinction_txt = extra.get('distinction')
        if distinction_txt is None:
            distinction_txt = _distinction(general_avg, platform_settings)
        sum_rows = []
        if sum_cfg.get('showGeneralAverage', True):
            sum_rows.append(['Moyenne générale', f'{general_avg}/20'])
        if sum_cfg.get('showClassAverage', True):
            sum_rows.append(['Moyenne de la classe', f'{class_avg}/20'])
        if sum_cfg.get('showRank', True):
            sum_rows.append(['Rang', f'{rank}/{total_s}'])
        if sum_cfg.get('showMention', True):
            sum_rows.append(['Mention', gen_appr])
        if distinction_txt:
            sum_rows.append(['Distinction (conseil de classe)', distinction_txt])

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

    # ── Assiduité : absences horaires ──
    att = extra.get('attendance')
    if att:
        att_rows = [
            ['Assiduité', period_label or 'Année scolaire'],
            ['Absences (heures)', f"{att.get('absent_hours', 0):g} h"],
            ['dont journées entières', f"{att.get('absent_days', 0)} j"],
            ['Retards', f"{att.get('late_count', 0)}"
             + (f" ({att.get('late_hours', 0):g} h)" if att.get('late_hours') else '')],
            ['Total heures manquées', f"{att.get('total_hours', 0):g} h"],
        ]
        att_tbl = Table(att_rows, colWidths=[7 * cm, 5 * cm])
        att_tbl.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(table_header_bg)),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f7fafc')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor(border_color)),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ]))
        elements.append(att_tbl)
        elements.append(Spacer(1, 10))

    # ── Décision de fin d'année (bulletin annuel uniquement) ──
    decision = extra.get('decision')
    if extra.get('is_annual') and decision:
        kind = decision.get('kind', 'limite')
        bg = {'admis': '#e6f4ea', 'limite': '#fef7e0', 'redouble': '#fde8e8'}.get(kind, '#f7fafc')
        fg = {'admis': '#137333', 'limite': '#b06000', 'redouble': '#c53030'}.get(kind, primary)
        dec_tbl = Table(
            [[Paragraph('DÉCISION DE FIN D\'ANNÉE', ParagraphStyle(
                'DecL', parent=styles['Normal'], fontSize=9, fontName='Helvetica-Bold',
                textColor=colors.HexColor('#475467'))),
              Paragraph(decision.get('label', ''), ParagraphStyle(
                'DecV', parent=styles['Normal'], fontSize=11, fontName='Helvetica-Bold',
                textColor=colors.HexColor(fg), alignment=TA_RIGHT))]],
            colWidths=[6 * cm, 12 * cm],
        )
        dec_tbl.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor(bg)),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor(fg)),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('LEFTPADDING', (0, 0), (-1, -1), 12),
            ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ]))
        elements.append(dec_tbl)
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
    platform_settings = _platform_settings(ecole=getattr(getattr(payment, 'student', None), 'ecole', None))
    token_ctx = build_token_context(payment=payment, platform_settings=platform_settings)
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

    # ── Format de page ──
    # Reçu au format A5 paysage par défaut (demi-feuille A4, pratique pour la
    # caisse). Le modèle peut forcer A4 portrait via body.pageSize = 'A4'.
    from reportlab.lib.pagesizes import landscape, A5
    page_size = (body_cfg.get('pageSize') or 'A5L').upper()
    if page_size in ('A4', 'A4P'):
        pagesize = A4
        content_w = 17.0 * cm
        m = 2.0 * cm
    else:
        pagesize = landscape(A5)
        content_w = 18.8 * cm
        m = 1.1 * cm

    half_w = content_w / 2

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=pagesize,
        rightMargin=m, leftMargin=m,
        topMargin=0.9 * cm, bottomMargin=0.8 * cm,
    )
    styles = getSampleStyleSheet()
    elements = []

    school_name = rt(hdr.get('schoolName', '')) or 'ÉTABLISSEMENT'
    doc_title   = rt(hdr.get('subtitle', 'REÇU DE PAIEMENT')) or 'REÇU DE PAIEMENT'

    # ── Header (compact) ──
    header_data = [
        [Paragraph(school_name, ParagraphStyle(
            'RH', parent=styles['Normal'],
            fontSize=12, textColor=colors.HexColor(header_text),
            fontName='Helvetica-Bold', alignment=TA_CENTER,
        ))],
        [Paragraph(doc_title, ParagraphStyle(
            'RHs', parent=styles['Normal'],
            fontSize=9.5, textColor=colors.HexColor(header_text),
            alignment=TA_CENTER,
        ))],
    ]
    hdr_tbl = Table(header_data, colWidths=[content_w])
    hdr_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor(header_bg)),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(hdr_tbl)
    elements.append(Spacer(1, 6))

    # ── Receipt number ──
    if sec_cfg.get('showReceiptNumber', True):
        elements.append(Paragraph(
            f'N° Reçu : <b>{payment.receipt_number}</b>   |   Date : <b>{payment.payment_date}</b>',
            ParagraphStyle('RN', parent=styles['Normal'], fontSize=9, alignment=TA_RIGHT),
        ))
        elements.append(Spacer(1, 6))

    # ── Élève + détails du paiement (côte à côte) ──
    student = payment.student
    info_cell_style = TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor(border_color)),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ])

    left_tbl = right_tbl = None
    if body_cfg.get('showStudentInfo', True):
        info_rows = [
            ['Élève :', student.full_name if student else '-'],
            ['Matricule :', student.matricule if student else '-'],
            ['Classe :', student.classe.name if student and student.classe else '-'],
        ]
        left_tbl = Table(info_rows, colWidths=[2.6 * cm, half_w - 2.9 * cm])
        _ls = info_cell_style.getCommands() + [('BACKGROUND', (0, 0), (-1, -1), colors.HexColor(accent))]
        left_tbl.setStyle(TableStyle(_ls))

    if body_cfg.get('showPaymentDetails', True):
        detail_rows = [
            ['Type :', payment.get_payment_type_display()],
            ['Montant :', f'{float(payment.amount):,.0f} {currency}'],
            ['Statut :', payment.get_status_display()],
        ]
        if payment.due_date:
            detail_rows.append(['Échéance :', str(payment.due_date)])
        right_tbl = Table(detail_rows, colWidths=[2.6 * cm, half_w - 2.9 * cm])
        right_tbl.setStyle(info_cell_style)

    if left_tbl is not None or right_tbl is not None:
        cols_tbl = Table(
            [[left_tbl or '', right_tbl or '']],
            colWidths=[half_w, half_w],
        )
        cols_tbl.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (0, -1), 0),
            ('RIGHTPADDING', (0, 0), (0, -1), 6),
            ('LEFTPADDING', (1, 0), (1, -1), 6),
            ('RIGHTPADDING', (1, 0), (1, -1), 0),
        ]))
        elements.append(cols_tbl)
        elements.append(Spacer(1, 8))

    # ── Solde : scolarité, remise, net dû, payé, reste à payer ──
    if body_cfg.get('showBalance', True) and payment.student and payment.student.classe:
        student = payment.student
        from apps.payments.pension import build_pension_situation
        situ = build_pension_situation(student)
        tuition = situ['tuition']
        remise = situ['discount_amount']
        net_due = situ['net_due']
        total_paid = situ['total_paid']
        reste = situ['reste']
        bal_rows = [['Scolarité totale :', f'{tuition:,.0f} {currency}']]
        if remise > 0:
            reason = student.discount_reason or 'Remise'
            bal_rows.append([f'Remise ({reason}) :', f'- {remise:,.0f} {currency}'])
            bal_rows.append(['Net à payer :', f'{net_due:,.0f} {currency}'])
        bal_rows.append(['Total payé :', f'{total_paid:,.0f} {currency}'])
        bal_rows.append(['Reste à payer :', f'{reste:,.0f} {currency}'])
        bal_tbl = Table(bal_rows, colWidths=[4 * cm, content_w - 4 * cm])
        bal_tbl.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor(border_color)),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor(accent)),
            # Reste à payer en évidence
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('TEXTCOLOR', (1, -1), (1, -1), colors.HexColor('#c53030')),
        ]))
        elements.append(bal_tbl)
        elements.append(Spacer(1, 8))

        # ── Échéancier des tranches (répartition automatique) ──
        tranches = situ.get('tranches') or []
        if body_cfg.get('showTranches', True) and tranches:
            status_label = {'PAID': 'Soldée', 'PARTIAL': 'Partielle', 'PENDING': 'À venir'}
            tr_data = [['Tranche', 'Montant', 'Payé', 'Reste', 'Échéance', 'État']]
            for tr in tranches:
                tr_data.append([
                    tr['label'],
                    f"{tr['effective_amount']:,.0f}",
                    f"{tr['allocated']:,.0f}",
                    f"{tr['remaining']:,.0f}",
                    (tr['due_date'] or '—'),
                    status_label.get(tr['status'], tr['status']),
                ])
            # Largeurs proportionnelles à la largeur utile
            tr_widths = [w * content_w for w in (0.26, 0.15, 0.15, 0.15, 0.15, 0.14)]
            tr_tbl = Table(tr_data, colWidths=tr_widths)
            tr_style = [
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(primary)),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 7.5),
                ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor(border_color)),
                ('TOPPADDING', (0, 0), (-1, -1), 2.5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
            ]
            for i, tr in enumerate(tranches, start=1):
                if tr['status'] == 'PAID':
                    tr_style.append(('TEXTCOLOR', (5, i), (5, i), colors.HexColor('#276749')))
                elif tr['overdue']:
                    tr_style.append(('TEXTCOLOR', (5, i), (5, i), colors.HexColor('#c53030')))
            tr_tbl.setStyle(TableStyle(tr_style))
            elements.append(tr_tbl)
            elements.append(Spacer(1, 6))

    # ── Amount box + signatures (côte à côte pour gagner de la hauteur) ──
    amount_para = Paragraph(
        f'{float(payment.amount):,.0f} {currency}',
        ParagraphStyle('Amt', parent=styles['Normal'], fontSize=15,
                       fontName='Helvetica-Bold', textColor=colors.HexColor(primary),
                       alignment=TA_CENTER),
    )
    amount_box = Table([
        [Paragraph('Montant reçu', ParagraphStyle('AmtL', parent=styles['Normal'],
                   fontSize=7.5, textColor=colors.HexColor('#667085'), alignment=TA_CENTER))],
        [amount_para],
    ], colWidths=[half_w])
    amount_box.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor(accent)),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor(border_color)),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))

    sig_cell = ''
    if sig_cfg.get('show', True):
        sigs = [
            rt(sig_cfg.get('cashierLabel', 'Le Caissier')),
            rt(sig_cfg.get('directorLabel', 'Le Directeur')),
        ]
        sig_cell = Table([sigs, ['_' * 14] * len(sigs)], colWidths=[half_w / 2] * 2)
        sig_cell.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('TOPPADDING', (0, 0), (-1, 0), 4),
            ('TOPPADDING', (0, 1), (-1, 1), 14),
        ]))

    bottom_tbl = Table([[amount_box, sig_cell]], colWidths=[half_w, half_w])
    bottom_tbl.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'MIDDLE')]))
    elements.append(bottom_tbl)

    # ── Custom text block ──
    custom_text = rt(body_cfg.get('customText', ''))
    if custom_text:
        elements.append(Spacer(1, 4))
        elements.append(Paragraph(
            custom_text,
            ParagraphStyle('CT', parent=styles['Normal'], fontSize=8, alignment=TA_CENTER),
        ))

    # ── Footer ──
    if foot_cfg.get('show', True) and foot_cfg.get('text'):
        elements.append(Spacer(1, 6))
        elements.append(HRFlowable(width='100%', thickness=0.5, color=colors.HexColor(border_color)))
        elements.append(Paragraph(
            rt(foot_cfg['text']),
            ParagraphStyle('RF', parent=styles['Normal'],
                           fontSize=7, textColor=colors.HexColor('#667085'), alignment=TA_CENTER),
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
    platform_settings = _platform_settings(ecole=getattr(student, 'ecole', None))
    token_ctx = build_token_context(student=student, platform_settings=platform_settings)
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
    if body_cfg.get('showDateOfBirth', True):
        dob = token_ctx.get('{{DATE_NAISSANCE}}', '')
        birthplace = token_ctx.get('{{LIEU_NAISSANCE}}', '')
        if dob or birthplace:
            born = f"Né(e): {dob}"
            if birthplace:
                born += f" à {birthplace}"
            info_lines.append(born.strip())
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


def generate_payslip_pdf(salary):
    """Génère une fiche de paie PDF (A4 portrait) pour un versement de salaire."""
    ps = _platform_settings(ecole=getattr(salary, 'ecole', None))
    school_name = (ps.school_name if ps else '') or 'ÉTABLISSEMENT'

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=2 * cm, leftMargin=2 * cm,
        topMargin=1.6 * cm, bottomMargin=1.6 * cm,
    )
    styles = getSampleStyleSheet()
    elements = []
    primary = '#1a365d'

    # ── En-tête établissement + logo ──
    if ps and getattr(ps, 'logo', None):
        try:
            from reportlab.platypus import Image as _RLImage
            elements.append(_RLImage(ps.logo.path, width=2.2 * cm, height=2.2 * cm))
            elements.append(Spacer(1, 4))
        except Exception:
            pass
    elements.append(Paragraph(school_name, ParagraphStyle(
        'PSName', parent=styles['Title'], fontSize=15,
        textColor=colors.HexColor(primary), alignment=TA_CENTER, spaceAfter=2)))
    if ps and ps.bulletin_header:
        elements.append(Paragraph(
            ps.bulletin_header.replace('\n', '<br/>'),
            ParagraphStyle('PSHdr', parent=styles['Normal'], fontSize=8.5,
                           alignment=TA_CENTER, textColor=colors.HexColor('#4a5568'), spaceAfter=4)))
    elements.append(Paragraph('FICHE DE PAIE', ParagraphStyle(
        'PSTitle', parent=styles['Normal'], fontSize=13, fontName='Helvetica-Bold',
        alignment=TA_CENTER, textColor=colors.HexColor('#2d3748'), spaceAfter=2)))
    # Période affichée
    period = salary.period
    try:
        y, mth = period.split('-')
        mois = ['', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
                'août', 'septembre', 'octobre', 'novembre', 'décembre']
        period_disp = f"{mois[int(mth)]} {y}".capitalize()
    except Exception:
        period_disp = period
    elements.append(Paragraph(f"Période : {period_disp}", ParagraphStyle(
        'PSSub', parent=styles['Normal'], fontSize=10, alignment=TA_CENTER,
        textColor=colors.HexColor('#667085'), spaceAfter=12)))
    elements.append(HRFlowable(width='100%', thickness=1, color=colors.HexColor('#e2e8f0')))
    elements.append(Spacer(1, 12))

    # ── Employé ──
    emp_rows = [
        ['Employé :', salary.employee_name],
        ['Fonction :', salary.employee_position or '-'],
        ['Type :', salary.get_staff_type_display()],
        ['Date de versement :', str(salary.payment_date)],
        ['Mode de paiement :', salary.get_method_display()],
    ]
    emp_tbl = Table(emp_rows, colWidths=[5 * cm, 11 * cm])
    emp_tbl.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#4a5568')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
        ('TOPPADDING', (0, 0), (-1, -1), 7),
        ('LINEBELOW', (0, 0), (-1, -2), 0.4, colors.HexColor('#edf2f7')),
    ]))
    elements.append(emp_tbl)
    elements.append(Spacer(1, 16))

    # ── Récapitulatif de rémunération ──
    net = float(salary.amount)
    pay_rows = [
        ['Désignation', 'Montant (FCFA)'],
        ['Salaire versé', f'{net:,.0f}'],
        ['NET À PAYER', f'{net:,.0f}'],
    ]
    pay_tbl = Table(pay_rows, colWidths=[11 * cm, 5 * cm])
    pay_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(primary)),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e0')),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, -1), (-1, -1), 12),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#ebf8ff')),
        ('TEXTCOLOR', (0, -1), (-1, -1), colors.HexColor(primary)),
        ('LINEABOVE', (0, -1), (-1, -1), 1.2, colors.HexColor(primary)),
    ]))
    elements.append(pay_tbl)
    if salary.notes:
        elements.append(Spacer(1, 10))
        elements.append(Paragraph(f"Observations : {salary.notes}", ParagraphStyle(
            'PSNote', parent=styles['Normal'], fontSize=9, textColor=colors.HexColor('#4a5568'))))
    elements.append(Spacer(1, 40))

    # ── Signatures ──
    sig_tbl = Table([["L'Employé", 'La Direction'], ['_' * 22, '_' * 22]], colWidths=[8 * cm, 8 * cm])
    sig_tbl.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 1), (-1, 1), 22),
    ]))
    elements.append(sig_tbl)

    doc.build(elements)
    buffer.seek(0)
    return buffer


def generate_student_sheet_pdf(student):
    """Fiche élève PDF (A4 portrait) : identité, scolarité, parent, situation."""
    ps = _platform_settings(ecole=getattr(student, 'ecole', None))
    school_name = (ps.school_name if ps else '') or 'ÉTABLISSEMENT'

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=1.8 * cm, leftMargin=1.8 * cm,
        topMargin=1.5 * cm, bottomMargin=1.5 * cm,
    )
    styles = getSampleStyleSheet()
    elements = []
    primary = '#1a365d'

    # En-tête
    header_cells = []
    if ps and getattr(ps, 'logo', None):
        try:
            from reportlab.platypus import Image as _RLImage
            header_cells.append(_RLImage(ps.logo.path, width=2 * cm, height=2 * cm))
        except Exception:
            header_cells.append('')
    elements.append(Paragraph(school_name, ParagraphStyle(
        'SSName', parent=styles['Title'], fontSize=15,
        textColor=colors.HexColor(primary), alignment=TA_CENTER, spaceAfter=2)))
    elements.append(Paragraph('FICHE ÉLÈVE', ParagraphStyle(
        'SSTitle', parent=styles['Normal'], fontSize=13, fontName='Helvetica-Bold',
        alignment=TA_CENTER, textColor=colors.HexColor('#2d3748'), spaceAfter=10)))
    elements.append(HRFlowable(width='100%', thickness=1, color=colors.HexColor('#e2e8f0')))
    elements.append(Spacer(1, 10))

    # Photo + identité côte à côte
    photo_cell = ''
    if student.photo:
        try:
            from reportlab.platypus import Image as _RLImage
            photo_cell = _RLImage(student.photo.path, width=3 * cm, height=3.6 * cm)
        except Exception:
            photo_cell = Paragraph('[ Photo ]', styles['Normal'])
    else:
        photo_cell = Paragraph('[ Photo ]', ParagraphStyle('Ph', parent=styles['Normal'],
                                                           alignment=TA_CENTER, textColor=colors.HexColor('#98a2b3')))

    def _kv(rows, widths):
        t = Table(rows, colWidths=widths)
        t.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9.5),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#4a5568')),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LINEBELOW', (0, 0), (-1, -1), 0.3, colors.HexColor('#edf2f7')),
        ]))
        return t

    identity = _kv([
        ['Matricule :', student.matricule],
        ['Nom :', student.last_name],
        ['Prénom :', student.first_name],
        ['Genre :', student.get_gender_display()],
        ['Naissance :', f"{student.date_of_birth or '—'} à {student.birth_place or '—'}"],
        ['Nationalité :', student.nationality or '—'],
    ], [3 * cm, 8.4 * cm])

    top = Table([[photo_cell, identity]], colWidths=[3.6 * cm, 11.8 * cm])
    top.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (1, 0), (1, 0), 10)]))
    elements.append(top)
    elements.append(Spacer(1, 14))

    def section(title, tbl):
        elements.append(Paragraph(title, ParagraphStyle(
            'SSsec', parent=styles['Normal'], fontSize=10.5, fontName='Helvetica-Bold',
            textColor=colors.HexColor(primary), spaceAfter=4)))
        elements.append(tbl)
        elements.append(Spacer(1, 12))

    section('Scolarité', _kv([
        ['Classe :', student.classe.name if student.classe else '—'],
        ['Année scolaire :', student.classe.academic_year.name if student.classe and student.classe.academic_year else '—'],
        ["Date d'inscription :", str(student.enrolled_date) if student.enrolled_date else '—'],
        ['Statut :', 'Actif' if student.is_active else 'Inactif'],
    ], [4 * cm, 11.4 * cm]))

    section('Parent / Tuteur', _kv([
        ['Nom du parent :', student.parent_name or '—'],
        ['Téléphone :', student.parent_phone or '—'],
        ['Email :', student.parent_email or '—'],
        ['Adresse :', student.address or '—'],
    ], [4 * cm, 11.4 * cm]))

    # Situation financière (scolarité / remise / reste)
    try:
        from apps.payments.pension import build_pension_situation
        situ = build_pension_situation(student)
        fin_rows = [
            ['Scolarité :', f"{situ['tuition']:,.0f} FCFA"],
        ]
        if situ['discount_amount'] > 0:
            fin_rows.append(['Remise :', f"- {situ['discount_amount']:,.0f} FCFA"])
            fin_rows.append(['Net à payer :', f"{situ['net_due']:,.0f} FCFA"])
        fin_rows.append(['Total payé :', f"{situ['total_paid']:,.0f} FCFA"])
        fin_rows.append(['Reste à payer :', f"{situ['reste']:,.0f} FCFA"])
        section('Situation financière', _kv(fin_rows, [4 * cm, 11.4 * cm]))
    except Exception:
        pass

    elements.append(Spacer(1, 20))
    elements.append(Paragraph(
        f"Fiche éditée le {_date.today().strftime('%d/%m/%Y')}",
        ParagraphStyle('SSf', parent=styles['Normal'], fontSize=8,
                       textColor=colors.HexColor('#98a2b3'), alignment=TA_RIGHT)))

    doc.build(elements)
    buffer.seek(0)
    return buffer


def generate_class_roster_pdf(classe, students):
    """Liste des élèves d'une classe (A4 portrait) : Nom, Prénom, Sexe,
    Date et Lieu de naissance."""
    ps = _platform_settings(ecole=getattr(classe, 'ecole', None))
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=1.4 * cm, leftMargin=1.4 * cm,
        topMargin=1.4 * cm, bottomMargin=1.4 * cm,
    )
    styles = getSampleStyleSheet()
    elements = []

    school_name = (ps.school_name if ps else '') or ''
    if school_name:
        elements.append(Paragraph(school_name, ParagraphStyle(
            'RN', parent=styles['Title'], fontSize=14,
            textColor=colors.HexColor('#1a365d'), alignment=TA_CENTER, spaceAfter=2)))
    year_name = (ps.school_year if ps and ps.school_year else
                 (classe.academic_year.name if classe.academic_year else ''))
    elements.append(Paragraph(f"LISTE DES ÉLÈVES — CLASSE {classe.name}", ParagraphStyle(
        'RT', parent=styles['Normal'], fontSize=13, fontName='Helvetica-Bold',
        alignment=TA_CENTER, spaceAfter=2, textColor=colors.HexColor('#2d3748'))))
    sub = f"{len(students)} élève(s)"
    if year_name:
        sub = f"Année scolaire {year_name}  ·  " + sub
    elements.append(Paragraph(sub, ParagraphStyle(
        'RSub', parent=styles['Normal'], fontSize=9, alignment=TA_CENTER,
        textColor=colors.HexColor('#667085'), spaceAfter=12)))

    cell = ParagraphStyle('RC', parent=styles['Normal'], fontSize=8.5, leading=11)
    header = ['N°', 'Nom', 'Prénom', 'Sexe', 'Date de naissance', 'Lieu de naissance']
    data = [header]
    for i, s in enumerate(students, start=1):
        data.append([
            str(i),
            Paragraph(s.last_name or '—', cell),
            Paragraph(s.first_name or '—', cell),
            s.get_gender_display()[:1] if s.gender else '—',
            s.date_of_birth.strftime('%d/%m/%Y') if s.date_of_birth else '—',
            Paragraph(s.birth_place or '—', cell),
        ])
    tbl = Table(data, colWidths=[1.1 * cm, 4.3 * cm, 4.3 * cm, 1.4 * cm, 3.4 * cm, 4.0 * cm], repeatRows=1)
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2b6cb0')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('FONTSIZE', (0, 1), (-1, -1), 8.5),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('ALIGN', (3, 0), (4, -1), 'CENTER'),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f7fafc')]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(tbl)
    doc.build(elements)
    buffer.seek(0)
    return buffer


def generate_timetable_pdf(classe, entries):
    """Emploi du temps d'une classe (A4 paysage). `entries` : liste d'objets
    ScheduleEntry (jour, horaires, matière/libellé, salle)."""
    from reportlab.lib.pagesizes import landscape

    DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
    ps = _platform_settings(ecole=getattr(classe, 'ecole', None))
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=landscape(A4),
        rightMargin=1.2 * cm, leftMargin=1.2 * cm,
        topMargin=1.2 * cm, bottomMargin=1.2 * cm,
    )
    styles = getSampleStyleSheet()
    elements = []

    school_name = (ps.school_name if ps else '') or ''
    if school_name:
        elements.append(Paragraph(school_name, ParagraphStyle(
            'TN', parent=styles['Title'], fontSize=14,
            textColor=colors.HexColor('#1a365d'), alignment=TA_CENTER, spaceAfter=2)))
    year_name = (ps.school_year if ps and ps.school_year else
                 (classe.academic_year.name if classe.academic_year else ''))
    elements.append(Paragraph(f"EMPLOI DU TEMPS — CLASSE {classe.name}", ParagraphStyle(
        'TT', parent=styles['Normal'], fontSize=13, fontName='Helvetica-Bold',
        alignment=TA_CENTER, spaceAfter=2, textColor=colors.HexColor('#2d3748'))))
    if year_name:
        elements.append(Paragraph(f"Année scolaire {year_name}", ParagraphStyle(
            'TSub', parent=styles['Normal'], fontSize=9, alignment=TA_CENTER,
            textColor=colors.HexColor('#667085'), spaceAfter=12)))

    def _label(e):
        subj = getattr(e, 'subject', None)
        name = subj.name if subj else (e.subject_name or '—')
        room = f"\n({e.room})" if e.room else ''
        return f"{e.start_time.strftime('%H:%M')}–{e.end_time.strftime('%H:%M')}\n{name}{room}"

    cell = ParagraphStyle('TC', parent=styles['Normal'], fontSize=7.5, leading=9.5, alignment=TA_CENTER)
    by_day = {d: [] for d in range(6)}
    for e in entries:
        if e.day in by_day:
            by_day[e.day].append(e)
    for d in by_day:
        by_day[d].sort(key=lambda x: x.start_time)

    header = [Paragraph(f"<b>{DAYS[d]}</b>", ParagraphStyle('TH', parent=cell, textColor=colors.white)) for d in range(6)]
    max_rows = max((len(by_day[d]) for d in range(6)), default=0)
    data = [header]
    for r in range(max_rows):
        row = []
        for d in range(6):
            e = by_day[d][r] if r < len(by_day[d]) else None
            row.append(Paragraph(_label(e).replace('\n', '<br/>'), cell) if e else '')
        data.append(row)
    if max_rows == 0:
        data.append([Paragraph('Aucun créneau défini.', cell)] + [''] * 5)

    col_w = (27.0 / 6) * cm
    tbl = Table(data, colWidths=[col_w] * 6, repeatRows=1)
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2b6cb0')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e0')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f7fafc')]),
    ]))
    elements.append(tbl)
    doc.build(elements)
    buffer.seek(0)
    return buffer


def generate_teacher_timetable_pdf(teacher, entries):
    """Emploi du temps d'un professeur (A4 paysage) : ses créneaux sur toutes
    ses classes. `entries` : ScheduleEntry (jour, horaires, classe, matière, salle)."""
    from reportlab.lib.pagesizes import landscape

    DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
    ps = _platform_settings(ecole=getattr(teacher, 'ecole', None))
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=landscape(A4),
        rightMargin=1.2 * cm, leftMargin=1.2 * cm,
        topMargin=1.2 * cm, bottomMargin=1.2 * cm,
    )
    styles = getSampleStyleSheet()
    elements = []

    school_name = (ps.school_name if ps else '') or ''
    if school_name:
        elements.append(Paragraph(school_name, ParagraphStyle(
            'PTN', parent=styles['Title'], fontSize=14,
            textColor=colors.HexColor('#1a365d'), alignment=TA_CENTER, spaceAfter=2)))
    elements.append(Paragraph(f"EMPLOI DU TEMPS — {teacher.full_name}", ParagraphStyle(
        'PTT', parent=styles['Normal'], fontSize=13, fontName='Helvetica-Bold',
        alignment=TA_CENTER, spaceAfter=2, textColor=colors.HexColor('#2d3748'))))
    year_name = ps.school_year if ps and ps.school_year else ''
    if year_name:
        elements.append(Paragraph(f"Année scolaire {year_name}", ParagraphStyle(
            'PTSub', parent=styles['Normal'], fontSize=9, alignment=TA_CENTER,
            textColor=colors.HexColor('#667085'), spaceAfter=12)))

    def _label(e):
        subj = getattr(e, 'subject', None)
        name = subj.name if subj else (e.subject_name or '—')
        classe = e.classe.name if e.classe else '—'
        room = f" · {e.room}" if e.room else ''
        return f"{e.start_time.strftime('%H:%M')}–{e.end_time.strftime('%H:%M')}\n<b>{classe}</b>\n{name}{room}"

    cell = ParagraphStyle('PTC', parent=styles['Normal'], fontSize=7.5, leading=9.5, alignment=TA_CENTER)
    by_day = {d: [] for d in range(6)}
    for e in entries:
        if e.day in by_day:
            by_day[e.day].append(e)
    for d in by_day:
        by_day[d].sort(key=lambda x: x.start_time)

    header = [Paragraph(f"<b>{DAYS[d]}</b>", ParagraphStyle('PTH', parent=cell, textColor=colors.white)) for d in range(6)]
    max_rows = max((len(by_day[d]) for d in range(6)), default=0)
    data = [header]
    for r in range(max_rows):
        row = []
        for d in range(6):
            e = by_day[d][r] if r < len(by_day[d]) else None
            row.append(Paragraph(_label(e).replace('\n', '<br/>'), cell) if e else '')
        data.append(row)
    if max_rows == 0:
        data.append([Paragraph('Aucun créneau associé à ce professeur.', cell)] + [''] * 5)

    col_w = (27.0 / 6) * cm
    tbl = Table(data, colWidths=[col_w] * 6, repeatRows=1)
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2b6cb0')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e0')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f7fafc')]),
    ]))
    elements.append(tbl)
    doc.build(elements)
    buffer.seek(0)
    return buffer
