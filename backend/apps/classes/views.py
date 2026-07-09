from datetime import date
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from apps.users.permissions import IsAdmin, IsClasseStaff
from apps.users.mixins import EcoleScopedMixin
from .models import AcademicYear, Level, Classe, ScheduleEntry, ScheduleFile, PensionTranche
from .serializers import (
    AcademicYearSerializer, LevelSerializer,
    ClasseSerializer, ClasseDetailSerializer, ScheduleEntrySerializer,
    ScheduleFileSerializer, PensionTrancheSerializer,
)


class PensionTrancheViewSet(EcoleScopedMixin, viewsets.ModelViewSet):
    """Tranches de l'échéancier de scolarité (pension) par classe."""
    ecole_lookup = 'classe__ecole'
    queryset = PensionTranche.objects.select_related('classe').all()
    serializer_class = PensionTrancheSerializer
    permission_classes = [IsClasseStaff]
    filterset_fields = ['classe']
    pagination_class = None


class ScheduleEntryViewSet(EcoleScopedMixin, viewsets.ModelViewSet):
    """Emploi du temps : créneaux par classe (matière, salle, jour, horaires)."""
    ecole_lookup = 'classe__ecole'
    queryset = ScheduleEntry.objects.select_related('classe', 'subject', 'subject__teacher', 'subject__teacher__user').all()
    serializer_class = ScheduleEntrySerializer
    permission_classes = [IsClasseStaff]
    filterset_fields = ['classe', 'day']


class ScheduleFileViewSet(EcoleScopedMixin, viewsets.ModelViewSet):
    """Fichiers d'emploi du temps associés à une classe."""
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    ecole_lookup = 'classe__ecole'
    queryset = ScheduleFile.objects.select_related('classe', 'uploaded_by').all()
    serializer_class = ScheduleFileSerializer
    permission_classes = [IsClasseStaff]
    filterset_fields = ['classe']

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)

# Ordre d'affichage des niveaux courants (noms tels qu'utilisés par le frontend)
_LEVEL_ORDER = {
    '6ème': 1, '5ème': 2, '4ème': 3, '3ème': 4,
    '2nde': 5, '1ère': 6, 'Terminale': 7,
}


def _current_or_new_year(ecole=None):
    """Retourne l'année académique courante de l'école, en la créant si besoin."""
    year = AcademicYear.objects.filter(is_current=True, ecole=ecole).first()
    if year:
        return year
    today = date.today()
    start_y = today.year if today.month >= 9 else today.year - 1
    name = f"{start_y}-{start_y + 1}"
    year, _ = AcademicYear.objects.get_or_create(
        name=name, ecole=ecole,
        defaults={
            'start_date': date(start_y, 10, 1),
            'end_date': date(start_y + 1, 7, 31),
            'is_current': True,
        },
    )
    if not year.is_current:
        year.is_current = True
        year.save()
    return year


def _get_or_create_level(name):
    name = (name or '').strip()
    level, _ = Level.objects.get_or_create(
        name=name, defaults={'order': _LEVEL_ORDER.get(name, 99)}
    )
    return level


def _infer_level_name(classe_name):
    """Déduit le nom du niveau à partir d'un nom de classe.
    Ex. « 6ème A » → « 6ème », « Terminale D » → « Terminale »."""
    classe_name = (classe_name or '').strip()
    # Correspondance directe avec un niveau connu en préfixe (accents inclus)
    for lvl in sorted(_LEVEL_ORDER, key=len, reverse=True):
        if classe_name.lower().startswith(lvl.lower()):
            return lvl
    # Sinon : tout sauf le dernier mot (la section), ou le nom complet
    parts = classe_name.split()
    return ' '.join(parts[:-1]) if len(parts) >= 2 else classe_name


class AcademicYearViewSet(EcoleScopedMixin, viewsets.ModelViewSet):
    queryset = AcademicYear.objects.all()
    serializer_class = AcademicYearSerializer
    permission_classes = [IsClasseStaff]

    def perform_create(self, serializer):
        serializer.save(**self.ecole_save_kwargs())

    @action(detail=True, methods=['post'], permission_classes=[IsClasseStaff])
    def set_current(self, request, pk=None):
        year = self.get_object()
        year.is_current = True
        year.save()
        return Response({'message': f'{year.name} est maintenant l\'année courante.'})


class LevelViewSet(viewsets.ModelViewSet):
    queryset = Level.objects.all()
    serializer_class = LevelSerializer
    permission_classes = [IsClasseStaff]
    pagination_class = None


