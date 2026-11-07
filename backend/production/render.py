"""Raster/vector rendering of Fabric.js design documents.

The renderer is intentionally server-side and independent from the editor:
the same structured JSON can be previewed, exported at production DPI, and
re-rendered after a design is restored from history.
"""
from __future__ import annotations

import base64
import io
import math
import os
import warnings
from pathlib import Path
from urllib.parse import unquote, urlparse

from django.conf import settings
from PIL import Image, ImageColor, ImageDraw, ImageFont

FONT_DIR = Path(settings.BASE_DIR) / "assets" / "fonts"
FONT_FILES = {
    "sans": FONT_DIR / "Inter.ttf",
    "sans_italic": FONT_DIR / "Inter-Italic.ttf",
    "serif": FONT_DIR / "Lora.ttf",
    "mono": FONT_DIR / "SpaceMono-Regular.ttf",
    "mono_bold": FONT_DIR / "SpaceMono-Bold.ttf",
}

_FONT_CACHE: dict[tuple, ImageFont.FreeTypeFont] = {}


class RenderError(RuntimeError):
    pass


def _font(family: str, bold: bool, italic: bool, size: int) -> ImageFont.FreeTypeFont:
    size = max(1, int(round(size)))
    key = (family or "", bool(bold), bool(italic), size)
    if key in _FONT_CACHE:
        return _FONT_CACHE[key]

    lowered = (family or "").lower()
    if any(token in lowered for token in ("serif", "lora", "georgia", "times", "playfair", "fraunces")):
        path = FONT_FILES["serif"]
    elif any(token in lowered for token in ("mono", "courier", "space")):
        path = FONT_FILES["mono_bold"] if bold else FONT_FILES["mono"]
    else:
        path = FONT_FILES["sans_italic"] if italic and not bold else FONT_FILES["sans"]

    try:
        font = ImageFont.truetype(str(path), size)
    except OSError as exc:
        raise RenderError(f"Font file missing: {path}") from exc

    try:
        if bold and path.name in ("Inter.ttf", "Inter-Italic.ttf", "Lora.ttf"):
            font.set_variation_by_name("Bold")
    except (OSError, ValueError):
        pass
    _FONT_CACHE[key] = font
    return font


def _color(value, default=None):
    if not value or not isinstance(value, str):
        return default
    value = value.strip()
    if value in ("transparent", "none"):
        return None
    try:
        if value.startswith("rgb"):
            numbers = value[value.find("(") + 1 : value.find(")")].split(",")
            rgb = [int(float(n.strip())) for n in numbers[:3]]
            alpha = int(float(numbers[3].strip()) * 255) if len(numbers) > 3 else 255
            return (*rgb, alpha)
        rgb = ImageColor.getrgb(value)
        return (*rgb[:3], 255)
    except (ValueError, IndexError):
        return default


def _media_root() -> Path:
    return Path(settings.MEDIA_ROOT)


def _media_path(src: str):
    if not isinstance(src, str):
        return None
    parsed = urlparse(src)
    path = unquote(parsed.path)
    marker = "/media/"
    if marker not in path:
        return None
    relative = path.split(marker, 1)[1]
    root = _media_root().resolve()
    candidate = (root / relative).resolve()
    try:
        candidate.relative_to(root)
    except ValueError:
        return None
    return candidate if candidate.exists() else None


def _load_image(src: str):
    path = _media_path(src)
    if not path:
        return None
    try:
        image = Image.open(path)
        image.load()
        return image.convert("RGBA")
    except (OSError, ValueError):
        return None


def _num(value, default=0.0):
    try:
        if value is None or isinstance(value, bool):
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _origin_offset(obj):
    origin_x = obj.get("originX", "left")
    origin_y = obj.get("originY", "top")
    w = _num(obj.get("width"))
    h = _num(obj.get("height"))
    dx = w / 2 if origin_x == "center" else (w if origin_x == "right" else 0)
    dy = h / 2 if origin_y == "center" else (h if origin_y == "bottom" else 0)
    return dx, dy


def _text_metrics(obj, font, line_height):
    text = str(obj.get("text", ""))
    letter_spacing = _num(obj.get("letterSpacing"))
    lines = text.split("\n") or [""]
    widths = []
    for line in lines:
        if letter_spacing:
            width = sum(font.getlength(ch) for ch in line) + max(0, len(line) - 1) * letter_spacing
        else:
            width = font.getlength(line)
        widths.append(width)
    max_width = max(widths) if widths else 1
    height = max(font.getbbox("Ag")[3] - font.getbbox("Ag")[1], font.size) * line_height * len(lines)
    return lines, max_width, height


