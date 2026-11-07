import io
import re
import xml.etree.ElementTree as ET

from django.conf import settings
from PIL import Image

MAX_DIMENSION = 12000
MAX_PIXELS = 40_000_000
RASTER_FORMATS = {"PNG", "JPEG", "WEBP"}
SVG_FORBIDDEN_TAGS = {"script", "foreignObject", "iframe", "object", "embed", "audio", "video"}
ET.register_namespace("", "http://www.w3.org/2000/svg")
ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")
SVG_EVENT_ATTR = re.compile(r"^on[a-z]+$", re.IGNORECASE)
SVG_BAD_VALUE = re.compile(r"javascript\s*:|vbscript\s*:|data:text/html", re.IGNORECASE)


class UploadValidationError(ValueError):
    pass


def validate_upload(upload):
    """Validate an uploaded raster image. Returns (mime, width, height, format)."""
    if upload.size > settings.MAX_UPLOAD_BYTES:
        limit_mb = settings.MAX_UPLOAD_BYTES // (1024 * 1024)
        raise UploadValidationError(f"File is too large. Maximum size is {limit_mb} MB.")
    try:
        data = upload.read()
        upload.seek(0)
        image = Image.open(io.BytesIO(data))
        image.verify()
        upload.seek(0)
        image = Image.open(io.BytesIO(data))
        width, height = image.size
        image_format = (image.format or "").upper()
    except Exception as exc:
        raise UploadValidationError("The file is not a valid image.") from exc
    if image_format not in RASTER_FORMATS:
        raise UploadValidationError("Only PNG, JPEG, WebP, and SVG files are supported.")
    if width > MAX_DIMENSION or height > MAX_DIMENSION:
        raise UploadValidationError(f"Images may be at most {MAX_DIMENSION}px on a side.")
    if width * height > MAX_PIXELS:
        raise UploadValidationError("Image resolution is too large.")
    mime = {"PNG": "image/png", "JPEG": "image/jpeg", "WEBP": "image/webp"}[image_format]
    return mime, width, height, image_format.lower()


def sanitize_svg(raw: bytes) -> bytes:
    if len(raw) > settings.MAX_UPLOAD_BYTES:
        raise UploadValidationError("SVG file is too large.")
    text = raw.decode("utf-8", errors="strict") if raw else ""
    lowered = text.lower()
    if "<!doctype" in lowered or "<!entity" in lowered:
        raise UploadValidationError("SVG documents with DTD or entities are not allowed.")
    try:
        root = ET.fromstring(text)
    except ET.ParseError as exc:
        raise UploadValidationError("The SVG could not be parsed.") from exc

    def clean(element):
        tag = element.tag.split("}")[-1]
        if tag in SVG_FORBIDDEN_TAGS:
            return False
        for attr in list(element.attrib):
            local = attr.split("}")[-1]
            if SVG_EVENT_ATTR.match(local):
                del element.attrib[attr]
            elif SVG_BAD_VALUE.search(element.attrib[attr] or ""):
                del element.attrib[attr]
        for child in list(element):
            if not clean(child):
                element.remove(child)
        return True

    clean(root)
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def svg_dimensions(raw: bytes):
    try:
        root = ET.fromstring(raw)
        width = root.attrib.get("width", "1000")
        height = root.attrib.get("height", "1000")
        width = int(float(re.sub(r"[^0-9.]", "", width) or 1000))
        height = int(float(re.sub(r"[^0-9.]", "", height) or 1000))
        return max(1, width), max(1, height)
    except Exception:
        return 1000, 1000