class ClasseViewSet(EcoleScopedMixin, viewsets.ModelViewSet):
    queryset = Classe.objects.select_related('level', 'academic_year').all()
    permission_classes = [IsClasseStaff]
    filterset_fields = ['level', 'academic_year']
    search_fields = ['name']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ClasseDetailSerializer
        return ClasseSerializer

    def perform_create(self, serializer):
        serializer.save(**self.ecole_save_kwargs())

    def create(self, request, *args, **kwargs):
        """Création autonome : si l'année ou le niveau ne sont pas fournis,
        on résout l'année courante (créée au besoin) et le niveau via `level_name`.
        Permet de créer une classe même sur une base vierge."""
        ecole = getattr(request.user, 'ecole', None)
        data = request.data.copy()
        if not data.get('academic_year'):
            data['academic_year'] = _current_or_new_year(ecole).id
        if not data.get('level') and data.get('level_name'):
            data['level'] = _get_or_create_level(data.get('level_name')).id
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def destroy(self, request, *args, **kwargs):
        """Suppression protégée : l'utilisateur doit confirmer avec son mot de passe."""
        password = request.data.get('password') or request.query_params.get('password') or ''
        if not password or not request.user.check_password(password):
            return Response(
                {'error': 'Mot de passe incorrect. Suppression annulée.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['post'], permission_classes=[IsClasseStaff])
    def promote(self, request):
        """Transfert inter-années : promeut les élèves d'une année vers une autre.

        Corps attendu :
          target_year_id | target_year_name : année cible (existante ou à créer)
          mappings : [{source_classe_id, target_classe_id | target_classe_name (+ level_name)}]
          exclude_student_ids : élèves à ne pas transférer (redoublants)
          set_current : bool — définir l'année cible comme courante
        """
        from apps.students.models import Student
        data = request.data
        ecole = getattr(request.user, 'ecole', None)

        # ── Résolution de l'année cible ──
        year = None
        if data.get('target_year_id'):
            year = AcademicYear.objects.filter(id=data['target_year_id']).first()
        if year is None and data.get('target_year_name'):
            name = str(data['target_year_name']).strip()
            try:
                start_y = int(name.split('-')[0])
            except (ValueError, IndexError):
                start_y = date.today().year
            year, _ = AcademicYear.objects.get_or_create(
                name=name, ecole=ecole,
                defaults={'start_date': date(start_y, 10, 1),
                          'end_date': date(start_y + 1, 7, 31)},
            )
        if year is None:
            return Response({'error': 'Année cible requise (target_year_id ou target_year_name).'}, status=400)

        exclude = set(data.get('exclude_student_ids') or [])
        source_qs = self.get_queryset()  # scope par école
        promoted, created_classes, details = 0, 0, []

        for m in (data.get('mappings') or []):
            src = source_qs.filter(id=m.get('source_classe_id')).first()
            if not src:
                continue
            tgt = None
            if m.get('target_classe_id'):
                tgt = Classe.objects.filter(id=m['target_classe_id']).first()
            if tgt is None and m.get('target_classe_name'):
                level = _get_or_create_level(m['level_name']) if m.get('level_name') else src.level
                tgt, was = Classe.objects.get_or_create(
                    name=str(m['target_classe_name']).strip(), academic_year=year,
                    defaults={'level': level, 'capacity': src.capacity,
                              'tuition_fee': src.tuition_fee, 'ecole': ecole},
                )
                if was:
                    created_classes += 1
            if tgt is None:
                continue
            students = Student.objects.filter(classe=src, is_active=True).exclude(id__in=exclude)
            n = students.count()
            students.update(classe=tgt)
            promoted += n
            details.append({'source': src.name, 'target': tgt.name, 'count': n})

        if data.get('set_current'):
            year.is_current = True
            year.save()

        return Response({
            'promoted': promoted,
            'created_classes': created_classes,
            'target_year': year.name,
            'target_year_id': year.id,
            'details': details,
        })

    @action(detail=False, methods=['get'])
    def current_year(self, request):
        """Classes de l'année courante (de l'école de l'utilisateur)."""
        years = AcademicYear.objects.filter(is_current=True)
        u = request.user
        if u.role != 'ADMIN' and getattr(u, 'ecole_id', None):
            years = years.filter(ecole_id=u.ecole_id)
        current = years.first()
        if not current:
            return Response([])
        # get_queryset applique déjà le filtrage par école
        classes = self.get_queryset().filter(academic_year=current)
        serializer = ClasseSerializer(classes, many=True)
        return Response(serializer.data)
