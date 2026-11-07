"""Validation for customer-supplied design JSON.

The design JSON is a Fabric.js canvas document (or a mapping of stage IDs to
Fabric canvases). It is stored as JSON and later rendered by the export engine,
so every nested value must be treated as untrusted.
"""
import json
import re
import uuid
from urllib.parse import urlparse

from django.conf import settings

MAX_OBJECTS = 500
MAX_JSON_BYTES = 2_000_000
ALLOWED_TYPES = {
    "rect", "circle", "triangle", "line", "polygon", "path", "group",
    "text", "i-text", "textbox", "image", "activeSelection",
}
MEDIA_PREFIX = "/media/"


class DesignValidationError(ValueError):
    pass


def _is_uuid(value):
    try:
        uuid.UUID(str(value))
        return True
    except (ValueError, AttributeError, TypeError):
        return False


def _number(value, field, minimum=-50000, maximum=50000, allow_none=False):
    if value is None and allow_none:
        return
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise DesignValidationError(f"{field} must be a number.")
    if value < minimum or value > maximum:
        raise DesignValidationError(f"{field} is out of range.")


def _string(value, field, max_length=2000):
    if not isinstance(value, str):
        raise DesignValidationError(f"{field} must be a string.")
    if len(value) > max_length:
        raise DesignValidationError(f"{field} is too long.")


def _normalize_host(value):
    return value.strip().lower()


def _add_allowed_host(host_or_url, hosts):
    if not host_or_url:
        return
    raw = host_or_url.strip()
    if not raw or raw == "*":
        return
    if "://" not in raw:
        raw = f"http://{raw}"
    try:
        parsed = urlparse(raw)
        netloc = _normalize_host(parsed.netloc)
        if netloc:
            hosts.add(netloc)
            hosts.add(netloc.split(":")[0])
    except ValueError:
        pass


def _allowed_image_hosts():
    hosts = set()
    _add_allowed_host(settings.BACKEND_URL, hosts)
    _add_allowed_host(settings.SITE_URL, hosts)
    for origin in getattr(settings, "CORS_ALLOWED_ORIGINS", []):
        _add_allowed_host(origin, hosts)
    for host in getattr(settings, "ALLOWED_HOSTS", []):
        _add_allowed_host(host, hosts)
    for host in getattr(settings, "ALLOWED_IMAGE_HOSTS", []):
        _add_allowed_host(host, hosts)
    hosts.update(
        {
            "localhost",
            "localhost:8000",
            "localhost:3000",
            "127.0.0.1",
            "127.0.0.1:8000",
            "127.0.0.1:3000",
            "backend",
            "backend:8000",
            "backend:3000",
        }
    )
    return hosts


def _validate_image_src(src):
    if not isinstance(src, str) or not src:
        raise DesignValidationError("Image objects must include a source URL.")
    if src.startswith("data:"):
        raise DesignValidationError("Inline data URLs are not accepted; upload the image first.")
    media_prefix = getattr(settings, "MEDIA_URL", "/media/")
    if not media_prefix.startswith("/"):
        media_prefix = f"/{media_prefix}"
    if not media_prefix.endswith("/"):
        media_prefix = f"{media_prefix}/"
    if src.startswith(media_prefix):
        return
    parsed = urlparse(src)
    if not parsed.scheme and parsed.path.startswith(media_prefix):
        return
    allowed_hosts = _allowed_image_hosts()
    netloc = _normalize_host(parsed.netloc)
    netloc_host = netloc.split(":")[0] if netloc else ""
    if parsed.scheme not in ("http", "https") or not netloc:
        raise DesignValidationError("Images must reference an uploaded Printora asset.")
    if netloc not in allowed_hosts and netloc_host not in allowed_hosts:
        raise DesignValidationError("Images must reference an uploaded Printora asset.")
    if not parsed.path.startswith(media_prefix) and "/media/" not in parsed.path:
        raise DesignValidationError("Images must reference an uploaded Printora asset.")


