import logging

from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from commerce.models import StoreConfiguration

from .faq import (
    DEFAULT_SUGGESTIONS,
    ORDER_SUGGESTIONS,
    build_system_prompt,
    match_faq,
    support_email,
)
from .order_helpers import anonymous_order_reply, looks_like_order_question, order_reply
from .providers import AIProviderError, ai_configured, generate_reply
from .serializers import ChatRequestSerializer
from .throttles import AssistantChatThrottle

logger = logging.getLogger(__name__)


class AssistantChatView(APIView):
    """Public chat endpoint backed by a grounded FAQ or a configured AI provider.

    Order questions are answered deterministically from the signed-in user's
    own orders. AI providers never receive private order data.
    """

    permission_classes = [AllowAny]
    throttle_classes = [AssistantChatThrottle]

    def post(self, request):
        serializer = ChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = serializer.validated_data["message"]
        history = serializer.validated_data.get("history", [])
        authenticated = bool(request.user and request.user.is_authenticated)
        config = StoreConfiguration.get_solo()

        if looks_like_order_question(message):
            if authenticated:
                reply, action = order_reply(request.user, message)
            else:
                reply, action = anonymous_order_reply()
            return Response(
                self._payload(reply, "order", "order", authenticated, action, ORDER_SUGGESTIONS)
            )

        faq = match_faq(message, config=config)
        if ai_configured():
            try:
                reply = generate_reply(message, history, build_system_prompt(config))
                return Response(
                    self._payload(
                        reply,
                        "ai",
                        faq["id"] if faq else "general",
                        authenticated,
                        self._faq_action(faq, authenticated),
                        DEFAULT_SUGGESTIONS,
                    )
                )
            except AIProviderError:
                logger.warning("Assistant AI provider unavailable; using grounded FAQ fallback.")

        if faq:
            return Response(
                self._payload(
                    faq["answer"],
                    "faq",
                    faq["id"],
                    authenticated,
                    self._faq_action(faq, authenticated),
                    DEFAULT_SUGGESTIONS,
                )
            )

        return Response(
            self._payload(
                self._unknown_reply(),
                "faq",
                "unknown",
                authenticated,
                {"label": "Visit help center", "href": "/support"},
                DEFAULT_SUGGESTIONS,
            )
        )

    @staticmethod
    def _payload(reply, mode, intent, authenticated, action, suggestions):
        return {
            "reply": reply,
            "mode": mode,
            "intent": intent,
            "authenticated": authenticated,
            "action": action,
            "suggestions": list(suggestions),
        }

    @staticmethod
    def _faq_action(faq, authenticated):
        if not faq:
            return None
        actions = {
            "account": ("Open account", "/account") if authenticated else ("Sign in", "/login"),
            "products": ("Shop products", "/shop"),
            "templates": ("Browse templates", "/templates"),
            "returns": ("Read return policy", "/policies/returns"),
            "shipping": ("Shipping policy", "/policies/shipping"),
            "payments": ("Go to checkout", "/checkout"),
            "contact": ("Contact support", f"mailto:{support_email()}"),
        }
        label, href = actions.get(faq["id"], ("", ""))
        return {"label": label, "href": href} if label else None

    @staticmethod
    def _unknown_reply():
        return (
            "I don't have a verified answer for that yet. I can help with products, "
            "the design studio, shipping, returns, accounts, payments and order "
            f"questions. For anything else, email {support_email()} and the team will help."
        )
