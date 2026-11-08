"""
Seed fonts and clipart including Nepali-themed designs.
Run with: cd backend && .venv/bin/python seed_fonts_clipart.py
"""
import django
import os
import sys
import io
import struct
import uuid
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from designer.models import Clipart, FontResource
from django.core.files.base import ContentFile
from django.utils.text import slugify
from decimal import Decimal

MEDIA_CLIPART_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "media", "clipart")
MEDIA_FONTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "media", "fonts")
os.makedirs(MEDIA_CLIPART_DIR, exist_ok=True)
os.makedirs(MEDIA_FONTS_DIR, exist_ok=True)


def make_image(size, draw_fn, mode="RGBA", bg=(255, 255, 255, 0)):
    """Create a PNG image with a custom draw function."""
    img = Image.new(mode, size, bg)
    draw = ImageDraw.Draw(img)
    draw_fn(draw, img)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return ContentFile(buf.read(), name=f"{uuid.uuid4().hex[:8]}.png")


# -----------------------------------------------------------
# Nepali / Himalayan themed clipart
# -----------------------------------------------------------
def nepali_flag(draw, img):
    """Nepal flag - double-pennant crimson red with blue border."""
    w, h = img.size
    crimson = (196, 26, 44)
    blue = (0, 48, 73)
    white = (255, 255, 255)
    draw.polygon([(0, h * 0.9), (w * 0.6, h * 0.4), (0, h * 0.2)], fill=crimson)
    draw.polygon([(4, h * 0.86), (w * 0.58, h * 0.44), (4, h * 0.24)], fill=blue)
    draw.polygon([(0, h * 0.9), (w * 0.6, h * 0.25), (w * 0.6, h * 0.7)], fill=crimson)
    draw.polygon([(4, h * 0.86), (w * 0.58, h * 0.62), (w * 0.58, h * 0.28)], fill=blue)
    cx = w * 0.22
    cy1 = h * 0.42
    cy2 = h * 0.78
    r1 = h * 0.06
    draw.ellipse([cx - r1, cy1 - r1, cx + r1, cy1 + r1], fill=white)
    draw.ellipse([cx - r1, cy2 - r1, cx + r1, cy2 + r1], fill=white)
    draw.ellipse([cx - r1 + 3, cy2 - r1 + 3, cx + r1 + 3, cy2 + r1 + 3], fill=crimson)


def himalayas(draw, img):
    """Mount Everest / Himalayan peaks."""
    w, h = img.size
    rock = (120, 120, 120)
    snow = (255, 255, 255)
    draw.polygon([(0, h * 0.9), (w * 0.35, h * 0.45), (w * 0.2, h * 0.7)], fill=rock)
    draw.polygon([(w, h * 0.9), (w * 0.65, h * 0.35), (w * 0.8, h * 0.6)], fill=rock)
    draw.polygon([(w * 0.35, h * 0.45), (w * 0.5, h * 0.15), (w * 0.65, h * 0.45)], fill=rock)
    draw.polygon([(w * 0.35, h * 0.45), (w * 0.3, h * 0.35), (w * 0.4, h * 0.33)], fill=snow)
    draw.polygon([(w * 0.5, h * 0.15), (w * 0.48, h * 0.08), (w * 0.52, h * 0.08)], fill=snow)
    draw.polygon([(w * 0.65, h * 0.45), (w * 0.7, h * 0.35), (w * 0.6, h * 0.33)], fill=snow)


def nepali_temple(draw, img):
    """Nepalese pagoda-style temple."""
    w, h = img.size
    red = (196, 26, 44)
    dark = (60, 40, 30)
    draw.rectangle([w * 0.3, h * 0.7, w * 0.7, h * 0.9], fill=dark)
    for i in range(4):
        y = h * 0.7 - i * h * 0.08
        x_left = w * 0.3 + i * w * 0.05
        x_right = w * 0.7 - i * w * 0.05
        draw.polygon([(x_left, y), (w * 0.5, y - h * 0.07), (x_right, y)], fill=red)
        draw.line([(x_left, y), (x_right, y)], fill=(255, 215, 0), width=2)
    draw.polygon([(w * 0.25, h * 0.38), (w * 0.5, h * 0.22), (w * 0.75, h * 0.38)], fill=red)
    draw.polygon([(w * 0.27, h * 0.4), (w * 0.5, h * 0.25), (w * 0.73, h * 0.4)], fill=(255, 215, 0))


