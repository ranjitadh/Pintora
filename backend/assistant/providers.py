"""Provider-agnostic AI client for the Printora Assistant.

Only the backend ever sees ``AI_API_KEY``. Requests are made with the
already-installed ``requests`` package so no extra dependency is required.
Supported providers:

- ``openai``: any OpenAI-compatible ``/chat/completions`` endpoint.
- ``anthropic``: the Messages API.

Configure via ``AI_PROVIDER``, ``AI_API_KEY``, ``AI_MODEL`` and optionally
``AI_BASE_URL``, ``AI_TIMEOUT_SECONDS`` and ``AI_MAX_TOKENS``.
"""
import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

SUPPORTED_PROVIDERS = ("openai", "anthropic")


class AIProviderError(Exception):
    """Raised when live AI generation is unavailable. Never includes secrets."""


def provider_name():
    return (getattr(settings, "AI_PROVIDER", "") or "").strip().lower()


def ai_configured():
    return provider_name() in SUPPORTED_PROVIDERS and bool(
        (getattr(settings, "AI_API_KEY", "") or "").strip()
    )


def _timeout():
    try:
        timeout = float(getattr(settings, "AI_TIMEOUT_SECONDS", 20))
    except (TypeError, ValueError):
        timeout = 20.0
    return min(max(timeout, 3.0), 60.0)


def _max_tokens():
    try:
        value = int(getattr(settings, "AI_MAX_TOKENS", 400))
    except (TypeError, ValueError):
        value = 400
    return min(max(value, 64), 2000)


def _model(provider):
    configured = (getattr(settings, "AI_MODEL", "") or "").strip()
    if configured:
        return configured
    if provider == "anthropic":
        return "claude-3-5-haiku-latest"
    return "gpt-4o-mini"


def _base_url(provider):
    configured = (getattr(settings, "AI_BASE_URL", "") or "").strip()
    if configured:
        base = configured.rstrip("/")
    elif provider == "anthropic":
        base = "https://api.anthropic.com"
    else:
        base = "https://api.openai.com/v1"
    if not base.startswith(("https://", "http://")):
        raise AIProviderError("The AI provider URL is invalid.")
    return base


def _endpoint(provider):
    base = _base_url(provider)
    if provider == "anthropic":
        if base.endswith("/v1"):
            return f"{base}/messages"
        return f"{base}/v1/messages"
    return f"{base}/chat/completions"


def _conversation(history, message):
    turns = []
    for turn in (history or [])[-8:]:
        role = turn.get("role")
        content = str(turn.get("content", "")).strip()
        if role in ("user", "assistant") and content:
            turns.append({"role": role, "content": content[:1200]})
    turns.append({"role": "user", "content": message})
    return turns


def _post(url, headers, payload):
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=_timeout())
    except requests.RequestException as exc:
        logger.warning("AI provider request failed (%s)", exc.__class__.__name__)
        raise AIProviderError("The live assistant is unavailable.") from exc

    if response.status_code >= 400:
        logger.warning("AI provider returned HTTP %s", response.status_code)
        raise AIProviderError("The live assistant is unavailable.")

    try:
        return response.json()
    except ValueError as exc:
        logger.warning("AI provider returned invalid JSON")
        raise AIProviderError("The live assistant is unavailable.") from exc


def _extract_openai(data):
    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise AIProviderError("The live assistant returned an unexpected response.") from exc
    if not isinstance(content, str) or not content.strip():
        raise AIProviderError("The live assistant returned an empty response.")
    return content.strip()


def _extract_anthropic(data):
    content = data.get("content") if isinstance(data, dict) else None
    if not isinstance(content, list):
        raise AIProviderError("The live assistant returned an unexpected response.")
    parts = [
        block.get("text", "")
        for block in content
        if isinstance(block, dict) and block.get("type") == "text"
    ]
    text = "\n".join(part for part in parts if part).strip()
    if not text:
        raise AIProviderError("The live assistant returned an empty response.")
    return text


def generate_reply(message, history, system_prompt):
    """Generate a grounded reply from the configured provider.

    Raises :class:`AIProviderError` on any failure so callers can fall back to
    the local FAQ knowledge base.
    """
    provider = provider_name()
    if not ai_configured():
        raise AIProviderError("No AI provider is configured.")

    api_key = (getattr(settings, "AI_API_KEY", "") or "").strip()
    conversation = _conversation(history, message)

    if provider == "openai":
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": _model(provider),
            "messages": [{"role": "system", "content": system_prompt}] + conversation,
            "temperature": 0.2,
            "max_tokens": _max_tokens(),
        }
        return _extract_openai(_post(_endpoint(provider), headers, payload))

    if provider == "anthropic":
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
        payload = {
            "model": _model(provider),
            "system": system_prompt,
            "messages": conversation,
            "temperature": 0.2,
            "max_tokens": _max_tokens(),
        }
        return _extract_anthropic(_post(_endpoint(provider), headers, payload))

    raise AIProviderError("No supported AI provider is configured.")
