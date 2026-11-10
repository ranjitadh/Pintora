"""Seed the MerchPress demo catalog with original generated assets.

Everything created here is produced from code (Pillow drawings and Fabric.js
JSON documents), so the repository does not depend on third-party stock art.

Usage:
    python manage.py seed_demo
    python manage.py seed_demo --force   # regenerate image assets
"""
import io
import os
import secrets
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from PIL import Image, ImageDraw, ImageFilter

from catalog.models import (
    PrintArea,
    PrintingMethod,
    PricingRule,
    Product,
    ProductCategory,
    ProductPrintingMethod,
    ProductStage,
    ProductVariant,
)
from commerce.models import Cart, Order, StoreConfiguration
from commerce.services import add_cart_item, checkout_cart
from designer.models import Clipart, Design, DesignTemplate, DesignVersion, FontResource
from production.render import render_canvas, render_preview_bytes

FONT_DIR = Path(settings.BASE_DIR) / "assets" / "fonts"
BACKDROP = (244, 241, 235, 255)


def _replace(field, name, content):
    storage = field.storage
    if field:
        field.delete(save=False)
    if storage.exists(name):
        storage.delete(name)
    field.save(name, content, save=False)


def _png_bytes(image):
    output = io.BytesIO()
    image.save(output, format="PNG", optimize=True)
    return output.getvalue()


def _vertical_gradient(size, top, bottom):
    width, height = size
    image = Image.new("RGBA", size, top)
    draw = ImageDraw.Draw(image)
    for y in range(height):
        ratio = y / max(1, height - 1)
        color = tuple(int(top[i] + (bottom[i] - top[i]) * ratio) for i in range(4))
        draw.line([(0, y), (width, y)], fill=color)
    return image


def _shadow(image, box, blur=18, opacity=70, offset=26):
    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.rounded_rectangle(
        [box[0], box[1] + offset, box[2], box[3] + offset],
        radius=40,
        fill=(20, 16, 12, opacity),
    )
    image.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur)))


def _fold(draw, points, color):
    draw.line(points, fill=color, width=3, joint="curve")


def draw_tee(back=False):
    image = _vertical_gradient((1000, 1200), (250, 247, 241, 255), (232, 227, 218, 255))
    draw = ImageDraw.Draw(image)
    _shadow(image, (290, 890, 710, 1040), opacity=55)
    body = (43, 48, 58, 255)
    trim = (33, 37, 45, 255)
    shirt = [
        (352, 205), (320, 218), (176, 368), (252, 478), (342, 402),
        (316, 980), (684, 980), (658, 402), (748, 478), (824, 368),
        (680, 218), (648, 205), (578, 188), (500, 214), (422, 188),
    ]
    draw.polygon(shirt, fill=body)
    _fold(draw, [(430, 420), (470, 700), (455, 980)], trim)
    _fold(draw, [(570, 420), (535, 720), (548, 980)], trim)
    if back:
        draw.line([(430, 205), (500, 240), (570, 205)], fill=trim, width=10)
        draw.rounded_rectangle([470, 260, 530, 300], radius=8, fill=(232, 227, 218, 255))
    else:
        draw.ellipse([(428, 165), (572, 255)], fill=(247, 244, 238, 255))
        draw.arc([(428, 165), (572, 255)], 350, 190, fill=trim, width=12)
    draw.line([(252, 478), (266, 455)], fill=(70, 76, 88, 255), width=3)
    draw.line([(748, 478), (734, 455)], fill=(70, 76, 88, 255), width=3)
    return image


def draw_hoodie(back=False):
    image = _vertical_gradient((1000, 1200), (249, 246, 240, 255), (228, 223, 214, 255))
    draw = ImageDraw.Draw(image)
    _shadow(image, (290, 890, 710, 1040), opacity=55)
    body = (166, 151, 132, 255)
    dark = (140, 126, 109, 255)
    shirt = [
        (350, 225), (312, 240), (170, 400), (246, 512), (342, 430),
        (316, 980), (684, 980), (658, 430), (754, 512), (830, 400),
        (688, 240), (650, 225), (578, 200), (500, 228), (422, 200),
    ]
    draw.polygon(shirt, fill=body)
    draw.ellipse([(392, 182), (608, 348)], fill=dark)
    draw.ellipse([(438, 218), (562, 332)], fill=(49, 45, 40, 255))
    if not back:
        draw.line([(470, 330), (462, 420)], fill=(244, 241, 235, 255), width=8)
        draw.line([(530, 330), (538, 420)], fill=(244, 241, 235, 255), width=8)
        draw.rounded_rectangle([(388, 780), (612, 916)], radius=18, outline=dark, width=6)
        draw.line([(500, 796), (500, 900)], fill=dark, width=4)
    _fold(draw, [(420, 480), (450, 760), (440, 940)], dark)
    _fold(draw, [(580, 480), (550, 760), (560, 940)], dark)
    return image


def draw_mug():
    image = _vertical_gradient((1200, 900), (250, 247, 241, 255), (229, 224, 215, 255))
    draw = ImageDraw.Draw(image)
    _shadow(image, (300, 680, 880, 810), opacity=55)
    draw.ellipse([(860, 320), (1070, 660)], outline=(224, 220, 212, 255), width=46)
    draw.rounded_rectangle([(250, 240), (950, 760)], radius=52, fill=(247, 246, 242, 255), outline=(219, 214, 205, 255), width=3)
    draw.ellipse([(250, 210), (950, 330)], fill=(252, 251, 248, 255), outline=(219, 214, 205, 255), width=3)
    draw.ellipse([(268, 222), (932, 318)], outline=(232, 228, 220, 255), width=4)
    draw.line([(274, 720), (926, 720)], fill=(232, 228, 220, 255), width=4)
    return image


