"""CSRF enforcement for cookie-based JWT authentication.

When a request carries the HttpOnly access cookie (and no bearer header), it is
authenticated via cookie. State-changing such requests must present a matching
CSRF token (``X-CSRFToken`` header equal to the ``csrftoken`` cookie). Auth
endpoints are exempt so login/register/refresh work without a token round-trip.
"""
from django.conf import settings
from django.utils.deprecation import MiddlewareMixin

EXEMPT_PATHS = ("/api/auth/", "/api/csrf/", "/api/shopify/webhooks/", "/api/stripe/webhooks/")


class CookieAuthCSRFMiddleware(MiddlewareMixin):
    def process_view(self, request, view_func, view_args, view_kwargs):
        if not getattr(settings, "ENFORCE_CSRF_COOKIE_AUTH", False):
            return None
        path = request.path or ""
        if path.startswith(EXEMPT_PATHS):
            return None
        if request.method in ("GET", "HEAD", "OPTIONS", "TRACE"):
            return None
        # Only enforce when authenticated via the HttpOnly cookie (not a bearer
        # header and not session/force_authenticated).
        if request.COOKIES.get(settings.AUTH_ACCESS_COOKIE) and not request.META.get(
            "HTTP_AUTHORIZATION"
        ):
            csrf_token = request.META.get("HTTP_X_CSRFTOKEN", "")
            cookie_token = request.COOKIES.get("csrftoken", "")
            if not csrf_token or not cookie_token or csrf_token != cookie_token:
                from rest_framework.exceptions import PermissionDenied

                raise PermissionDenied("CSRF token is missing or incorrect.")
        return None