def validate_canvas(canvas, *, allow_stage_map=True):
    if not isinstance(canvas, dict):
        raise DesignValidationError("Canvas data must be an object.")
    if allow_stage_map and "stages" in canvas:
        stages = canvas["stages"]
        if not isinstance(stages, dict) or not stages:
            raise DesignValidationError("Stages must be a non-empty object.")
        if len(stages) > 20:
            raise DesignValidationError("Too many stages in one design.")
        for stage_id, stage_canvas in stages.items():
            if not _is_uuid(stage_id):
                raise DesignValidationError("Stage keys must be valid IDs.")
            validate_canvas(stage_canvas, allow_stage_map=False)
        return canvas
    if "width" not in canvas or "height" not in canvas:
        raise DesignValidationError("Canvas must include width and height.")
    _number(canvas.get("width"), "canvas.width", 1, 20000)
    _number(canvas.get("height"), "canvas.height", 1, 20000)

    objects = canvas.get("objects", [])
    if not isinstance(objects, list):
        raise DesignValidationError("Canvas objects must be a list.")
    if len(objects) > MAX_OBJECTS:
        raise DesignValidationError(f"A design may contain at most {MAX_OBJECTS} objects.")

    for index, obj in enumerate(objects):
        if not isinstance(obj, dict):
            raise DesignValidationError(f"Object {index} must be an object.")
        obj_type = obj.get("type")
        if obj_type not in ALLOWED_TYPES:
            raise DesignValidationError(f"Unsupported object type: {obj_type!r}.")
        for field in ("left", "top", "width", "height", "scaleX", "scaleY", "angle", "opacity"):
            if field in obj and obj[field] is not None:
                if field == "opacity":
                    _number(obj[field], f"objects[{index}].{field}", 0, 1)
                else:
                    _number(obj[field], f"objects[{index}].{field}")
        if "text" in obj:
            _string(obj["text"], f"objects[{index}].text", 2000)
        if "fontFamily" in obj:
            _string(obj["fontFamily"], f"objects[{index}].fontFamily", 120)
        for color_field in ("fill", "stroke"):
            value = obj.get(color_field)
            if value is not None:
                _string(value, f"objects[{index}].{color_field}", 60)
        if "src" in obj:
            _validate_image_src(obj["src"])
        if obj_type == "group" and "objects" in obj:
            group_objects = obj["objects"]
            if not isinstance(group_objects, list) or len(group_objects) > MAX_OBJECTS:
                raise DesignValidationError(f"objects[{index}] has an invalid group.")
            for child in group_objects:
                if not isinstance(child, dict) or child.get("type") not in ALLOWED_TYPES:
                    raise DesignValidationError(f"objects[{index}] contains an unsupported child object.")

    return canvas


def validate_design_payload(payload, stage_key=None):
    """Validate a design payload. Returns normalized payload with stage map."""
    if not isinstance(payload, dict):
        raise DesignValidationError("Design data must be an object.")
    try:
        encoded = json.dumps(payload)
    except (TypeError, ValueError) as exc:
        raise DesignValidationError("Design data is not valid JSON.") from exc
    if len(encoded.encode("utf-8")) > MAX_JSON_BYTES:
        raise DesignValidationError("Design data exceeds the 2 MB limit.")

    if "stages" in payload:
        validate_canvas(payload)
        return payload

    validate_canvas(payload, allow_stage_map=False)
    stage_key = str(payload.get("stageId") or payload.get("stage_id") or stage_key or uuid.uuid4())
    payload = dict(payload)
    payload.pop("stageId", None)
    payload.pop("stage_id", None)
    return {"stages": {stage_key: payload}, "activeStage": stage_key}


def extract_stage_canvas(canvas_json, stage_id=None):
    if not isinstance(canvas_json, dict):
        return {}
    stages = canvas_json.get("stages")
    if isinstance(stages, dict):
        if stage_id and str(stage_id) in stages:
            return stages[str(stage_id)]
        if canvas_json.get("activeStage") and str(canvas_json["activeStage"]) in stages:
            return stages[str(canvas_json["activeStage"])]
        if stages:
            return next(iter(stages.values()))
        return {}
    return canvas_json
