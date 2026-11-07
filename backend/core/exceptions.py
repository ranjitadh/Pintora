import logging

from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        logger.exception("Unhandled API exception", exc_info=exc)
        return None

    detail = response.data
    message = ""
    if isinstance(detail, dict):
        if "detail" in detail:
            message = str(detail["detail"])
        else:
            first_key = next(iter(detail))
            first_value = detail[first_key]
            if isinstance(first_value, (list, tuple)) and first_value:
                message = f"{first_key}: {first_value[0]}"
            else:
                message = f"{first_key}: {first_value}"
    elif isinstance(detail, (list, tuple)):
        message = str(detail[0]) if detail else "Request failed."
    else:
        message = str(detail)

    response.data = {
        "detail": message or "Request failed.",
        "code": getattr(exc, "default_code", "error"),
        "status": response.status_code,
        "errors": detail if isinstance(detail, (dict, list)) else {},
    }
    return response
