"""
Seed realistic data for SchoolPro development & demo.

Creates:
  - 1 Directeur    directeur / directeur123
  - 1 Admin        admin / admin123
  - 6 Professeurs  prof_math … / prof123
  - 1 Agent        agent / agent123
  - 8 classes  (6e, 5e, 4e, 3e  x  A et B)
  - 6 matieres par classe avec coefficients
  - ~35 eleves par classe (~280 au total) avec parents, dates, statuts
  - 3 notes par matiere par eleve (devoir, interro, examen)
  - Paiements (70% PAID, 20% PENDING, 10% OVERDUE)
  - Presences de la semaine courante
"""
import random
from datetime import date, timedelta
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.classes.models import AcademicYear, Level, Classe
from apps.students.models import Student
from apps.teachers.models import Teacher
from apps.subjects.models import Subject
from apps.grades.models import Grade
from apps.payments.models import Payment
from apps.attendance.models import Attendance
from utils.qr_generator import generate_qr_for_student

User = get_user_model()
rng = random.Random(42)   # reproductible


PRENOMS_G = [
    'Moussa', 'Ibrahim', 'Abdoul', 'Boukary', 'Hamidou',
    'Seydou', 'Issa', 'Ousmane', 'Adama', 'Yacouba',
    'Souleymane', 'Mahamadou', 'Saidou', 'Noufou', 'Drissa',
]
PRENOMS_F = [
    'Fatou', 'Aminata', 'Mariam', 'Aicha', 'Rasmata',
    'Bintou', 'Salamata', 'Fati', 'Hawa', 'Djeneba',
    'Rokiatou', 'Maimouna', 'Safiatou', 'Kadidiatou', 'Nafi',
]
NOMS = [
    'OUEDRAOGO', 'KABORE', 'SAWADOGO', 'TRAORE', 'ZONGO',
    'COMPAORE', 'DIALLO', 'BARRY', 'COULIBALY', 'SANKARA',
    'TIENDREBEOGO', 'NIKIEMA', 'YAMEOGO', 'ILBOUDO', 'SOME',
    'TAPSOBA', 'TOURE', 'KONE', 'BAH', 'SORE',
]
LIEUX = [
    'Ouagadougou', 'Bobo-Dioulasso', 'Koudougou', 'Banfora',
    'Ouahigouya', 'Kaya', 'Tenkodogo', 'Fada', 'Dedougou', 'Reo',
]
NATIONALITES = ['Burkinabe', 'Malienne', 'Ivoirienne', 'Ghaneenne', 'Togolaise']


def _phone():
    prefix = rng.choice(['70', '71', '72', '73', '74', '75', '76', '78', '79'])
    return f'+226{prefix}{rng.randint(100000, 999999):06d}'


def _email(first, last):
    return f'{first.lower()}.{last.lower()}@ecole-demo.bf'