def om_symbol(draw, img):
    """Om symbol in Devanagari style."""
    w, h = img.size
    red = (196, 26, 44)
    cx = w * 0.5
    cy = h * 0.5
    r = h * 0.35
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=red)
    draw.ellipse([cx - r * 0.6, cy - r * 0.6, cx + r * 0.6, cy + r * 0.6], fill=(255, 255, 255))


def nepali_map(draw, img):
    """Outline of Nepal map."""
    w, h = img.size
    red = (196, 26, 44)
    points = [
        (w * 0.4, h * 0.95),
        (w * 0.6, h * 0.9),
        (w * 0.7, h * 0.75),
        (w * 0.75, h * 0.6),
        (w * 0.7, h * 0.45),
        (w * 0.65, h * 0.3),
        (w * 0.55, h * 0.2),
        (w * 0.45, h * 0.25),
        (w * 0.4, h * 0.4),
        (w * 0.35, h * 0.55),
        (w * 0.3, h * 0.7),
        (w * 0.35, h * 0.85),
    ]
    draw.polygon(points, fill=red)


def prayer_flags(draw, img):
    """Nepalese prayer flags."""
    w, h = img.size
    colors = [(196, 26, 44), (0, 48, 73), (255, 255, 255), (0, 128, 0), (255, 255, 0)]
    for i in range(5):
        x = w * 0.1 + i * w * 0.12
        y = h * 0.3
        draw.rectangle([x, y, x + w * 0.15, y + h * 0.25], fill=colors[i])
        cx = x + w * 0.075
        cy = y + h * 0.125
        r = h * 0.03
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255))


def lotus(draw, img):
    """Lotus flower."""
    w, h = img.size
    pink = (219, 112, 147)
    cx = w * 0.5
    cy = h * 0.6
    r = h * 0.3
    import math
    for angle in range(0, 360, 45):
        x = cx + r * 0.7 * math.cos(math.radians(angle))
        y = cy + r * 0.7 * math.sin(math.radians(angle))
        draw.ellipse([x - r * 0.15, y - r * 0.15, x + r * 0.15, y + r * 0.15], fill=pink)
    draw.ellipse([cx - r * 0.15, cy - r * 0.15, cx + r * 0.15, cy + r * 0.15], fill=(255, 215, 0))


def everest_peak(draw, img):
    """Mount Everest peak."""
    w, h = img.size
    draw.polygon([(w * 0.5, h * 0.1), (w * 0.2, h * 0.9), (w * 0.8, h * 0.9)], fill=(100, 130, 150))
    draw.polygon([(w * 0.5, h * 0.1), (w * 0.35, h * 0.3), (w * 0.65, h * 0.3)], fill=(255, 255, 255))


def nepali_flag_simple(draw, img):
    """Simple Nepal flag icon."""
    w, h = img.size
    crimson = (196, 26, 44)
    blue = (0, 48, 73)
    draw.polygon([(w * 0.2, h * 0.2), (w * 0.8, h * 0.5), (w * 0.2, h * 0.8)], fill=crimson)
    draw.polygon([(w * 0.25, h * 0.25), (w * 0.75, h * 0.5), (w * 0.25, h * 0.75)], fill=blue)
    cx = w * 0.35
    cy = h * 0.45
    r = h * 0.08
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255))


def gorkha_khukuri(draw, img):
    """Gorkha khukuri knife."""
    w, h = img.size
    draw.polygon([(w * 0.2, h * 0.9), (w * 0.7, h * 0.4), (w * 0.8, h * 0.7), (w * 0.3, h * 0.95)], fill=(169, 169, 169))
    draw.polygon([(w * 0.2, h * 0.9), (w * 0.1, h * 0.95), (w * 0.15, h * 0.98), (w * 0.25, h * 0.95)], fill=(101, 67, 33))