def draw_tote():
    image = _vertical_gradient((1000, 1200), (250, 247, 241, 255), (231, 226, 217, 255))
    draw = ImageDraw.Draw(image)
    _shadow(image, (250, 980, 750, 1130), opacity=55)
    handle = (186, 168, 141, 255)
    draw.arc([(300, 218), (470, 382)], 180, 360, fill=handle, width=26)
    draw.arc([(530, 218), (700, 382)], 180, 360, fill=handle, width=26)
    draw.rounded_rectangle([(260, 330), (740, 1060)], radius=22, fill=(220, 203, 174, 255))
    draw.line([(280, 370), (720, 370)], fill=(203, 185, 155, 255), width=3)
    draw.line([(280, 1020), (720, 1020)], fill=(203, 185, 155, 255), width=3)
    _fold(draw, [(320, 400), (330, 700), (320, 1000)], (207, 189, 159, 255))
    _fold(draw, [(680, 400), (670, 700), (680, 1000)], (207, 189, 159, 255))
    return image


def draw_phone_case():
    image = _vertical_gradient((900, 1200), (248, 245, 239, 255), (228, 223, 214, 255))
    draw = ImageDraw.Draw(image)
    _shadow(image, (290, 130, 610, 1010), opacity=60)
    draw.rounded_rectangle([(280, 120), (620, 1000)], radius=64, fill=(34, 38, 46, 255))
    draw.rounded_rectangle([(298, 138), (602, 982)], radius=50, outline=(66, 72, 84, 255), width=4)
    draw.rounded_rectangle([(320, 165), (455, 325)], radius=26, fill=(24, 27, 33, 255))
    draw.ellipse([(338, 185), (400, 247)], fill=(52, 58, 70, 255))
    draw.ellipse([(352, 199), (386, 233)], fill=(20, 23, 28, 255))
    draw.ellipse([(410, 200), (438, 228)], fill=(58, 64, 76, 255))
    draw.ellipse([(410, 255), (438, 283)], fill=(58, 64, 76, 255))
    draw.line([(310, 840), (590, 840)], fill=(52, 58, 70, 255), width=3)
    return image


def draw_poster():
    image = _vertical_gradient((1000, 1400), (248, 245, 238, 255), (224, 219, 209, 255))
    draw = ImageDraw.Draw(image)
    _shadow(image, (95, 90, 905, 1310), opacity=60, blur=24)
    draw.rectangle([(80, 70), (920, 1300)], fill=(252, 251, 248, 255))
    draw.rectangle([(110, 100), (890, 1270)], outline=(232, 228, 220, 255), width=2)
    return image


MOCKUPS = {
    "classic-tee": (draw_tee, 1000, 1200),
    "classic-tee-back": (lambda: draw_tee(back=True), 1000, 1200),
    "premium-hoodie": (draw_hoodie, 1000, 1200),
    "premium-hoodie-back": (lambda: draw_hoodie(back=True), 1000, 1200),
    "ceramic-mug": (draw_mug, 1200, 900),
    "canvas-tote": (draw_tote, 1000, 1200),
    "phone-case": (draw_phone_case, 900, 1200),
    "art-poster": (draw_poster, 1000, 1400),
}


def _draw_star(draw, cx, cy, outer, inner, points=5, fill=None):
    import math

    coords = []
    for index in range(points * 2):
        radius = outer if index % 2 == 0 else inner
        angle = -math.pi / 2 + index * math.pi / points
        coords.append((cx + math.cos(angle) * radius, cy + math.sin(angle) * radius))
    draw.polygon(coords, fill=fill)


def clipart_star():
    image = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    _draw_star(draw, 256, 260, 200, 88, fill=(242, 183, 5, 255))
    _draw_star(draw, 256, 260, 130, 58, fill=(250, 214, 96, 255))
    return image


def clipart_heart():
    image = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.ellipse([(96, 96), (300, 300)], fill=(222, 72, 92, 255))
    draw.ellipse([(212, 96), (416, 300)], fill=(222, 72, 92, 255))
    draw.polygon([(104, 244), (256, 448), (408, 244)], fill=(222, 72, 92, 255))
    draw.ellipse([(166, 150), (224, 208)], fill=(255, 255, 255, 60))
    return image


def clipart_sun():
    image = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    import math

    for index in range(12):
        angle = index * math.pi / 6
        x1 = 256 + math.cos(angle) * 170
        y1 = 256 + math.sin(angle) * 170
        x2 = 256 + math.cos(angle) * 235
        y2 = 256 + math.sin(angle) * 235
        draw.line([(x1, y1), (x2, y2)], fill=(244, 162, 40, 255), width=22)
    draw.ellipse([(106, 106), (406, 406)], fill=(250, 190, 60, 255))
    draw.ellipse([(160, 160), (352, 352)], fill=(255, 214, 110, 255))
    return image


def clipart_bolt():
    image = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.polygon(
        [(292, 42), (130, 290), (242, 290), (204, 470), (386, 214), (268, 214)],
        fill=(250, 204, 21, 255),
    )
    draw.polygon(
        [(292, 42), (130, 290), (242, 290), (228, 350), (318, 120), (268, 120)],
        fill=(255, 231, 120, 255),
    )
    return image


