from datetime import datetime

from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny

from apps.users.permissions import IsPlatformAdmin
from .models import License
from .signing import verify_code


class LicenseStatusView(APIView):
    """État de la licence (plan, jours restants, identifiant machine).
    Accessible sans authentification pour afficher l'écran d'activation."""
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(License.get_solo().status_dict())


class LicenseActivateView(APIView):
    """Active/renouvelle la licence via un code d'activation (ADMIN)."""
    permission_classes = [IsPlatformAdmin]

    def post(self, request):
        code = (request.data.get('code') or '').strip()
        if not code:
            return Response({'error': 'Code d\'activation requis.'}, status=400)

        lic = License.get_solo()
        payload = verify_code(code)
        if payload is None:
            return Response({'error': 'Code invalide ou corrompu.'}, status=400)
        if str(payload.get('m')) != str(lic.machine_id):
            return Response({'error': 'Ce code ne correspond pas à cette installation.'}, status=400)
        try:
            exp = datetime.strptime(payload['exp'], '%Y-%m-%d')
            exp = timezone.make_aware(exp.replace(hour=23, minute=59, second=59))
        except (ValueError, KeyError):
            return Response({'error': 'Date d\'expiration invalide dans le code.'}, status=400)
        if exp <= timezone.now():
            return Response({'error': 'Ce code est déjà expiré.'}, status=400)

        lic.plan = License.Plan.LICENSED
        lic.expires_at = exp
        lic.activated_at = timezone.now()
        lic.last_code = code
        lic.save()

        from apps.users.models import log_activity
        log_activity(request.user, 'LOGIN', f'Licence activée jusqu\'au {exp:%d/%m/%Y}', request)
        return Response({'message': 'Licence activée avec succès.', **lic.status_dict()})