class Command(BaseCommand):
    help = 'Seed SchoolPro with realistic demo data'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset', action='store_true', default=False,
            help='Supprime toutes les donnees avant de recreer',
        )

    def handle(self, *args, **options):
        if options['reset']:
            self._reset()

        self.stdout.write(self.style.WARNING('Seed SchoolPro...'))

        year    = self._year()
        levels  = self._levels()
        classes = self._classes(year, levels)
        teachers = self._users_and_teachers()
        subjects = self._subjects(classes, teachers)
        students = self._students(classes)
        self._grades(students, subjects)
        self._payments(students)
        self._attendance(students)

        self.stdout.write(self.style.SUCCESS('\nSeed termine avec succes !'))
        self._print_summary(students, classes, teachers)

    # ── Reset ──────────────────────────────────────────────────────────────────
    def _reset(self):
        self.stdout.write('  Suppression des donnees existantes...')
        Attendance.objects.all().delete()
        Payment.objects.all().delete()
        Grade.objects.all().delete()
        Student.objects.all().delete()
        Subject.objects.all().delete()
        Teacher.objects.all().delete()
        Classe.objects.all().delete()
        Level.objects.all().delete()
        AcademicYear.objects.all().delete()
        User.objects.filter(is_superuser=False).delete()
        self.stdout.write('  Base reinitialisee')

    # ── Academic year ──────────────────────────────────────────────────────────
    def _year(self):
        year, created = AcademicYear.objects.get_or_create(
            name='2025-2026',
            defaults={
                'start_date': date(2025, 10, 1),
                'end_date':   date(2026, 7, 31),
                'is_current': True,
            }
        )
        if created:
            self.stdout.write('  Annee scolaire 2025-2026 creee')
        return year

    # ── Levels ─────────────────────────────────────────────────────────────────
    def _levels(self):
        levels = {}
        for order, name in enumerate(
            ['6eme', '5eme', '4eme', '3eme', '2nde', '1ere', 'Terminale'], start=1
        ):
            l, _ = Level.objects.get_or_create(name=name, defaults={'order': order})
            levels[name] = l

        # Ensure display names also exist
        display_map = {
            '6eme': '6eme', '5eme': '5eme', '4eme': '4eme', '3eme': '3eme',
        }
        self.stdout.write(f'  {len(levels)} niveaux')
        return levels

    # ── Classes ────────────────────────────────────────────────────────────────
    def _classes(self, year, levels):
        classes = {}
        mapping = [
            ('6eme A', '6eme'), ('6eme B', '6eme'),
            ('5eme A', '5eme'), ('5eme B', '5eme'),
            ('4eme A', '4eme'), ('4eme B', '4eme'),
            ('3eme A', '3eme'), ('3eme B', '3eme'),
        ]
        for cname, lname in mapping:
            level = levels.get(lname)
            if not level:
                continue
            c, _ = Classe.objects.get_or_create(
                name=cname, academic_year=year,
                defaults={'level': level, 'capacity': 40}
            )
            classes[cname] = c
        self.stdout.write(f'  {len(classes)} classes')
        return classes

    # ── Users & Teachers ───────────────────────────────────────────────────────
    def _users_and_teachers(self):
        # Admin
        if not User.objects.filter(username='admin').exists():
            User.objects.create_superuser(
                username='admin', email='admin@ecole-demo.bf',
                password='admin123',
                first_name='Administrateur', last_name='SYSTEME',
                role='ADMIN', phone=_phone()
            )
            self.stdout.write('  admin / admin123  [ADMIN]')

        # Directeur
        if not User.objects.filter(username='directeur').exists():
            User.objects.create_user(
                username='directeur', email='directeur@ecole-demo.bf',
                password='directeur123',
                first_name='Amadou', last_name='DAYAMBA',
                role='DIRECTOR', phone=_phone()
            )
            self.stdout.write('  directeur / directeur123  [DIRECTEUR]')

        # Agent
        if not User.objects.filter(username='agent').exists():
            User.objects.create_user(
                username='agent', email='agent@ecole-demo.bf',
                password='agent123',
                first_name='Ibrahim', last_name='OUEDRAOGO',
                role='AGENT', phone=_phone()
            )
            self.stdout.write('  agent / agent123  [AGENT]')

        # Professeurs
        PROF_DATA = [
            ('prof_math',  'Moussa',    'KABORE',    'Mathematiques',    '70100001'),
            ('prof_fr',    'Fatou',     'TRAORE',    'Francais',         '70100002'),
            ('prof_ang',   'Paul',      'ZONGO',     'Anglais',          '70100003'),
            ('prof_svt',   'Aicha',     'SAWADOGO',  'SVT',              '70100004'),
            ('prof_phys',  'Jean',      'COMPAORE',  'Physique-Chimie',  '70100005'),
            ('prof_hist',  'Marie',     'OUEDRAOGO', 'Histoire-Geo',     '70100006'),
        ]
        teachers = {}
        for uname, first, last, speciality, ph in PROF_DATA:
            if not User.objects.filter(username=uname).exists():
                u = User.objects.create_user(
                    username=uname, password='prof123',
                    email=f'{uname}@ecole-demo.bf',
                    first_name=first, last_name=last,
                    role='TEACHER', phone=f'+226{ph}'
                )
                t, _ = Teacher.objects.get_or_create(
                    user=u, defaults={'phone': f'+226{ph}', 'speciality': speciality}
                )
            else:
                u = User.objects.get(username=uname)
                t, _ = Teacher.objects.get_or_create(
                    user=u, defaults={'phone': f'+226{ph}', 'speciality': speciality}
                )
            teachers[speciality] = t
            self.stdout.write(f'  {uname} / prof123  [{speciality}]')

        return teachers

    # ── Subjects ───────────────────────────────────────────────────────────────
    def _subjects(self, classes, teachers):
        SUBJECTS = [
            ('Mathematiques',   4, 'Mathematiques'),
            ('Francais',        4, 'Francais'),
            ('Anglais',         2, 'Anglais'),
            ('SVT',             2, 'SVT'),
            ('Physique-Chimie', 3, 'Physique-Chimie'),
            ('Histoire-Geo',    2, 'Histoire-Geo'),
        ]
        subjects_by_class = {}
        for cname, classe in classes.items():
            subjects_by_class[cname] = []
            for name, coeff, tkey in SUBJECTS:
                s, _ = Subject.objects.get_or_create(
                    name=name, classe=classe,
                    defaults={'coefficient': coeff, 'teacher': teachers.get(tkey)}
                )
                subjects_by_class[cname].append(s)
        total = sum(len(v) for v in subjects_by_class.values())
        self.stdout.write(f'  {total} matieres')
        return subjects_by_class

    # ── Students ───────────────────────────────────────────────────────────────
    def _students(self, classes):
        students_by_class = {}
        total = 0
        for cname, classe in classes.items():
            lst = []
            nb = rng.randint(30, 38)
            for i in range(nb):
                gender = rng.choice(['M', 'F'])
                first  = rng.choice(PRENOMS_G if gender == 'M' else PRENOMS_F)
                last   = rng.choice(NOMS)

                # Avoid strict duplicate inside same class
                if Student.objects.filter(
                    first_name=first, last_name=last, classe=classe
                ).exists():
                    first = first + str(i)

                dob = date(
                    rng.randint(2008, 2014),
                    rng.randint(1, 12),
                    rng.randint(1, 28),
                )
                pay_status = rng.choices(
                    ['PAID', 'PENDING', 'OVERDUE'], weights=[70, 20, 10]
                )[0]
                s = Student.objects.create(
                    first_name=first,
                    last_name=last,
                    gender=gender,
                    classe=classe,
                    date_of_birth=dob,
                    birth_place=rng.choice(LIEUX),
                    nationality=rng.choice(NATIONALITES),
                    parent_name=f'{rng.choice(NOMS)} {rng.choice(PRENOMS_G)}',
                    parent_phone=_phone(),
                    parent_email=_email(first, last),
                    address=f'Secteur {rng.randint(1, 30)}, {rng.choice(LIEUX)}',
                    payment_status=pay_status,
                )
                try:
                    generate_qr_for_student(s)
                except Exception:
                    pass
                lst.append(s)
                total += 1
            students_by_class[cname] = lst
        self.stdout.write(f'  {total} eleves crees avec QR codes')
        return students_by_class

    # ── Grades ─────────────────────────────────────────────────────────────────
    def _grades(self, students_by_class, subjects_by_class):
        TYPES = ['DEVOIR', 'INTERRO', 'EXAMEN']
        total = 0
        for cname, students in students_by_class.items():
            subjects = subjects_by_class.get(cname, [])
            for student in students:
                for subject in subjects:
                    for gtype in TYPES:
                        raw   = rng.gauss(12, 4)
                        value = round(max(0.0, min(20.0, raw)), 2)
                        Grade.objects.get_or_create(
                            student=student,
                            subject=subject,
                            type_evaluation=gtype,
                            defaults={'value': value, 'max_value': 20},
                        )
                        total += 1
        self.stdout.write(f'  {total} notes')

    # ── Payments ───────────────────────────────────────────────────────────────
    def _payments(self, students_by_class):
        TRANCHES = [
            ('Inscription',    25000, date(2025, 10, 1),  date(2025, 10, 31)),
            ('1er trimestre',  45000, date(2026, 1, 5),   date(2026, 1, 31)),
            ('2eme trimestre', 45000, date(2026, 4, 1),   date(2026, 4, 30)),
        ]
        total = 0
        for students in students_by_class.values():
            for student in students:
                for label, amount, pay_date, due_date in TRANCHES:
                    if student.payment_status == 'PAID':
                        st = 'PAID'
                    elif student.payment_status == 'OVERDUE':
                        st = rng.choice(['PENDING', 'OVERDUE'])
                    else:
                        st = rng.choice(['PAID', 'PENDING'])

                    Payment.objects.get_or_create(
                        student=student,
                        payment_type=label,
                        defaults={
                            'amount':       amount,
                            'payment_date': pay_date,
                            'due_date':     due_date,
                            'status':       st,
                        }
                    )
                    total += 1
        self.stdout.write(f'  {total} paiements')

    # ── Attendance (semaine courante) ──────────────────────────────────────────
    def _attendance(self, students_by_class):
        from django.utils import timezone as tz
        today  = date.today()
        monday = today - timedelta(days=today.weekday())
        school_days = [
            monday + timedelta(days=d)
            for d in range(5)
            if (monday + timedelta(days=d)) <= today
        ]
        if not school_days:
            self.stdout.write('  Presences: aucun jour scolaire ecoule cette semaine')
            return

        all_students = [s for lst in students_by_class.values() for s in lst]
        total = 0
        for student in all_students:
            for day in school_days:
                status = rng.choices(
                    ['PRESENT', 'LATE', 'ABSENT'], weights=[70, 15, 15]
                )[0]
                check_in = check_out = None
                if status in ('PRESENT', 'LATE'):
                    h = 7 if status == 'PRESENT' else rng.randint(8, 9)
                    m = rng.randint(30, 59) if status == 'PRESENT' else rng.randint(0, 30)
                    check_in  = tz.datetime(day.year, day.month, day.day, h, m).time()
                    check_out = tz.datetime(day.year, day.month, day.day, 17, rng.randint(0, 30)).time()

                Attendance.objects.get_or_create(
                    student=student, date=day,
                    defaults={
                        'status':    status,
                        'check_in':  check_in,
                        'check_out': check_out,
                    }
                )
                total += 1
        self.stdout.write(f'  {total} presences (semaine en cours)')

    # ── Summary table ─────────────────────────────────────────────────────────
    def _print_summary(self, students_by_class, classes, teachers):
        total_students = sum(len(v) for v in students_by_class.values())
        line = '-' * 56
        self.stdout.write('\n' + line)
        self.stdout.write(self.style.SUCCESS('  COMPTES PRETS A UTILISER'))
        self.stdout.write(line)
        rows = [
            ('DIRECTEUR', 'directeur',  'directeur123', '/dashboard'),
            ('ADMIN',     'admin',      'admin123',      '/dashboard'),
            ('PROF',      'prof_math',  'prof123',       '/teacher'),
            ('PROF',      'prof_fr',    'prof123',       '/teacher'),
            ('PROF',      'prof_ang',   'prof123',       '/teacher'),
            ('PROF',      'prof_svt',   'prof123',       '/teacher'),
            ('PROF',      'prof_phys',  'prof123',       '/teacher'),
            ('PROF',      'prof_hist',  'prof123',       '/teacher'),
            ('AGENT',     'agent',      'agent123',      '/scan'),
        ]
        for role, uname, pwd, redirect in rows:
            self.stdout.write(f'  {role:<12} {uname:<16} {pwd:<16} -> {redirect}')
        self.stdout.write(line)
        self.stdout.write(f'  Classes   : {len(classes)}')
        self.stdout.write(f'  Eleves    : {total_students}')
        self.stdout.write(f'  Matieres  : {len(classes) * 6}')
        self.stdout.write(f'  Profs     : {len(teachers)}')
        self.stdout.write(line)
