"""Custom middleware for SchoolPro."""
from django.conf import settings


class SecurityHeadersMiddleware:
    """Add security headers to every HTTP response."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Prevent MIME-type sniffing
        response['X-Content-Type-Options'] = 'nosniff'

        # Control Referrer information leakage
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'

        # Permissions Policy — disable unneeded browser features
        response['Permissions-Policy'] = (
            'geolocation=(), microphone=(self), camera=(self), '
            'payment=(), usb=(), magnetometer=(), gyroscope=()'
        )

        # Content Security Policy
        if not settings.DEBUG:
            response['Content-Security-Policy'] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline'; "
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                "font-src 'self' https://fonts.gstatic.com; "
                "img-src 'self' data: blob:; "
                "connect-src 'self'; "
                "frame-ancestors 'none';"
            )

        return response