def nepali_flower(draw, img):
    """Rhododendron (national flower of Nepal)."""
    w, h = img.size
    red = (196, 26, 44)
    cx = w * 0.5
    cy = h * 0.5
    r = h * 0.25
    import math
    for angle in range(0, 360, 45):
        x = cx + r * math.cos(math.radians(angle))
        y = cy + r * math.sin(math.radians(angle))
        draw.ellipse([x - r * 0.3, y - r * 0.3, x + r * 0.3, y + r * 0.3], fill=red)
    draw.ellipse([cx - r * 0.15, cy - r * 0.15, cx + r * 0.15, cy + r * 0.15], fill=(255, 215, 0))


def nepali_hat(draw, img):
    """Dhaka topi (Nepali cap)."""
    w, h = img.size
    draw.ellipse([w * 0.3, h * 0.4, w * 0.7, h * 0.8], fill=(33, 33, 33))
    draw.rectangle([w * 0.3, h * 0.35, w * 0.7, h * 0.42], fill=(255, 215, 0))
    for i in range(5):
        x = w * 0.35 + i * w * 0.06
        draw.ellipse([x - h * 0.01, h * 0.37 - h * 0.01, x + h * 0.01, h * 0.37 + h * 0.01], fill=(196, 26, 44))


def nepali_scarf(draw, img):
    """Dhaka scarf pattern."""
    w, h = img.size
    colors = [(196, 26, 44), (0, 48, 73), (255, 255, 255), (0, 128, 0)]
    for i in range(4):
        x = w * 0.1 + i * w * 0.2
        draw.rectangle([x, h * 0.3, x + w * 0.15, h * 0.7], fill=colors[i])
        draw.rectangle([x + w * 0.02, h * 0.4, x + w * 0.06, h * 0.44], fill=(255, 255, 255))
        draw.rectangle([x + w * 0.08, h * 0.5, x + w * 0.12, h * 0.54], fill=(255, 255, 255))


def nepali_temple_detail(draw, img):
    """Newari temple window."""
    w, h = img.size
    draw.rectangle([w * 0.35, h * 0.3, w * 0.65, h * 0.7], fill=(139, 69, 19))
    draw.rectangle([w * 0.4, h * 0.35, w * 0.6, h * 0.65], fill=(200, 180, 160))
    draw.line([w * 0.5, h * 0.35, w * 0.5, h * 0.65], fill=(139, 69, 19), width=3)
    draw.line([w * 0.4, h * 0.5, w * 0.6, h * 0.5], fill=(139, 69, 19), width=3)
    draw.arc([w * 0.35, h * 0.25, w * 0.65, h * 0.45], start=180, end=360, fill=(196, 26, 44), width=4)


def nepali_mask(draw, img):
    """Newari mask."""
    w, h = img.size
    draw.ellipse([w * 0.35, h * 0.3, w * 0.65, h * 0.75], fill=(240, 220, 200))
    draw.ellipse([w * 0.4, h * 0.42, w * 0.45, h * 0.48], fill=(33, 33, 33))
    draw.ellipse([w * 0.55, h * 0.42, w * 0.6, h * 0.48], fill=(33, 33, 33))
    draw.polygon([(w * 0.5, h * 0.48), (w * 0.47, h * 0.55), (w * 0.53, h * 0.55)], fill=(240, 220, 200))
    draw.arc([w * 0.45, h * 0.58, w * 0.55, h * 0.68], start=0, end=180, fill=(196, 26, 44), width=3)
    draw.polygon([(w * 0.35, h * 0.3), (w * 0.45, h * 0.2), (w * 0.5, h * 0.28), (w * 0.55, h * 0.2), (w * 0.65, h * 0.3)], fill=(255, 215, 0))
    draw.ellipse([w * 0.49, h * 0.22, w * 0.51, h * 0.24], fill=(196, 26, 44))


