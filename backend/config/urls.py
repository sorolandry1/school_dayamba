from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from django.utils import timezone
from django.db import connection
from config.spa import spa_serve


def health_check(request):
    """Lightweight health probe for uptime monitoring."""
    try:
        connection.ensure_connection()
        db_ok = True
    except Exception:
        db_ok = False

    status_code = 200 if db_ok else 503
    return JsonResponse({
        'status': 'ok' if db_ok else 'degraded',
        'timestamp': timezone.now().isoformat(),
        'database': 'ok' if db_ok else 'error',
        'version': '1.0.0',
    }, status=status_code)


urlpatterns = [
    path('api/health/', health_check, name='health_check'),
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.users.urls')),
    path('api/students/', include('apps.students.urls')),
    path('api/teachers/', include('apps.teachers.urls')),
    path('api/classes/', include('apps.classes.urls')),
    path('api/subjects/', include('apps.subjects.urls')),
    path('api/grades/', include('apps.grades.urls')),
    path('api/attendance/', include('apps.attendance.urls')),
    path('api/payments/', include('apps.payments.urls')),
    path('api/reports/', include('apps.reports.urls')),
    path('api/payroll/', include('apps.payroll.urls')),
    path('api/license/', include('apps.licensing.urls')),
    path('api/schoolyear/', include('apps.schoolyear.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Media servi aussi hors DEBUG lorsque l'app est empaquetée (un seul port).
# NB : django.conf.urls.static.static() est un no-op quand DEBUG=False ; on route
# donc explicitement vers la vue `serve` pour que les fichiers média (photos
# élèves, QR codes, logos) soient réellement servis dans l'exe distribué —
# sinon /media/... tombe dans le catch-all SPA et renvoie index.html.
if settings.FRONTEND_BUILD_DIR and not settings.DEBUG:
    from django.views.static import serve as _media_serve
    _media_prefix = settings.MEDIA_URL.lstrip('/')
    urlpatterns += [
        re_path(rf'^{_media_prefix}(?P<path>.*)$', _media_serve,
                {'document_root': settings.MEDIA_ROOT}),
    ]

# ─── Application React (build) : catch-all EN DERNIER ────────────────────────
# Ne s'active que si un build est empaqueté ; sinon (dev) le front tourne à part.
if settings.FRONTEND_BUILD_DIR:
    urlpatterns += [re_path(r'^(?P<path>.*)$', spa_serve)]
