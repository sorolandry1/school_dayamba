from rest_framework.views import APIView
from rest_framework.response import Response

from apps.users.permissions import IsPlatformAdmin
from . import service


def _confirmed(request):
    return str(request.data.get('confirm', '')).lower() in ('true', '1', 'yes')


class ArchivesView(APIView):
    """Liste les archives physiques d'années scolaires + année active."""
    permission_classes = [IsPlatformAdmin]

    def get(self, request):
        try:
            return Response({
                'active_year': service._current_year_name(),
                'archives': service.list_archives(),
            })
        except Exception as exc:
            return Response({'error': str(exc)}, status=400)


class ArchiveNowView(APIView):
    """Archive (copie physique) l'année en cours, sans rien supprimer."""
    permission_classes = [IsPlatformAdmin]

    def post(self, request):
        try:
            info = service.archive_current_year(request.data.get('year_name'))
            from apps.users.models import log_activity
            log_activity(request.user, 'LOGIN', f"Archive année : {info['file']}", request)
            return Response({'message': 'Année archivée.', **info})
        except Exception as exc:
            return Response({'error': str(exc)}, status=400)


class NewYearView(APIView):
    """Clôture l'année en cours (archive) et démarre une nouvelle année."""
    permission_classes = [IsPlatformAdmin]

    def post(self, request):
        if not _confirmed(request):
            return Response({'error': 'Confirmation requise (confirm=true).'}, status=400)
        name = (request.data.get('name') or '').strip()
        if not name:
            return Response({'error': "Nom de la nouvelle année requis."}, status=400)
        try:
            info = service.start_new_year(
                name,
                reset_grades=request.data.get('reset_grades', True) in (True, 'true', '1', 1),
                reset_attendance=request.data.get('reset_attendance', True) in (True, 'true', '1', 1),
                reset_financials=request.data.get('reset_financials', True) in (True, 'true', '1', 1),
            )
            from apps.users.models import log_activity
            log_activity(request.user, 'LOGIN', f"Nouvelle année scolaire : {info['new_year']}", request)
            return Response({'message': f"Nouvelle année {info['new_year']} démarrée.", **info})
        except Exception as exc:
            return Response({'error': str(exc)}, status=400)


class RestoreArchiveView(APIView):
    """Restaure une archive d'année comme base active (redémarrage requis)."""
    permission_classes = [IsPlatformAdmin]

    def post(self, request):
        if not _confirmed(request):
            return Response({'error': 'Confirmation requise (confirm=true).'}, status=400)
        filename = request.data.get('filename')
        if not filename:
            return Response({'error': 'Nom de fichier requis.'}, status=400)
        try:
            info = service.restore_archive(filename)
            from apps.users.models import log_activity
            log_activity(request.user, 'LOGIN', f"Restauration archive : {info['restored_from']}", request)
            return Response({
                'message': 'Archive restaurée. Redémarrez le serveur pour appliquer.',
                **info,
            })
        except Exception as exc:
            return Response({'error': str(exc)}, status=400)