def nepali_lotus_simple(draw, img):
    """Simple lotus."""
    w, h = img.size
    pink = (219, 112, 147)
    cx = w * 0.5
    cy = h * 0.55
    r = h * 0.22
    import math
    for i in range(8):
        angle = math.radians(i * 45)
        x = cx + r * math.cos(angle)
        y = cy + r * math.sin(angle)
        draw.ellipse([x - r * 0.3, y - r * 0.3, x + r * 0.3, y + r * 0.3], fill=pink)
    draw.ellipse([cx - r * 0.15, cy - r * 0.15, cx + r * 0.15, cy + r * 0.15], fill=(255, 215, 0))


def nepali_trident(draw, img):
    """Trident symbol."""
    w, h = img.size
    draw.line([(w * 0.5, h * 0.2), (w * 0.5, h * 0.7)], fill=(169, 169, 169), width=6)
    draw.line([(w * 0.35, h * 0.35), (w * 0.5, h * 0.2)], fill=(169, 169, 169), width=6)
    draw.line([(w * 0.65, h * 0.35), (w * 0.5, h * 0.2)], fill=(169, 169, 169), width=6)
    draw.rectangle([w * 0.49, h * 0.7, w * 0.51, h * 0.85], fill=(101, 67, 33))


def nepali_flag_wave(draw, img):
    """Waving Nepal flag."""
    w, h = img.size
    crimson = (196, 26, 44)
    blue = (0, 48, 73)
    white = (255, 255, 255)
    draw.polygon([(w * 0.1, h * 0.2), (w * 0.5, h * 0.15), (w * 0.8, h * 0.25), (w * 0.7, h * 0.45)], fill=crimson)
    draw.polygon([(w * 0.15, h * 0.5), (w * 0.55, h * 0.55), (w * 0.85, h * 0.45), (w * 0.75, h * 0.65)], fill=crimson)
    cx = w * 0.2
    cy = h * 0.32
    r = h * 0.06
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=white)


def nepali_mask_alt(draw, img):
    """Newari mask variant."""
    w, h = img.size
    draw.ellipse([w * 0.35, h * 0.3, w * 0.65, h * 0.75], fill=(240, 220, 200))
    draw.ellipse([w * 0.4, h * 0.42, w * 0.45, h * 0.48], fill=(33, 33, 33))
    draw.ellipse([w * 0.55, h * 0.42, w * 0.6, h * 0.48], fill=(33, 33, 33))
    draw.polygon([(w * 0.5, h * 0.48), (w * 0.47, h * 0.55), (w * 0.53, h * 0.55)], fill=(240, 220, 200))
    draw.arc([w * 0.45, h * 0.58, w * 0.55, h * 0.68], start=0, end=180, fill=(196, 26, 44), width=3)


def nepali_lotus_detailed(draw, img):
    """Detailed lotus."""
    w, h = img.size
    pink = (219, 112, 147)
    cx = w * 0.5
    cy = h * 0.55
    r = h * 0.22
    import math
    for angle in range(0, 360, 30):
        x = cx + r * 0.7 * math.cos(math.radians(angle))
        y = cy + r * 0.7 * math.sin(math.radians(angle))
        draw.ellipse([x - r * 0.15, y - r * 0.15, x + r * 0.15, y + r * 0.15], fill=pink)
    draw.ellipse([cx - r * 0.15, cy - r * 0.15, cx + r * 0.15, cy + r * 0.15], fill=(255, 215, 0))


def nepali_trident_detail(draw, img):
    """Detailed trident."""
    w, h = img.size
    draw.line([(w * 0.5, h * 0.2), (w * 0.5, h * 0.7)], fill=(169, 169, 169), width=8)
    draw.line([(w * 0.35, h * 0.35), (w * 0.5, h * 0.2)], fill=(169, 169, 169), width=6)
    draw.line([(w * 0.65, h * 0.35), (w * 0.5, h * 0.2)], fill=(169, 169, 169), width=6)
    draw.rectangle([w * 0.49, h * 0.7, w * 0.51, h * 0.85], fill=(101, 67, 33))


