"""Authentication that reads JWTs from HttpOnly cookies when no bearer header
is present. Complements the existing header-based JWT flow so browsers can
store credentials only in cookies (never in JavaScript-accessible storage)."""
from django.conf import settings

from rest_framework_simplejwt.authentication import JWTAuthentication


class AuthCookieAuthentication(JWTAuthentication):
    """Authenticate via the ``printora_access`` HttpOnly cookie.

    Falls back to the standard ``Authorization: Bearer`` header flow, so
    existing clients (and DRF's test ``force_authenticate``) keep working.
    """

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is not None:
            return result

        raw_token = request.COOKIES.get(settings.AUTH_ACCESS_COOKIE)
        if not raw_token:
            return None
        try:
            validated_token = self.get_validated_token(raw_token)
        except Exception:
            return None
        return self.get_user(validated_token), validated_token
