from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ['ADMIN', 'DIRECTOR']


class CanEditGrades(BasePermission):
    """Notes : lecture pour ADMIN/DIRECTOR/TEACHER ; écriture réservée aux
    PROFESSEURS (le directeur est en lecture seule). L'admin reste autorisé
    en écriture pour la maintenance technique."""
    def has_permission(self, request, view):
        u = request.user
        if not u.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return u.role in ['ADMIN', 'DIRECTOR', 'TEACHER', 'EDUCATEUR']
        return u.role in ['TEACHER', 'ADMIN']


class IsAttendanceStaff(BasePermission):
    """Présences/assiduité : lecture pour tout utilisateur authentifié ;
    écriture pour ADMIN, DIRECTOR et ÉDUCATEUR."""
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.role in ['ADMIN', 'DIRECTOR', 'EDUCATEUR']


class IsCommunicationStaff(BasePermission):
    """Communication avec les parents : ADMIN, DIRECTOR et ÉDUCATEUR."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ['ADMIN', 'DIRECTOR', 'EDUCATEUR']


class IsClasseStaff(BasePermission):
    """Classes/niveaux/années : lecture pour tout utilisateur authentifié ;
    création/modification pour ADMIN, DIRECTOR et ÉDUCATEUR."""
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.role in ['ADMIN', 'DIRECTOR', 'EDUCATEUR']


class IsStudentStaff(BasePermission):
    """Élèves : lecture pour tout utilisateur authentifié ; création/modification
    pour ADMIN, DIRECTOR et ÉDUCATEUR (inscription, import…)."""
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.role in ['ADMIN', 'DIRECTOR', 'EDUCATEUR']


class CanViewReports(BasePermission):
    """Lecture des documents (bulletins, listes de classe…) : ADMIN, DIRECTOR,
    TEACHER et ÉDUCATEUR."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in [
            'ADMIN', 'DIRECTOR', 'TEACHER', 'EDUCATEUR'
        ]


class IsCashStaff(BasePermission):
    """Paiements : lecture pour tout utilisateur authentifié ; encaissement /
    modification pour ADMIN, DIRECTOR et CAISSE."""
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.role in ['ADMIN', 'DIRECTOR', 'CAISSE']


class IsCashManager(BasePermission):
    """Dépenses / reçus : réservé à ADMIN, DIRECTOR et CAISSE (lecture + écriture)."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ['ADMIN', 'DIRECTOR', 'CAISSE']


class IsDirector(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'DIRECTOR'


class IsTeacher(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'TEACHER'


class IsAgent(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'AGENT'


class IsAdminOrTeacher(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ['ADMIN', 'DIRECTOR', 'TEACHER']


class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in ['GET', 'HEAD', 'OPTIONS']:
            return request.user.is_authenticated
        return request.user.is_authenticated and request.user.role in ['ADMIN', 'DIRECTOR']
