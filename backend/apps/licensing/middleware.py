"""Blocage des requêtes API lorsque la licence est expirée.

Les chemins essentiels (santé, authentification, licence) restent accessibles
pour permettre la connexion et l'activation même après expiration.
"""
from django.http import JsonResponse

WHITELIST_PREFIXES = (
    '/api/health',
    '/api/auth/',       # connexion / déconnexion / refresh de token
    '/api/license/',    # état + activation de la licence
)


class LicenseEnforcementMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path
        if path.startswith('/api/') and not path.startswith(WHITELIST_PREFIXES):
            from .models import License
            lic = License.get_solo()
            if not lic.is_valid:
                return JsonResponse(
                    {
                        'code': 'LICENSE_EXPIRED',
                        'detail': "Licence expirée. Veuillez activer un code pour continuer.",
                        'days_left': 0,
                        'machine_id': lic.machine_id,
                    },
                    status=403,
                )
        return self.get_response(request)