def _draw_text_layer(obj, scale, max_wrap_width=None):
    font_size = max(1, _num(obj.get("fontSize"), 24) * scale)
    family = obj.get("fontFamily", "Inter")
    bold = str(obj.get("fontWeight", "")).lower() in ("bold", "600", "700", "800", "900")
    italic = str(obj.get("fontStyle", "")).lower() == "italic"
    font = _font(family, bold, italic, font_size)
    line_height = max(0.5, _num(obj.get("lineHeight"), 1.16))
    letter_spacing = _num(obj.get("letterSpacing")) * scale
    fill = _color(obj.get("fill"), (20, 20, 20, 255)) or (20, 20, 20, 255)
    text = str(obj.get("text", ""))
    align = obj.get("textAlign", "left")

    if obj.get("type") == "textbox":
        target_width = _num(obj.get("width")) * abs(_num(obj.get("scaleX"), 1)) * scale
        max_wrap_width = max(10, target_width) if target_width else max_wrap_width
    else:
        max_wrap_width = None

    raw_lines = text.split("\n") or [""]
    lines = []
    for raw in raw_lines:
        if max_wrap_width and font.getlength(raw) > max_wrap_width:
            words = raw.split(" ")
            current = ""
            for word in words:
                trial = f"{current} {word}".strip()
                if font.getlength(trial) <= max_wrap_width or not current:
                    current = trial
                else:
                    lines.append(current)
                    current = word
            lines.append(current)
        else:
            lines.append(raw)
    if not lines:
        lines = [""]

    def line_width(line):
        if letter_spacing:
            return sum(font.getlength(ch) for ch in line) + max(0, len(line) - 1) * letter_spacing
        return font.getlength(line)

    text_width = max((line_width(line) for line in lines), default=1)
    ascent, descent = font.getmetrics()
    text_height = (ascent + descent) * line_height * len(lines)
    pad = max(4, int(font_size * 0.25))
    layer_w = max(1, int(math.ceil(text_width + pad * 2)))
    layer_h = max(1, int(math.ceil(text_height + pad * 2)))
    layer = Image.new("RGBA", (layer_w, layer_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    baseline_y = pad + ascent
    for index, line in enumerate(lines):
        width = line_width(line)
        if align == "center":
            x = pad + (text_width - width) / 2
        elif align == "right":
            x = pad + (text_width - width)
        else:
            x = pad
        y = baseline_y + index * (ascent + descent) * line_height
        if letter_spacing:
            cursor = x
            for ch in line:
                draw.text((cursor, y), ch, font=font, fill=fill, anchor="ls")
                cursor += font.getlength(ch) + letter_spacing
        else:
            draw.text((x, y), line, font=font, fill=fill, anchor="ls")
    if obj.get("underline"):
        underline_y = pad + text_height
        draw.line([(pad, underline_y), (pad + text_width, underline_y)], fill=fill, width=max(1, int(scale)))
    return layer, text_width, text_height


def _apply_rotation(layer: Image.Image, angle: float) -> Image.Image:
    if not angle:
        return layer
    return layer.rotate(-angle, expand=True, resample=Image.BICUBIC)


def _render_object(canvas: Image.Image, obj: dict, scale: float, warnings_list: list):
    obj_type = obj.get("type")
    if obj_type == "activeselection":
        return
    if obj_type == "group":
        for child in obj.get("objects", []):
            if isinstance(child, dict):
                merged = dict(child)
                merged["left"] = _num(child.get("left")) + _num(obj.get("left"))
                merged["top"] = _num(child.get("top")) + _num(obj.get("top"))
                _render_object(canvas, merged, scale, warnings_list)
        return

    opacity = max(0.0, min(1.0, _num(obj.get("opacity"), 1)))
    angle = _num(obj.get("angle"))
    scale_x = abs(_num(obj.get("scaleX"), 1))
    scale_y = abs(_num(obj.get("scaleY"), 1))

    if obj_type in ("text", "i-text", "textbox"):
        layer, text_w, text_h = _draw_text_layer(obj, scale)
        bbox_w, bbox_h = text_w, text_h
        if opacity < 1:
            alpha = layer.getchannel("A").point(lambda p: int(p * opacity))
            layer.putalpha(alpha)
        layer = _apply_rotation(layer, angle)
        cx = _num(obj.get("left")) * scale
        cy = _num(obj.get("top")) * scale
        canvas.alpha_composite(layer, (int(cx - layer.width / 2), int(cy - layer.height / 2)))
        return

    width = _num(obj.get("width")) * scale_x * scale
    height = _num(obj.get("height")) * scale_y * scale

    if obj_type == "image":
        image = _load_image(obj.get("src", ""))
        if image is None:
            warnings_list.append(f"Image could not be loaded: {obj.get('src', '')[:120]}")
            return
        target_w = max(1, int(round(width)))
        target_h = max(1, int(round(height)))
        if target_w * target_h > 40_000_000:
            warnings_list.append("Image placement is unusually large and was skipped.")
            return
        resized = image.resize((target_w, target_h), Image.LANCZOS)
        if opacity < 1:
            alpha = resized.getchannel("A").point(lambda p: int(p * opacity))
            resized.putalpha(alpha)
        rotated = _apply_rotation(resized, angle)
        cx = _num(obj.get("left")) * scale
        cy = _num(obj.get("top")) * scale
        canvas.alpha_composite(rotated, (int(cx - rotated.width / 2), int(cy - rotated.height / 2)))
        return

    if obj_type in ("rect", "triangle", "circle", "polygon", "line"):
        pad = max(4, int(max(width, height) * 0.06))
        layer_size = (max(1, int(width) + pad * 2), max(1, int(height) + pad * 2))
        layer = Image.new("RGBA", layer_size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(layer)
        fill = _color(obj.get("fill"), None)
        stroke = _color(obj.get("stroke"), None)
        stroke_width = max(0, _num(obj.get("strokeWidth")) * scale)
        offset = pad
        if obj_type == "rect":
            radius = _num(obj.get("rx")) * scale
            draw.rounded_rectangle(
                [offset, offset, offset + max(1, width), offset + max(1, height)],
                radius=max(0, radius),
                fill=fill,
                outline=stroke,
                width=max(1, int(stroke_width)) if stroke else 0,
            )
        elif obj_type == "circle":
            draw.ellipse(
                [offset, offset, offset + max(1, width), offset + max(1, height)],
                fill=fill,
                outline=stroke,
                width=max(1, int(stroke_width)) if stroke else 0,
            )
        elif obj_type == "triangle":
            draw.polygon(
                [(offset + width / 2, offset), (offset + width, offset + height), (offset, offset + height)],
                fill=fill,
                outline=stroke,
            )
        elif obj_type == "line":
            x1 = _num(obj.get("x1")) * scale + offset
            y1 = _num(obj.get("y1")) * scale + offset
            x2 = _num(obj.get("x2")) * scale + offset
            y2 = _num(obj.get("y2")) * scale + offset
            draw.line([(x1, y1), (x2, y2)], fill=stroke or fill or (0, 0, 0, 255), width=max(1, int(stroke_width or 2)))
        else:
            points = []
            for point in obj.get("points", []):
                points.append((offset + _num(point.get("x")) * scale, offset + _num(point.get("y")) * scale))
            if len(points) >= 3:
                draw.polygon(points, fill=fill, outline=stroke)
        if opacity < 1:
            alpha = layer.getchannel("A").point(lambda p: int(p * opacity))
            layer.putalpha(alpha)
        rotated = _apply_rotation(layer, angle)
        cx = _num(obj.get("left")) * scale
        cy = _num(obj.get("top")) * scale
        canvas.alpha_composite(rotated, (int(cx - rotated.width / 2), int(cy - rotated.height / 2)))
        return

    if obj_type == "path":
        warnings_list.append("Vector path objects are preserved in SVG exports but skipped in PNG rendering.")


def render_canvas(canvas_json: dict, target_width: int, target_height: int | None = None,
                  background=(0, 0, 0, 0)):
    if not isinstance(canvas_json, dict):
        raise RenderError("Canvas JSON is invalid.")
    design_width = max(1.0, _num(canvas_json.get("width"), 1000))
    design_height = max(1.0, _num(canvas_json.get("height"), 1000))
    target_width = max(1, int(target_width))
    if target_height is None:
        target_height = max(1, int(round(target_width * design_height / design_width)))

    scale = target_width / design_width
    options = list(canvas_json.get("objects", []))
    background_color = _color(canvas_json.get("backgroundColor"))
    if background_color is None:
        background_color = background
    image = Image.new("RGBA", (target_width, max(1, int(target_height))), background_color or (0, 0, 0, 0))
    warnings_list: list[str] = []
    for obj in options:
        if isinstance(obj, dict):
            try:
                _render_object(image, obj, scale, warnings_list)
            except Exception as exc:  # keep rendering remaining objects
                warnings_list.append(f"Skipped object ({obj.get('type')}): {exc}")
    return image, warnings_list


def _resolve_stage_canvas(design_or_canvas, stage=None):
    from designer.validation import extract_stage_canvas

    if isinstance(design_or_canvas, dict):
        return extract_stage_canvas(design_or_canvas, str(stage.id) if stage else None)
    return extract_stage_canvas(design_or_canvas.canvas_json, str(stage.id) if stage else None)


def render_design(design, stage=None, width: int = 600, dpi: int | None = None):
    stage = stage or design.stage
    if stage is None or stage.print_area is None:
        raise RenderError("This design has no printable stage configured.")
    canvas_json = _resolve_stage_canvas(design, stage)
    if not canvas_json:
        raise RenderError("No artwork found for this stage.")
    if dpi:
        target_width = round(float(stage.print_area.width_mm) / 25.4 * dpi)
        target_height = round(float(stage.print_area.height_mm) / 25.4 * dpi)
    else:
        target_width = width
        target_height = round(width * float(stage.print_area.height_mm) / float(stage.print_area.width_mm))
    return render_canvas(canvas_json, target_width, target_height)


def render_preview_bytes(design, stage=None, width=640) -> tuple[bytes, list[str]]:
    image, warnings_list = render_design(design, stage=stage, width=width)
    output = io.BytesIO()
    image.save(output, format="PNG", optimize=True)
    return output.getvalue(), warnings_list


def _validate_resolution(design, stage, canvas_json, dpi):
    warnings_list = []
    canvas_width = max(1.0, _num(canvas_json.get("width"), 1))
    export_width = round(float(stage.print_area.width_mm) / 25.4 * dpi)
    factor = export_width / canvas_width
    for obj in canvas_json.get("objects", []):
        if not isinstance(obj, dict) or obj.get("type") != "image":
            continue
        image = _load_image(obj.get("src", ""))
        if image is None:
            continue
        placed_width = _num(obj.get("width")) * abs(_num(obj.get("scaleX"), 1)) * factor
        if image.width < placed_width * 0.8:
            warnings_list.append(
                f"Low resolution image: {image.width}px source for approximately "
                f"{round(placed_width)}px at {dpi} DPI."
            )
    return warnings_list


def export_png(design, stage, dpi=300) -> tuple[bytes, int, int, list[str]]:
    canvas_json = _resolve_stage_canvas(design, stage)
    if not canvas_json:
        raise RenderError("No artwork found for this stage.")
    width_px = round(float(stage.print_area.width_mm) / 25.4 * dpi)
    height_px = round(float(stage.print_area.height_mm) / 25.4 * dpi)
    image, warnings_list = render_canvas(canvas_json, width_px, height_px)
    warnings_list.extend(_validate_resolution(design, stage, canvas_json, dpi))
    output = io.BytesIO()
    image.save(output, format="PNG", dpi=(dpi, dpi), optimize=True)
    return output.getvalue(), width_px, height_px, warnings_list


def _svg_escape(value):
    from xml.sax.saxutils import escape

    return escape(str(value), {'"': "&quot;"})


def _svg_fill(value, default="none"):
    if isinstance(value, str) and value and value not in ("transparent", "none"):
        return value
    return default


def _svg_image_href(src):
    path = _media_path(src)
    if not path:
        return None
    mime = "image/png"
    suffix = path.suffix.lower()
    if suffix in (".jpg", ".jpeg"):
        mime = "image/jpeg"
    elif suffix == ".svg":
        mime = "image/svg+xml"
    elif suffix == ".webp":
        mime = "image/webp"
    data = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{data}"


def _svg_object(obj) -> str:
    obj_type = obj.get("type")
    if obj_type == "activeselection":
        return ""
    left = _num(obj.get("left"))
    top = _num(obj.get("top"))
    angle = _num(obj.get("angle"))
    scale_x = _num(obj.get("scaleX"), 1)
    scale_y = _num(obj.get("scaleY"), 1)
    opacity = max(0.0, min(1.0, _num(obj.get("opacity"), 1)))
    common = f'opacity="{opacity}" transform="rotate({angle} {left} {top})"'
    fill = _svg_fill(obj.get("fill"))
    stroke = _svg_fill(obj.get("stroke"), "none")
    stroke_width = _num(obj.get("strokeWidth"))
    stroke_attr = f'stroke="{stroke}" stroke-width="{stroke_width}"' if stroke != "none" else ""

    if obj_type == "group":
        children = "".join(_svg_object(child) for child in obj.get("objects", []) if isinstance(child, dict))
        return f'<g {common}>{children}</g>'

    if obj_type in ("text", "i-text", "textbox"):
        text = _svg_escape(obj.get("text", ""))
        font_size = _num(obj.get("fontSize"), 24)
        family = _svg_escape(obj.get("fontFamily", "Inter"))
        weight = "bold" if str(obj.get("fontWeight", "")).lower() == "bold" else "normal"
        style = "italic" if str(obj.get("fontStyle", "")).lower() == "italic" else "normal"
        anchor = {"center": "middle", "right": "end"}.get(obj.get("textAlign", "left"), "start")
        lines = text.split("\n")
        x = left
        if obj.get("textAlign") == "center":
            x = left
        elif obj.get("textAlign") == "right":
            x = left
        tspan = "".join(
            f'<tspan x="{x}" dy="{0 if index == 0 else font_size * 1.2}">{line}</tspan>'
            for index, line in enumerate(lines)
        )
        return (
            f'<text x="{x}" y="{top}" fill="{fill}" font-size="{font_size}" '
            f'font-family="{family}" font-weight="{weight}" font-style="{style}" '
            f'text-anchor="{anchor}" {common}>{tspan}</text>'
        )

    if obj_type == "rect":
        width = _num(obj.get("width")) * scale_x
        height = _num(obj.get("height")) * scale_y
        rx = _num(obj.get("rx")) * scale_x
        return (
            f'<rect x="{left - width / 2}" y="{top - height / 2}" width="{width}" '
            f'height="{height}" rx="{rx}" fill="{fill}" {stroke_attr} {common}/>'
        )
    if obj_type == "circle":
        radius = _num(obj.get("radius"))
        scale = max(scale_x, scale_y)
        return (
            f'<circle cx="{left}" cy="{top}" r="{radius * scale}" fill="{fill}" '
            f'{stroke_attr} {common}/>'
        )
    if obj_type == "triangle":
        width = _num(obj.get("width")) * scale_x
        height = _num(obj.get("height")) * scale_y
        points = f"{left},{top - height / 2} {left + width / 2},{top + height / 2} {left - width / 2},{top + height / 2}"
        return f'<polygon points="{points}" fill="{fill}" {stroke_attr} {common}/>'
    if obj_type == "line":
        x1 = left + _num(obj.get("x1")) * scale_x
        y1 = top + _num(obj.get("y1")) * scale_y
        x2 = left + _num(obj.get("x2")) * scale_x
        y2 = top + _num(obj.get("y2")) * scale_y
        return (
            f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" '
            f'stroke="{_svg_fill(obj.get("stroke"), "#111")}" stroke-width="{stroke_width or 2}" {common}/>'
        )
    if obj_type == "polygon":
        points = " ".join(
            f"{left + _num(p.get('x')) * scale_x},{top + _num(p.get('y')) * scale_y}"
            for p in obj.get("points", [])
        )
        return f'<polygon points="{points}" fill="{fill}" {stroke_attr} {common}/>'
    if obj_type == "image":
        href = _svg_image_href(obj.get("src", ""))
        if not href:
            return ""
        width = _num(obj.get("width")) * scale_x
        height = _num(obj.get("height")) * scale_y
        return (
            f'<image x="{left - width / 2}" y="{top - height / 2}" width="{width}" '
            f'height="{height}" href="{href}" preserveAspectRatio="none" {common}/>'
        )
    if obj_type == "path":
        return f'<!-- path object preserved as raw data: {_svg_escape(str(obj.get("path"))[:200])} -->'
    return ""


def export_svg(design, stage, dpi=300) -> tuple[bytes, int, int, list[str]]:
    canvas_json = _resolve_stage_canvas(design, stage)
    if not canvas_json:
        raise RenderError("No artwork found for this stage.")
    width_mm = float(stage.print_area.width_mm)
    height_mm = float(stage.print_area.height_mm)
    width_px = round(width_mm / 25.4 * dpi)
    height_px = round(height_mm / 25.4 * dpi)
    canvas_w = _num(canvas_json.get("width"), width_px)
    canvas_h = _num(canvas_json.get("height"), height_px)
    body = "".join(_svg_object(obj) for obj in canvas_json.get("objects", []) if isinstance(obj, dict))
    warnings_list = _validate_resolution(design, stage, canvas_json, dpi)
    svg = (
        f'<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
        f'width="{width_mm}mm" height="{height_mm}mm" viewBox="0 0 {canvas_w} {canvas_h}">\n'
        f"{body}\n</svg>\n"
    )
    return svg.encode("utf-8"), width_px, height_px, warnings_list


def export_pdf(design, stage, dpi=300) -> tuple[bytes, int, int, list[str]]:
    png_bytes, width_px, height_px, warnings_list = export_png(design, stage, dpi)
    image = Image.open(io.BytesIO(png_bytes)).convert("RGB")
    output = io.BytesIO()
    image.save(output, format="PDF", resolution=float(dpi))
    return output.getvalue(), width_px, height_px, warnings_list
