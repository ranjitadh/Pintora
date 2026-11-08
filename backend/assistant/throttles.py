"""Rate limits for public assistant and newsletter endpoints."""
from rest_framework.settings import api_settings
from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle


class AssistantChatThrottle(SimpleRateThrottle):
    """Per-user limit for signed-in visitors and per-IP limit otherwise."""

    scope = "assistant"

    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            ident = f"user:{request.user.pk}"
        else:
            ident = f"ip:{self.get_ident(request)}"
        return self.cache_format % {"scope": self.scope, "ident": ident}

    def allow_request(self, request, view):
        rates = api_settings.DEFAULT_THROTTLE_RATES
        fallback = rates.get("assistant", "20/min")
        if request.user and request.user.is_authenticated:
            self.rate = rates.get("assistant_user") or fallback
        else:
            self.rate = rates.get("assistant_anon") or fallback
        self.num_requests, self.duration = self.parse_rate(self.rate)
        return super().allow_request(request, view)


class NewsletterThrottle(AnonRateThrottle):
    scope = "newsletter"