CLIPART_ENTRIES = [
    ("Nepal Flag", "Nepal", nepali_flag),
    ("Himalayan Peaks", "Nepal", himalayas),
    ("Nepalese Temple", "Nepal", nepali_temple),
    ("Om Symbol", "Nepal", om_symbol),
    ("Nepal Map", "Nepal", nepali_map),
    ("Prayer Flags", "Nepal", prayer_flags),
    ("Lotus Flower", "Nepal", lotus),
    ("Mount Everest", "Nepal", everest_peak),
    ("Simple Nepal Flag", "Nepal", nepali_flag_simple),
    ("Khukuri Knife", "Nepal", gorkha_khukuri),
    ("Rhododendron Flower", "Nepal", nepali_flower),
    ("Dhaka Topi", "Nepal", nepali_hat),
    ("Dhaka Scarf", "Nepal", nepali_scarf),
    ("Temple Window", "Nepal", nepali_temple_detail),
    ("Newari Mask", "Nepal", nepali_mask),
    ("Simple Lotus", "Nepal", nepali_lotus_simple),
    ("Trident", "Nepal", nepali_trident),
    ("Waving Nepal Flag", "Nepal", nepali_flag_wave),
]


FONT_ENTRIES = [
    ("Noto Sans Devanagari", "Noto Sans Devanagari", "Regular", "400", "normal"),
    ("Noto Sans Devanagari Bold", "Noto Sans Devanagari", "Bold", "700", "normal"),
    ("Noto Serif Devanagari", "Noto Serif Devanagari", "Regular", "400", "normal"),
    ("Noto Serif Devanagari Bold", "Noto Serif Devanagari", "Bold", "700", "normal"),
    ("Lohit Devanagari", "Lohit Devanagari", "Regular", "400", "normal"),
    ("Sakin Devanagari", "Sakin Devanagari", "Regular", "400", "normal"),
    ("Chandas", "Chandas", "Regular", "400", "normal"),
    ("Siddhanta", "Siddhanta", "Regular", "400", "normal"),
    ("Mangal", "Mangal", "Regular", "400", "normal"),
    ("Gargi", "Gargi", "Regular", "400", "normal"),
]


def seed_clipart():
    created = 0
    updated = 0
    sort_order = 0
    for name, category, func in CLIPART_ENTRIES:
        img_file = make_image((512, 512), func)
        obj, was_created = Clipart.objects.update_or_create(
            name=name,
            defaults={
                "category": category,
                "tags": [category.lower(), "nepal", "nepalese"],
                "image": img_file,
                "price": Decimal("0.00"),
                "is_active": True,
                "sort_order": sort_order,
            },
        )
        if was_created:
            created += 1
            print(f"  Created clipart: {name}")
        else:
            updated += 1
            print(f"  Updated clipart: {name}")
        sort_order += 1
    print(f"\nClipart: {created} created, {updated} updated. Total: {Clipart.objects.count()}")


def seed_fonts():
    created = 0
    updated = 0
    sort_order = 0
    for name, family, weight, weight_val, style in FONT_ENTRIES:
        buf = io.BytesIO()
        buf.write(b"\x00\x01\x00\x00")
        buf.write(struct.pack(">H", 1))
        buf.write(struct.pack(">H", 0x0000))
        buf.write(struct.pack(">H", 0x0000))
        buf.write(struct.pack(">H", 0x0000))
        buf.seek(0)
        font_file = ContentFile(buf.read(), name=f"{slugify(name).replace('-', '_')}.ttf")
        obj, created_flag = FontResource.objects.update_or_create(
            name=name,
            defaults={
                "family": family,
                "file": font_file,
                "weight": weight_val,
                "style": style,
                "is_active": True,
                "sort_order": sort_order,
            },
        )
        if created_flag:
            created += 1
            print(f"  Created font: {name}")
        else:
            updated += 1
            print(f"  Updated font: {name}")
        sort_order += 1
    print(f"\nFonts: {created} created, {updated} updated. Total: {FontResource.objects.count()}")


if __name__ == "__main__":
    print("Seeding clipart...")
    seed_clipart()
    print("\nSeeding fonts...")
    seed_fonts()