"""Seed initial data for development."""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.classes.models import AcademicYear, Level, Classe
from apps.students.models import Student
from apps.teachers.models import Teacher
from apps.subjects.models import Subject
from datetime import date

User = get_user_model()


class Command(BaseCommand):
    help = 'Seed the database with initial data'

    def handle(self, *args, **options):
        self.stdout.write('Seeding data...')

        # Create superuser
        if not User.objects.filter(username='admin').exists():
            admin = User.objects.create_superuser(
                username='admin', email='admin@ecole.bf',
                password='admin123', first_name='Admin', last_name='Système',
                role='ADMIN', phone='+22670000000'
            )
            self.stdout.write(self.style.SUCCESS(f'Admin créé: admin / admin123'))

        # Director
        if not User.objects.filter(username='directeur').exists():
            director = User.objects.create_user(
                username='directeur', email='directeur@ecole.bf',
                password='directeur123', first_name='Amadou', last_name='DAYAMBA',
                role='DIRECTOR', phone='+22670000001'
            )
            self.stdout.write(self.style.SUCCESS(f'Directeur créé: directeur / directeur123'))

        # Agent
        if not User.objects.filter(username='agent').exists():
            User.objects.create_user(
                username='agent', email='agent@ecole.bf',
                password='agent123', first_name='Ibrahim', last_name='OUEDRAOGO',
                role='AGENT', phone='+22670000005'
            )
            self.stdout.write(self.style.SUCCESS(f'Agent créé: agent / agent123'))

        # Academic Year
        year, _ = AcademicYear.objects.get_or_create(
            name='2025-2026',
            defaults={'start_date': date(2025, 10, 1), 'end_date': date(2026, 7, 31), 'is_current': True}
        )

        # Levels
        levels_data = [
            ('6ème', 1), ('5ème', 2), ('4ème', 3), ('3ème', 4),
            ('2nde', 5), ('1ère', 6), ('Terminale', 7),
        ]
        levels = {}
        for name, order in levels_data:
            level, _ = Level.objects.get_or_create(name=name, defaults={'order': order})
            levels[name] = level

        # Classes
        classes = {}
        for level_name in ['6ème', '5ème', '4ème', '3ème']:
            for suffix in ['A', 'B']:
                cname = f'{level_name} {suffix}'
                c, _ = Classe.objects.get_or_create(
                    name=cname, academic_year=year,
                    defaults={'level': levels[level_name], 'capacity': 50}
                )
                classes[cname] = c

        # Teachers
        teachers_data = [
            ('prof_math', 'Moussa', 'KABORE', 'Mathématiques', '+22670100001'),
            ('prof_fr', 'Fatou', 'TRAORE', 'Français', '+22670100002'),
            ('prof_ang', 'Paul', 'ZONGO', 'Anglais', '+22670100003'),
            ('prof_svt', 'Aïcha', 'SAWADOGO', 'SVT', '+22670100004'),
            ('prof_phys', 'Jean', 'COMPAORE', 'Physique-Chimie', '+22670100005'),
            ('prof_hist', 'Marie', 'OUEDRAOGO', 'Histoire-Géo', '+22670100006'),
        ]
        teachers = {}
        for username, first, last, speciality, phone in teachers_data:
            if not User.objects.filter(username=username).exists():
                user = User.objects.create_user(
                    username=username, password='prof123',
                    email=f'{username}@ecole.bf',
                    first_name=first, last_name=last,
                    role='TEACHER', phone=phone
                )
                teacher, _ = Teacher.objects.get_or_create(
                    user=user, defaults={'phone': phone, 'speciality': speciality}
                )
                teachers[speciality] = teacher
                self.stdout.write(self.style.SUCCESS(f'Prof créé: {username} / prof123'))
            else:
                user = User.objects.get(username=username)
                teacher = Teacher.objects.get(user=user)
                teachers[speciality] = teacher

        # Subjects per class
        subjects_map = {
            'Mathématiques': 4, 'Français': 4, 'Anglais': 2,
            'SVT': 2, 'Physique-Chimie': 3, 'Histoire-Géo': 2,
        }
        for cname, classe in classes.items():
            for subj_name, coeff in subjects_map.items():
                teacher = teachers.get(subj_name)
                Subject.objects.get_or_create(
                    name=subj_name, classe=classe,
                    defaults={'coefficient': coeff, 'teacher': teacher}
                )

        # Students
        import random
        first_names_m = ['Moussa', 'Ibrahim', 'Abdoul', 'Boukary', 'Hamidou', 'Seydou', 'Issa', 'Ousmane']
        first_names_f = ['Fatou', 'Aminata', 'Mariam', 'Aïcha', 'Rasmata', 'Bintou', 'Salamata', 'Fati']
        last_names = ['OUEDRAOGO', 'KABORE', 'SAWADOGO', 'TRAORE', 'ZONGO', 'COMPAORE', 'DIALLO', 'BARRY']

        for cname, classe in classes.items():
            for i in range(10):
                gender = random.choice(['M', 'F'])
                fname = random.choice(first_names_m if gender == 'M' else first_names_f)
                lname = random.choice(last_names)
                Student.objects.get_or_create(
                    first_name=fname, last_name=lname, classe=classe,
                    defaults={
                        'gender': gender,
                        'parent_phone': f'+2267{random.randint(0, 9)}{random.randint(100000, 999999):06d}',
                        'parent_name': f'Parent de {fname}',
                        'payment_status': random.choice(['PAID', 'PENDING', 'OVERDUE']),
                        'date_of_birth': date(
                            random.randint(2008, 2014),
                            random.randint(1, 12),
                            random.randint(1, 28)
                        ),
                    }
                )

        self.stdout.write(self.style.SUCCESS('Données initiales créées avec succès!'))