def clipart_moon():
    image = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    mask = Image.new("L", (512, 512), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.ellipse([(86, 66), (426, 406)], fill=255)
    mask_draw.ellipse([(206, 36), (486, 316)], fill=0)
    moon = Image.new("RGBA", (512, 512), (126, 140, 190, 255))
    image.paste(moon, (0, 0), mask)
    draw = ImageDraw.Draw(image)
    draw.ellipse([(150, 220), (182, 252)], fill=(96, 108, 156, 255))
    draw.ellipse([(212, 310), (240, 338)], fill=(96, 108, 156, 255))
    return image


def clipart_leaf():
    image = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.ellipse([(120, 96), (392, 416)], fill=(74, 138, 96, 255))
    draw.line([(150, 400), (376, 126)], fill=(240, 247, 238, 255), width=12)
    for offset in (0, 60, 120, 180):
        draw.line([(176 + offset, 356 - offset), (246 + offset, 386 - offset)], fill=(240, 247, 238, 255), width=8)
        draw.line([(196 + offset, 322 - offset), (266 + offset, 346 - offset)], fill=(240, 247, 238, 255), width=8)
    return image


def clipart_flower():
    image = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    import math

    for index in range(8):
        angle = index * math.pi / 4
        cx = 256 + math.cos(angle) * 120
        cy = 256 + math.sin(angle) * 120
        draw.ellipse([(cx - 82, cy - 82), (cx + 82, cy + 82)], fill=(232, 130, 158, 255))
    draw.ellipse([(176, 176), (336, 336)], fill=(250, 205, 90, 255))
    draw.ellipse([(212, 212), (300, 300)], fill=(224, 162, 52, 255))
    return image


def clipart_diamond():
    image = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.polygon([(256, 70), (432, 226), (256, 450), (80, 226)], fill=(90, 170, 190, 255))
    draw.polygon([(256, 70), (340, 226), (256, 450), (172, 226)], fill=(146, 210, 224, 255))
    draw.line([(80, 226), (432, 226)], fill=(240, 250, 252, 255), width=8)
    return image


def clipart_arrow():
    image = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.polygon(
        [(60, 216), (318, 216), (318, 128), (462, 256), (318, 384), (318, 296), (60, 296)],
        fill=(34, 38, 46, 255),
    )
    return image


def clipart_smiley():
    image = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.ellipse([(56, 56), (456, 456)], fill=(250, 205, 90, 255))
    draw.ellipse([(158, 178), (210, 244)], fill=(34, 38, 46, 255))
    draw.ellipse([(302, 178), (354, 244)], fill=(34, 38, 46, 255))
    draw.arc([(150, 220), (362, 400)], 20, 160, fill=(34, 38, 46, 255), width=22)
    return image


def clipart_wave():
    image = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.arc([(40, 90), (240, 290)], 0, 180, fill=(64, 130, 190, 255), width=26)
    draw.arc([(180, 90), (380, 290)], 0, 180, fill=(64, 130, 190, 255), width=26)
    draw.arc([(320, 90), (472, 290)], 0, 180, fill=(64, 130, 190, 255), width=26)
    draw.arc([(40, 260), (240, 460)], 180, 360, fill=(120, 180, 220, 255), width=26)
    draw.arc([(180, 260), (380, 460)], 180, 360, fill=(120, 180, 220, 255), width=26)
    draw.arc([(320, 260), (472, 460)], 180, 360, fill=(120, 180, 220, 255), width=26)
    return image


def clipart_badge():
    image = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.ellipse([(58, 58), (454, 454)], fill=(214, 91, 60, 255))
    draw.ellipse([(96, 96), (416, 416)], outline=(250, 235, 218, 255), width=10)
    _draw_star(draw, 256, 256, 92, 40, fill=(250, 235, 218, 255))
    return image


CLIPARTS = [
    ("Classic Star", "Shapes", clipart_star),
    ("Heart Solid", "Symbols", clipart_heart),
    ("Sunburst", "Nature", clipart_sun),
    ("Lightning Bolt", "Symbols", clipart_bolt),
    ("Crescent Moon", "Nature", clipart_moon),
    ("Botanical Leaf", "Nature", clipart_leaf),
    ("Retro Flower", "Nature", clipart_flower),
    ("Faceted Diamond", "Shapes", clipart_diamond),
    ("Directional Arrow", "Shapes", clipart_arrow),
    ("Happy Face", "Celebration", clipart_smiley),
    ("Studio Wave", "Shapes", clipart_wave),
    ("Circular Badge", "Celebration", clipart_badge),
]


PRODUCTS = [
    {
        "slug": "classic-tee",
        "name": "Classic Heavyweight Tee",
        "category": "Apparel",
        "short": "290 gsm organic cotton with a structured drape.",
        "description": (
            "A everyday heavyweight tee built for bold prints. Combed organic cotton, "
            "reinforced shoulder seams, and a slightly boxy fit. Add artwork to the front, "
            "back, or both."
        ),
        "base_price": "24.90",
        "compare_at_price": "29.90",
        "featured": True,
        "stages": [
            {"name": "Front", "slug": "front", "mockup": "classic-tee", "area": (305, 406, 360, 340, 300, 400)},
            {"name": "Back", "slug": "back", "mockup": "classic-tee-back", "area": (305, 406, 360, 340, 300, 400)},
        ],
        "variants": [
            ("Black / S", "TSH-BLK-S", "Black", "#1f1f1f", "S", "0"),
            ("Black / M", "TSH-BLK-M", "Black", "#1f1f1f", "M", "0"),
            ("Black / L", "TSH-BLK-L", "Black", "#1f1f1f", "L", "0"),
            ("Black / XL", "TSH-BLK-XL", "Black", "#1f1f1f", "XL", "0"),
            ("Black / 2XL", "TSH-BLK-2XL", "Black", "#1f1f1f", "2XL", "2"),
            ("Bone / S", "TSH-BNE-S", "Bone", "#e9e2d6", "S", "0"),
            ("Bone / M", "TSH-BNE-M", "Bone", "#e9e2d6", "M", "0"),
            ("Bone / L", "TSH-BNE-L", "Bone", "#e9e2d6", "L", "0"),
            ("Bone / XL", "TSH-BNE-XL", "Bone", "#e9e2d6", "XL", "0"),
            ("Bone / 2XL", "TSH-BNE-2XL", "Bone", "#e9e2d6", "2XL", "2"),
            ("Navy / M", "TSH-NVY-M", "Navy", "#27364f", "M", "0"),
            ("Navy / L", "TSH-NVY-L", "Navy", "#27364f", "L", "0"),
            ("Navy / XL", "TSH-NVY-XL", "Navy", "#27364f", "XL", "0"),
        ],
        "discounts": [{"min_qty": 5, "percent": 5}, {"min_qty": 10, "percent": 8}, {"min_qty": 25, "percent": 12}],
        "methods": [("Direct-to-Garment", True)],
    },
    {
        "slug": "premium-hoodie",
        "name": "Premium Studio Hoodie",
        "category": "Apparel",
        "short": "Brushed fleece, dropped shoulders, and an oversized hood.",
        "description": (
            "A heavyweight fleece hoodie with a relaxed silhouette and a soft brushed "
            "interior. Embroider a chest mark or print a full back graphic."
        ),
        "base_price": "54.90",
        "compare_at_price": None,
        "featured": True,
        "stages": [
            {"name": "Front", "slug": "front", "mockup": "premium-hoodie", "area": (280, 350, 355, 380, 288, 360)},
            {"name": "Back", "slug": "back", "mockup": "premium-hoodie-back", "area": (280, 350, 355, 470, 288, 360)},
        ],
        "variants": [
            ("Oat / S", "HD-OAT-S", "Oat", "#a69784", "S", "0"),
            ("Oat / M", "HD-OAT-M", "Oat", "#a69784", "M", "0"),
            ("Oat / L", "HD-OAT-L", "Oat", "#a69784", "L", "0"),
            ("Oat / XL", "HD-OAT-XL", "Oat", "#a69784", "XL", "0"),
            ("Oat / 2XL", "HD-OAT-2XL", "Oat", "#a69784", "2XL", "3"),
            ("Charcoal / M", "HD-CHR-M", "Charcoal", "#3b3f46", "M", "0"),
            ("Charcoal / L", "HD-CHR-L", "Charcoal", "#3b3f46", "L", "0"),
            ("Charcoal / XL", "HD-CHR-XL", "Charcoal", "#3b3f46", "XL", "0"),
            ("Forest / M", "HD-FOR-M", "Forest", "#3f5245", "M", "0"),
            ("Forest / L", "HD-FOR-L", "Forest", "#3f5245", "L", "0"),
        ],
        "discounts": [{"min_qty": 5, "percent": 5}, {"min_qty": 10, "percent": 10}],
        "methods": [("Direct-to-Garment", True), ("Embroidery", False)],
    },
    {
        "slug": "ceramic-mug",
        "name": "Ceramic Wrap Mug",
        "category": "Home & Living",
        "short": "Dishwasher-safe 11 oz ceramic with a full wrap print.",
        "description": (
            "A glossy ceramic mug with a comfortable C-handle and a seamless sublimation "
            "wrap. Artwork spans the entire visible face."
        ),
        "base_price": "16.90",
        "compare_at_price": None,
        "featured": True,
        "stages": [
            {"name": "Wrap", "slug": "wrap", "mockup": "ceramic-mug", "area": (200, 85, 340, 315, 540, 230)},
        ],
        "variants": [
            ("11 oz", "MUG-11", "White", "#ffffff", "11 oz", "0"),
            ("15 oz", "MUG-15", "White", "#ffffff", "15 oz", "3"),
        ],
        "discounts": [{"min_qty": 4, "percent": 6}, {"min_qty": 12, "percent": 12}],
        "methods": [("Sublimation", True)],
    },
    {
        "slug": "canvas-tote",
        "name": "Heavy Canvas Tote",
        "category": "Accessories",
        "short": "12 oz cotton canvas with reinforced handles.",
        "description": (
            "A structured everyday tote made from heavy cotton canvas. Carries groceries, "
            "laptops, and ideas. One large front print area."
        ),
        "base_price": "19.90",
        "compare_at_price": "24.90",
        "featured": True,
        "stages": [
            {"name": "Front", "slug": "front", "mockup": "canvas-tote", "area": (250, 250, 330, 430, 340, 340)},
        ],
        "variants": [
            ("Natural", "TOTE-NAT", "Natural", "#dccbae", "One size", "0"),
            ("Black", "TOTE-BLK", "Black", "#232323", "One size", "1"),
        ],
        "discounts": [{"min_qty": 5, "percent": 5}, {"min_qty": 10, "percent": 10}],
        "methods": [("Direct-to-Garment", True)],
    },
    {
        "slug": "phone-case",
        "name": "Snap Phone Case",
        "category": "Accessories",
        "short": "Impact-resistant polycarbonate with a glossy finish.",
        "description": (
            "A slim, hard-shell case with precise camera cutouts and a vibrant glossy "
            "surface. Designed for edge-to-edge artwork."
        ),
        "base_price": "22.90",
        "compare_at_price": None,
        "featured": False,
        "stages": [
            {"name": "Back", "slug": "back", "mockup": "phone-case", "area": (60, 130, 310, 220, 280, 606)},
        ],
        "variants": [
            ("iPhone 15 Pro", "CASE-I15P", "Clear", "#e8e8e8", "iPhone 15 Pro", "0"),
            ("iPhone 15 Pro Max", "CASE-I15PM", "Clear", "#e8e8e8", "iPhone 15 Pro Max", "1"),
            ("Samsung S24", "CASE-S24", "Clear", "#e8e8e8", "Samsung S24", "0.5"),
        ],
        "discounts": [{"min_qty": 3, "percent": 5}, {"min_qty": 10, "percent": 10}],
        "methods": [("UV Print", True)],
    },
    {
        "slug": "art-poster",
        "name": "Museum Art Poster",
        "category": "Wall Art",
        "short": "200 gsm matte paper with archival pigment inks.",
        "description": (
            "A gallery-quality poster printed on heavyweight matte paper. Choose from "
            "three standard sizes and upload photography, type, or illustration."
        ),
        "base_price": "29.90",
        "compare_at_price": None,
        "featured": False,
        "stages": [
            {"name": "Print", "slug": "print", "mockup": "art-poster", "area": (300, 400, 120, 160, 760, 1013)},
        ],
        "variants": [
            ("A3", "POST-A3", "Natural", "#f7f4ed", "A3", "0"),
            ("A2", "POST-A2", "Natural", "#f7f4ed", "A2", "8"),
            ("18 × 24 in", "POST-1824", "Natural", "#f7f4ed", "18 × 24 in", "10"),
        ],
        "discounts": [{"min_qty": 3, "percent": 5}, {"min_qty": 10, "percent": 12}],
        "methods": [("UV Print", True)],
    },
]


def text_object(text, left, top, size, **overrides):
    base = {
        "type": "textbox",
        "version": "5.3.0",
        "originX": "center",
        "originY": "center",
        "left": left,
        "top": top,
        "width": overrides.pop("width", size * 6),
        "text": text,
        "fontSize": size,
        "fontFamily": "Inter",
        "fontWeight": "normal",
        "fontStyle": "normal",
        "textAlign": "center",
        "fill": "#1f1f1f",
        "lineHeight": 1.16,
        "letterSpacing": 0,
        "scaleX": 1,
        "scaleY": 1,
        "angle": 0,
        "opacity": 1,
        "styles": {},
    }
    base.update(overrides)
    return base


TEMPLATES = [
    {
        "slug": "bold-statement",
        "name": "Bold Statement",
        "category": "Typographic",
        "product": "classic-tee",
        "stage": "Front",
        "tags": ["bold", "type", "statement"],
        "preview_bg": (43, 48, 58, 255),
        "objects": [
            text_object("MAKE IT\nYOURS", 900, 980, 210, fontWeight="bold", fontSize=210, letterSpacing=10, fill="#f4f1eb", width=1500),
            text_object("PRINTORA STUDIO", 900, 1460, 52, fontWeight="bold", letterSpacing=14, fill="#f4f1eb", width=1200),
        ],
    },
    {
        "slug": "serif-story",
        "name": "Serif Story",
        "category": "Editorial",
        "product": "canvas-tote",
        "stage": "Front",
        "tags": ["serif", "minimal", "editorial"],
        "preview_bg": (236, 229, 217, 255),
        "objects": [
            text_object("Made with\nintention.", 738, 600, 96, fontFamily="Lora", fontStyle="italic", fill="#38332c", width=900),
            text_object("PRINTORA", 738, 910, 40, fontFamily="Lora", letterSpacing=16, fill="#514a3f", width=700),
        ],
    },
    {
        "slug": "mono-grid",
        "name": "Mono Grid",
        "category": "Typographic",
        "product": "art-poster",
        "stage": "Print",
        "tags": ["mono", "poster", "grid"],
        "preview_bg": (255, 255, 255, 255),
        "objects": [
            {
                "type": "rect", "version": "5.3.0", "originX": "center", "originY": "center",
                "left": 886, "top": 1181, "width": 1500, "height": 2150, "fill": "transparent",
                "stroke": "#1f1f1f", "strokeWidth": 6, "scaleX": 1, "scaleY": 1,
                "angle": 0, "opacity": 1,
            },
            text_object("FORM\nFOLLOWS\nFUNCTION", 886, 1080, 210, fontFamily="Space Mono", fontWeight="bold", textAlign="left", fill="#1f1f1f", width=1500),
            text_object("A STUDY IN USEFUL THINGS — 2026", 886, 1880, 44, fontFamily="Space Mono", letterSpacing=4, textAlign="left", fill="#1f1f1f", width=1500),
        ],
    },
    {
        "slug": "minimal-monogram",
        "name": "Minimal Monogram",
        "category": "Minimal",
        "product": "premium-hoodie",
        "stage": "Front",
        "tags": ["monogram", "minimal", "initials"],
        "preview_bg": (58, 62, 70, 255),
        "objects": [
            text_object("P", 826, 1000, 400, fontWeight="bold", fill="#f4f1eb", width=700),
            text_object("EST. 2026", 826, 1460, 52, letterSpacing=12, fill="#f4f1eb", width=700),
        ],
    },
    {
        "slug": "weekend-club",
        "name": "Weekend Club",
        "category": "Streetwear",
        "product": "classic-tee",
        "stage": "Front",
        "tags": ["streetwear", "club", "retro"],
        "preview_bg": (43, 48, 58, 255),
        "objects": [
            text_object("WEEKEND\nCLUB", 900, 940, 190, fontWeight="bold", letterSpacing=8, fill="#f2c96b", width=1500),
            text_object("OPEN ALL DAY / EVERY DAY", 900, 1380, 46, fontWeight="bold", letterSpacing=8, fill="#f2c96b", width=1300),
            {
                "type": "circle", "version": "5.3.0", "originX": "center", "originY": "center",
                "left": 900, "top": 1720, "radius": 36, "width": 72, "height": 72,
                "fill": "transparent", "stroke": "#f2c96b", "strokeWidth": 6,
                "scaleX": 1, "scaleY": 1, "angle": 0, "opacity": 1,
            },
        ],
    },
    {
        "slug": "mug-typography",
        "name": "Morning Type",
        "category": "Typographic",
        "product": "ceramic-mug",
        "stage": "Wrap",
        "tags": ["mug", "type", "morning"],
        "preview_bg": (236, 231, 222, 255),
        "objects": [
            text_object("GOOD\nMORNINGS", 590, 180, 120, fontWeight="bold", letterSpacing=6, fill="#26313f", width=1300),
            text_object("COFFEE FIRST", 590, 380, 36, fontWeight="bold", letterSpacing=12, fill="#b06a3b", width=1100),
        ],
    },
]


class Command(BaseCommand):
    help = "Create the MerchPress demo catalog, generated mockups, templates, cliparts, and fonts."

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true", help="Regenerate image assets.")

    def handle(self, *args, **options):
        self.force = options["force"]
        self.stdout.write("Seeding MerchPress demo data…")

        config = StoreConfiguration.get_solo()
        config.store_name = "MerchPress"
        config.currency = "USD"
        config.tax_rate = Decimal("0")
        config.shipping_fee = Decimal("4.95")
        config.free_shipping_threshold = Decimal("75.00")
        config.demo_mode = True
        config.announcement = "Free shipping on orders over $75 · Designed by you, printed by us."
        config.save()

        categories = {}
        for index, name in enumerate(["Apparel", "Accessories", "Home & Living", "Wall Art"]):
            category, _ = ProductCategory.objects.update_or_create(
                name=name,
                defaults={"description": f"{name} made to be personalized.", "sort_order": index, "is_active": True},
            )
            categories[name] = category

        methods = {}
        method_specs = [
            ("Direct-to-Garment", "Soft, full-color apparel printing.", "0", "0", 0),
            ("Embroidery", "Durable stitched decoration.", "4.00", "2.00", 1),
            ("Sublimation", "All-over color transfer for hard goods.", "0", "0", 2),
            ("UV Print", "Crisp, scratch-resistant direct printing.", "1.50", "0.50", 3),
        ]
        for name, description, base_fee, per_area, order in method_specs:
            method, _ = PrintingMethod.objects.update_or_create(
                name=name,
                defaults={
                    "description": description,
                    "base_fee": Decimal(base_fee),
                    "per_area_fee": Decimal(per_area),
                    "sort_order": order,
                    "is_active": True,
                },
            )
            methods[name] = method

        self._seed_fonts()
        self._seed_cliparts()

        products = {}
        stages_by_product = {}
        for spec in PRODUCTS:
            product = self._seed_product(spec, categories[spec["category"]], methods)
            products[spec["slug"]] = product
            stages_by_product[spec["slug"]] = list(product.stages.all())
            self._seed_rules(product, methods)

        self._seed_templates(products, stages_by_product)
        self._seed_admin()
        demo_user = self._seed_customer()
        if demo_user:
            self._seed_demo_order(demo_user, products["classic-tee"])

        self.stdout.write(self.style.SUCCESS("Seed complete."))
        self.stdout.write(
            f"  {Product.objects.count()} products · {ProductStage.objects.count()} stages · "
            f"{ProductVariant.objects.count()} variants · {DesignTemplate.objects.count()} templates · "
            f"{Clipart.objects.count()} cliparts · {FontResource.objects.count()} fonts"
        )
        self.stdout.write(
            f"  Media root: {settings.MEDIA_ROOT}\n"
            "  Admin account is created only when DJANGO_ADMIN_EMAIL and DJANGO_ADMIN_PASSWORD are set."
        )

    def _seed_product(self, spec, category, methods):
        product, _ = Product.objects.update_or_create(
            slug=spec["slug"],
            defaults={
                "category": category,
                "name": spec["name"],
                "short_description": spec["short"],
                "description": spec["description"],
                "base_price": Decimal(spec["base_price"]),
                "compare_at_price": Decimal(spec["compare_at_price"]) if spec["compare_at_price"] else None,
                "currency": "USD",
                "is_active": True,
                "is_featured": spec["featured"],
                "quantity_discounts": spec["discounts"],
                "metadata": {"seed": "demo"},
            },
        )

        front_stage = None
        for index, stage_spec in enumerate(spec["stages"]):
            width_mm, height_mm, x, y, w, h = stage_spec["area"]
            mockup_func, mockup_w, mockup_h = MOCKUPS[stage_spec["mockup"]]
            stage = ProductStage.objects.filter(product=product, name=stage_spec["name"]).first()
            if stage is None:
                area = PrintArea.objects.create(
                    name=f"{spec['name']} — {stage_spec['name']}",
                    width_mm=Decimal(width_mm),
                    height_mm=Decimal(height_mm),
                    mockup_x=x,
                    mockup_y=y,
                    mockup_width=w,
                    mockup_height=h,
                    safe_area_mm=Decimal("3"),
                    editor_dpi=150,
                    export_dpi=300,
                    min_dpi=150,
                    grid_mm=10,
                    shape="cylinder" if spec["slug"] == "ceramic-mug" else "rectangle",
                )
                stage = ProductStage.objects.create(
                    product=product,
                    name=stage_spec["name"],
                    slug=stage_spec["slug"],
                    print_area=area,
                    sort_order=index,
                    is_active=True,
                    mockup_width=mockup_w,
                    mockup_height=mockup_h,
                )
            else:
                area = stage.print_area
                if area is None:
                    area = PrintArea.objects.create(name=f"{spec['name']} — {stage_spec['name']}", width_mm=Decimal(width_mm), height_mm=Decimal(height_mm), mockup_x=x, mockup_y=y, mockup_width=w, mockup_height=h)
                    stage.print_area = area
                area.width_mm = Decimal(width_mm)
                area.height_mm = Decimal(height_mm)
                area.mockup_x = x
                area.mockup_y = y
                area.mockup_width = w
                area.mockup_height = h
                area.shape = "cylinder" if spec["slug"] == "ceramic-mug" else "rectangle"
                area.save()
                stage.slug = stage_spec["slug"]
                stage.sort_order = index
                stage.is_active = True
                stage.mockup_width = mockup_w
                stage.mockup_height = mockup_h
                stage.save()

            if self.force or not stage.mockup_image:
                image = mockup_func()
                _replace(stage.mockup_image, f"{spec['slug']}-{stage_spec['slug']}.png", ContentFile(_png_bytes(image)))
                stage.save(update_fields=["mockup_image", "updated_at"])
            if front_stage is None:
                front_stage = stage

        if (self.force or not product.image) and front_stage and front_stage.mockup_image:
            image = MOCKUPS[spec["stages"][0]["mockup"]][0]()
            _replace(product.image, f"{spec['slug']}.png", ContentFile(_png_bytes(image)))
            product.save(update_fields=["image", "updated_at"])

        for order, (name, sku, color_name, color_hex, size, delta) in enumerate(spec["variants"]):
            ProductVariant.objects.update_or_create(
                product=product,
                name=name,
                defaults={
                    "sku": sku,
                    "color_name": color_name,
                    "color_hex": color_hex,
                    "size": size,
                    "price_delta": Decimal(delta),
                    "stock_quantity": 1000,
                    "is_active": True,
                    "sort_order": order,
                },
            )

        for method_name, is_default in spec["methods"]:
            ProductPrintingMethod.objects.update_or_create(
                product=product,
                printing_method=methods[method_name],
                defaults={"is_default": is_default, "price_adjustment": Decimal("0")},
            )
        return product

    def _seed_rules(self, product, methods):
        rules = []
        if product.slug == "classic-tee":
            rules = [
                ("per_image", "Artwork upload", "2.00", methods["Direct-to-Garment"]),
                ("per_clipart", "Clipart element", "0.50", methods["Direct-to-Garment"]),
                ("per_character", "Typography", "0.03", methods["Direct-to-Garment"]),
            ]
        elif product.slug == "premium-hoodie":
            rules = [
                ("per_design", "Embroidered design", "4.00", methods["Embroidery"]),
                ("per_image", "Printed artwork", "3.00", methods["Direct-to-Garment"]),
            ]
        elif product.slug == "ceramic-mug":
            rules = [("per_image", "Wrap artwork", "2.50", methods["Sublimation"])]
        elif product.slug == "art-poster":
            rules = [("per_design", "Artwork setup", "3.00", methods["UV Print"])]
        elif product.slug == "phone-case":
            rules = [("per_print_area", "Edge-to-edge coverage", "1.50", methods["UV Print"])]
        for rule_type, description, amount, method in rules:
            PricingRule.objects.update_or_create(
                product=product,
                printing_method=method,
                rule_type=rule_type,
                defaults={"amount": Decimal(amount), "description": description, "is_active": True},
            )

    def _seed_fonts(self):
        specs = [
            ("Inter", "Inter", "Inter.ttf", "400", "normal", 0),
            ("Inter Italic", "Inter", "Inter-Italic.ttf", "400", "italic", 1),
            ("Lora", "Lora", "Lora.ttf", "400", "normal", 2),
            ("Space Mono", "Space Mono", "SpaceMono-Regular.ttf", "400", "normal", 3),
            ("Space Mono Bold", "Space Mono", "SpaceMono-Bold.ttf", "700", "normal", 4),
        ]
        for name, family, filename, weight, style, order in specs:
            source = FONT_DIR / filename
            font, _ = FontResource.objects.update_or_create(
                name=name,
                defaults={"family": family, "weight": weight, "style": style, "sort_order": order, "is_active": True},
            )
            if source.exists() and (self.force or not font.file):
                if font.file:
                    font.file.delete(save=False)
                if font.file.storage.exists(filename):
                    font.file.storage.delete(filename)
                with source.open("rb") as handle:
                    font.file.save(filename, handle, save=True)

    def _seed_cliparts(self):
        for order, (name, category, draw_func) in enumerate(CLIPARTS):
            clipart, _ = Clipart.objects.update_or_create(
                name=name,
                defaults={"category": category, "price": Decimal("0"), "sort_order": order, "is_active": True, "tags": [category.lower()]},
            )
            if self.force or not clipart.image:
                image = draw_func()
                _replace(clipart.image, f"{name.lower().replace(' ', '-')}.png", ContentFile(_png_bytes(image)))
                clipart.save(update_fields=["image", "updated_at"])

    def _seed_templates(self, products, stages_by_product):
        for spec in TEMPLATES:
            product = products[spec["product"]]
            stage = next((s for s in stages_by_product[spec["product"]] if s.name == spec["stage"]), None)
            if stage is None or stage.print_area is None:
                continue
            area = stage.print_area
            canvas = {
                "version": "5.3.0",
                "width": area.width_px,
                "height": area.height_px,
                "objects": spec["objects"],
            }
            template, _ = DesignTemplate.objects.update_or_create(
                slug=spec["slug"],
                defaults={
                    "name": spec["name"],
                    "category": spec["category"],
                    "tags": spec["tags"],
                    "description": f"Ready-to-edit {spec['category'].lower()} layout for {product.name}.",
                    "product": product,
                    "canvas_json": canvas,
                    "price": Decimal("0"),
                    "is_active": True,
                    "visibility": "public",
                },
            )
            if self.force or not template.preview_image:
                try:
                    image, _warnings = render_canvas(
                        canvas, 720, background=spec.get("preview_bg", (255, 255, 255, 255))
                    )
                    _replace(template.preview_image, f"{spec['slug']}.png", ContentFile(_png_bytes(image)))
                    template.save(update_fields=["preview_image", "updated_at"])
                except Exception as exc:
                    self.stderr.write(f"Template preview failed for {spec['slug']}: {exc}")

    def _seed_admin(self):
        email = os.getenv("DJANGO_ADMIN_EMAIL", "").strip().lower()
        password = os.getenv("DJANGO_ADMIN_PASSWORD", "")
        if not email or not password:
            return
        if not Product.objects.exists():
            return
        from accounts.models import User

        if not User.objects.filter(email=email).exists():
            User.objects.create_superuser(
                username=email, email=email, password=password, first_name="MerchPress", last_name="Admin", role=User.Role.ADMIN
            )
            self.stdout.write(self.style.SUCCESS(f"  Admin account created: {email}"))
        else:
            User.objects.filter(email=email).update(role=User.Role.ADMIN)

    def _seed_customer(self):
        from accounts.models import User, UserProfile

        email = os.getenv("DEMO_CUSTOMER_EMAIL", "demo@printora.local").strip().lower()
        password = os.getenv("DEMO_CUSTOMER_PASSWORD", "")
        user = User.objects.filter(email=email).first()
        created = False
        if user is None:
            created = True
            password = password or secrets.token_urlsafe(12)
            user = User.objects.create_user(
                username=email, email=email, password=password, first_name="Demo", last_name="Customer", role="customer"
            )
            UserProfile.objects.get_or_create(user=user)
        elif not hasattr(user, "profile"):
            UserProfile.objects.get_or_create(user=user)
        if created:
            self.stdout.write(self.style.SUCCESS(f"  Demo customer created: {email} / {password}"))
        return user

    def _seed_demo_order(self, user, product):
        if Order.objects.filter(user=user).exists():
            return
        template = DesignTemplate.objects.filter(slug="bold-statement", product=product).first()
        if template is None:
            return
        stage = product.stages.filter(name="Front").first()
        if stage is None:
            return
        design = Design.objects.create(
            user=user,
            product=product,
            stage=stage,
            name="Bold Statement sample",
            canvas_json=template.canvas_json,
            status=Design.Status.SAVED,
            version=1,
        )
        DesignVersion.objects.create(design=design, version=1, canvas_json=design.canvas_json, created_by=user)
        try:
            content, _warnings = render_preview_bytes(design, stage=stage, width=640)
            design.preview_image.save(f"design-{design.id}-v1.png", ContentFile(content), save=True)
        except Exception as exc:
            self.stderr.write(f"Demo preview failed: {exc}")

        variant = product.variants.first()
        method_link = product.printing_method_links.filter(is_default=True).first()
        method = method_link.printing_method if method_link else None
        add_cart_item(
            user,
            product_id=product.id,
            variant_id=variant.id if variant else None,
            design_id=design.id,
            printing_method_id=method.id if method else None,
            quantity=2,
        )[0]
        try:
            checkout_cart(
                user,
                {
                    "shipping_name": "Demo Customer",
                    "shipping_phone": "+1 555 0100",
                    "shipping_address": "123 Studio Street",
                    "shipping_city": "Portland",
                    "shipping_postal_code": "97205",
                    "shipping_country": "United States",
                    "notes": "Seeded demo order.",
                    "demo": True,
                },
            )
            self.stdout.write("  Demo order created (paid, demo payment).")
        except Exception as exc:
            self.stderr.write(f"Demo order failed: {exc}")
            Cart.objects.filter(user=user, status="active").delete()
