"""Replace placeholder product imagery with plain product mockups.

Every sellable product should show a plain image of a plain product: generated
flat illustrations in the same visual language as the original studio mockups
(cream backdrop, soft shadow, neutral product colours, no printed artwork).

Usage:
    cd backend && .venv/bin/python seed_plain_images.py
    cd backend && .venv/bin/python seed_plain_images.py --dry-run
"""
import io
import os
import sys
from decimal import Decimal

import django

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.core.files.base import ContentFile
from PIL import Image, ImageDraw

from catalog.models import Product, ProductStage
from catalog.management.commands.seed_demo import (
    _fold,
    _shadow,
    _vertical_gradient,
    draw_hoodie,
    draw_mug,
    draw_phone_case,
    draw_poster,
    draw_tee,
    draw_tote,
)

INK = (43, 48, 58, 255)
INK_DARK = (33, 37, 45, 255)
INK_SOFT = (66, 72, 84, 255)
OAT = (168, 153, 133, 255)
OAT_DARK = (146, 132, 114, 255)
CANVAS = (222, 206, 178, 255)
CANVAS_DARK = (203, 185, 155, 255)
CREAM = (247, 245, 240, 255)
OUTLINE = (216, 210, 200, 255)
STEEL = (168, 172, 176, 255)
STEEL_DARK = (140, 145, 150, 255)
GLASS = (228, 234, 238, 235)
GLASS_LINE = (203, 210, 216, 255)


def _base(size):
    image = _vertical_gradient(size, (250, 247, 241, 255), (230, 225, 216, 255))
    return image, ImageDraw.Draw(image)


def draw_crewneck():
    image, draw = _base((1000, 1200))
    _shadow(image, (290, 890, 710, 1040), opacity=55)
    body = (122, 126, 120, 255)
    dark = (104, 108, 103, 255)
    shirt = [
        (350, 225), (312, 240), (170, 400), (246, 512), (342, 430),
        (316, 980), (684, 980), (658, 430), (754, 512), (830, 400),
        (688, 240), (650, 225), (578, 200), (500, 222), (422, 200),
    ]
    draw.polygon(shirt, fill=body)
    draw.ellipse([(432, 178), (568, 262)], fill=(244, 241, 235, 255))
    draw.arc([(432, 178), (568, 262)], 355, 185, fill=dark, width=10)
    draw.line([(320, 960), (680, 960)], fill=dark, width=4)
    _fold(draw, [(430, 470), (455, 750), (445, 950)], dark)
    _fold(draw, [(570, 470), (545, 750), (555, 950)], dark)
    return image


def draw_ziphoodie():
    image = draw_hoodie()
    draw = ImageDraw.Draw(image)
    draw.line([(500, 336), (500, 980)], fill=(226, 220, 210, 255), width=6)
    draw.rounded_rectangle([(490, 296), (510, 342)], radius=6, fill=(210, 204, 194, 255))
    return image


def draw_cap():
    image, draw = _base((1000, 1000))
    _shadow(image, (270, 690, 730, 780), opacity=55)
    crown = (54, 60, 72, 255)
    dark = (43, 48, 58, 255)
    draw.pieslice([(280, 340), (720, 780)], 180, 360, fill=crown)
    draw.rectangle([(280, 560), (720, 680)], fill=crown)
    draw.rounded_rectangle([(250, 660), (750, 730)], radius=35, fill=dark)
    draw.ellipse([(484, 332), (516, 364)], fill=dark)
    for x in (430, 500, 570):
        target = (500, 366)
        draw.line([target, (x, 560)], fill=dark, width=3)
    return image


def draw_bucket_hat():
    image, draw = _base((1000, 1000))
    _shadow(image, (250, 660, 750, 760), opacity=50)
    crown = (196, 178, 148, 255)
    brim = (180, 162, 134, 255)
    draw.ellipse([(250, 560), (750, 730)], fill=brim)
    draw.rounded_rectangle([(330, 320), (670, 640)], radius=60, fill=crown)
    draw.line([(330, 600), (670, 600)], fill=(170, 152, 126, 255), width=6)
    draw.line([(500, 330), (500, 590)], fill=(180, 163, 136, 255), width=3)
    return image


def draw_beanie():
    image, draw = _base((1000, 1000))
    _shadow(image, (300, 800, 700, 880), opacity=50)
    knit = (198, 186, 170, 255)
    cuff = (176, 164, 146, 255)
    draw.rounded_rectangle([(330, 300), (670, 820)], radius=170, fill=knit)
    draw.rounded_rectangle([(300, 700), (700, 850)], radius=42, fill=cuff)
    for x in range(322, 690, 42):
        draw.line([(x, 712), (x, 838)], fill=(164, 152, 134, 255), width=3)
    draw.line([(500, 320), (420, 700)], fill=(184, 172, 156, 255), width=3)
    draw.line([(500, 320), (500, 700)], fill=(184, 172, 156, 255), width=3)
    draw.line([(500, 320), (580, 700)], fill=(184, 172, 156, 255), width=3)
    return image


def draw_pillow():
    image, draw = _base((1000, 1000))
    _shadow(image, (250, 700, 750, 790), opacity=50)
    draw.rounded_rectangle([(240, 270), (760, 760)], radius=90, fill=(232, 224, 209, 255), outline=(214, 205, 189, 255), width=3)
    draw.rounded_rectangle([(274, 304), (726, 726)], radius=70, outline=(219, 210, 194, 255), width=3)
    return image


def draw_blanket():
    image, draw = _base((1200, 1000))
    _shadow(image, (280, 740, 920, 850), opacity=50)
    draw.rounded_rectangle([(260, 540), (940, 800)], radius=26, fill=(190, 176, 154, 255))
    draw.rounded_rectangle([(260, 360), (940, 610)], radius=26, fill=(203, 188, 164, 255))
    draw.line([(300, 452), (900, 452)], fill=(214, 200, 176, 255), width=3)
    draw.line([(300, 676), (900, 676)], fill=(176, 162, 140, 255), width=3)
    return image


def draw_tumbler():
    image, draw = _base((900, 1200))
    _shadow(image, (280, 1010, 620, 1100), opacity=50)
    draw.rounded_rectangle([(290, 380), (610, 1040)], radius=46, fill=STEEL, outline=STEEL_DARK, width=3)
    draw.rounded_rectangle([(278, 286), (622, 400)], radius=26, fill=(52, 57, 64, 255))
    draw.rounded_rectangle([(330, 440), (362, 980)], radius=14, fill=(196, 200, 203, 110))
    draw.line([(300, 520), (600, 520)], fill=STEEL_DARK, width=3)
    return image


def draw_travel_mug():
    image, draw = _base((900, 1200))
    _shadow(image, (270, 1010, 640, 1100), opacity=50)
    draw.ellipse([(580, 520), (720, 780)], outline=STEEL_DARK, width=30)
    draw.rounded_rectangle([(260, 400), (620, 1040)], radius=40, fill=STEEL, outline=STEEL_DARK, width=3)
    draw.rounded_rectangle([(246, 306), (634, 418)], radius=24, fill=(52, 57, 64, 255))
    draw.rounded_rectangle([(410, 288), (470, 312)], radius=8, fill=(30, 33, 38, 255))
    return image


def draw_bottle():
    image, draw = _base((900, 1200))
    _shadow(image, (330, 1030, 570, 1120), opacity=50)
    draw.rounded_rectangle([(390, 340), (510, 460)], radius=18, fill=(196, 206, 210, 255))
    draw.rounded_rectangle([(330, 420), (570, 1080)], radius=70, fill=(150, 176, 188, 255), outline=(128, 152, 164, 255), width=3)
    draw.rounded_rectangle([(372, 286), (528, 360)], radius=16, fill=(52, 57, 64, 255))
    draw.line([(352, 560), (548, 560)], fill=(128, 152, 164, 255), width=3)
    draw.line([(352, 920), (548, 920)], fill=(128, 152, 164, 255), width=3)
    return image


def draw_notebook():
    image, draw = _base((1000, 1200))
    _shadow(image, (300, 960, 720, 1040), opacity=50)
    draw.rounded_rectangle([(300, 240), (700, 1000)], radius=28, fill=(47, 52, 62, 255))
    draw.rectangle([(686, 252), (716, 988)], fill=(244, 240, 232, 255))
    draw.line([(354, 252), (354, 988)], fill=(36, 40, 48, 255), width=4)
    draw.line([(658, 252), (658, 988)], fill=(30, 33, 40, 255), width=6)
    draw.rounded_rectangle([(398, 560), (604, 690)], radius=8, fill=(240, 236, 228, 255))
    return image


def draw_mousepad():
    image, draw = _base((1200, 900))
    _shadow(image, (240, 610, 960, 700), opacity=50)
    draw.rounded_rectangle([(220, 270), (980, 630)], radius=30, fill=(44, 49, 58, 255), outline=INK_SOFT, width=3)
    draw.rounded_rectangle([(246, 296), (954, 604)], radius=22, outline=(76, 82, 94, 255), width=2)
    return image


def draw_coaster():
    image, draw = _base((1000, 1000))
    _shadow(image, (290, 720, 690, 800), opacity=50)
    draw.ellipse([(280, 480), (680, 780)], fill=(196, 180, 156, 255))
    draw.ellipse([(300, 450), (700, 750)], fill=(214, 199, 175, 255))
    draw.ellipse([(320, 420), (720, 720)], fill=(229, 215, 192, 255), outline=(203, 187, 163, 255), width=3)
    draw.ellipse([(366, 466), (674, 674)], outline=(210, 195, 172, 255), width=3)
    return image


def draw_sleeve():
    image, draw = _base((1000, 1200))
    _shadow(image, (280, 980, 720, 1060), opacity=50)
    draw.rounded_rectangle([(280, 260), (720, 1040)], radius=44, fill=(172, 158, 140, 255))
    draw.rounded_rectangle([(302, 282), (698, 1018)], radius=36, outline=(152, 138, 122, 255), width=2)
    draw.line([(306, 320), (694, 320)], fill=(134, 120, 104, 255), width=5)
    draw.rounded_rectangle([(470, 306), (530, 334)], radius=8, fill=(134, 120, 104, 255))
    return image


def draw_drawstring():
    image, draw = _base((1000, 1200))
    _shadow(image, (300, 980, 700, 1060), opacity=50)
    draw.line([(360, 430), (452, 300)], fill=CANVAS_DARK, width=8)
    draw.line([(640, 430), (548, 300)], fill=CANVAS_DARK, width=8)
    draw.ellipse([(434, 282), (466, 314)], fill=CANVAS_DARK)
    draw.ellipse([(534, 282), (566, 314)], fill=CANVAS_DARK)
    draw.rounded_rectangle([(300, 420), (700, 1060)], radius=36, fill=CANVAS)
    draw.line([(310, 480), (690, 480)], fill=CANVAS_DARK, width=3)
    draw.line([(310, 1020), (690, 1020)], fill=CANVAS_DARK, width=3)
    _fold(draw, [(330, 500), (342, 760), (330, 1000)], CANVAS_DARK)
    _fold(draw, [(670, 500), (658, 760), (670, 1000)], CANVAS_DARK)
    return image


def draw_glass_mug():
    image, draw = _base((1200, 900))
    _shadow(image, (300, 680, 880, 810), opacity=55)
    draw.ellipse([(860, 320), (1070, 660)], outline=GLASS_LINE, width=46)
    draw.rounded_rectangle([(250, 240), (950, 760)], radius=52, fill=GLASS, outline=GLASS_LINE, width=3)
    draw.ellipse([(250, 210), (950, 330)], fill=(238, 243, 246, 255), outline=GLASS_LINE, width=3)
    draw.ellipse([(268, 222), (932, 318)], outline=(214, 221, 227, 255), width=4)
    draw.line([(274, 720), (926, 720)], fill=(214, 221, 227, 255), width=4)
    return image


def draw_espresso():
    image, draw = _base((1000, 1000))
    _shadow(image, (330, 720, 670, 790), opacity=55)
    draw.ellipse([(290, 620), (710, 770)], fill=(232, 228, 220, 255), outline=OUTLINE, width=3)
    draw.ellipse([(610, 480), (720, 620)], outline=(226, 222, 214, 255), width=24)
    draw.rounded_rectangle([(360, 430), (640, 680)], radius=40, fill=CREAM, outline=OUTLINE, width=3)
    draw.ellipse([(360, 400), (640, 480)], fill=(250, 249, 246, 255), outline=OUTLINE, width=3)
    return image


def draw_stein():
    image, draw = _base((1200, 900))
    _shadow(image, (280, 660, 860, 740), opacity=55)
    draw.ellipse([(820, 330), (1040, 650)], outline=GLASS_LINE, width=44)
    draw.rounded_rectangle([(280, 260), (860, 720)], radius=28, fill=GLASS, outline=GLASS_LINE, width=3)
    for x in (360, 440, 520, 600, 680, 760):
        draw.line([(x, 320), (x, 680)], fill=(206, 214, 220, 180), width=3)
    draw.ellipse([(280, 230), (860, 320)], fill=(238, 243, 246, 255), outline=GLASS_LINE, width=3)
    return image


def draw_framed_poster():
    image, draw = _base((1000, 1400))
    _shadow(image, (95, 90, 905, 1310), opacity=60, blur=24)
    draw.rectangle([(80, 70), (920, 1330)], fill=(58, 52, 46, 255))
    draw.rectangle([(104, 94), (896, 1306)], outline=(86, 78, 70, 255), width=4)
    draw.rectangle([(150, 140), (850, 1260)], fill=(246, 243, 236, 255))
    draw.rectangle([(195, 185), (805, 1215)], fill=(251, 250, 247, 255), outline=(233, 229, 221, 255), width=2)
    return image


def draw_canvas_print():
    image, draw = _base((1000, 1200))
    _shadow(image, (160, 150, 860, 1080), opacity=55, blur=22)
    draw.polygon([(820, 180), (860, 150), (860, 1050), (820, 1080)], fill=(224, 219, 210, 255))
    draw.polygon([(180, 1080), (820, 1080), (860, 1050), (220, 1050)], fill=(224, 219, 210, 255))
    draw.rectangle([(160, 150), (820, 1080)], fill=(250, 248, 243, 255))
    draw.rectangle([(184, 174), (796, 1056)], outline=(234, 229, 220, 255), width=2)
    return image


def draw_tee_vneck():
    image = draw_tee()
    draw = ImageDraw.Draw(image)
    draw.polygon([(455, 190), (545, 190), (500, 300)], fill=(244, 241, 235, 255))
    draw.line([(455, 190), (500, 300)], fill=INK_DARK, width=10)
    draw.line([(545, 190), (500, 300)], fill=INK_DARK, width=10)
    return image


def draw_tee_long_sleeve():
    image, draw = _base((1000, 1200))
    _shadow(image, (270, 900, 730, 1040), opacity=55)
    shirt = [
        (352, 205), (320, 218), (168, 380), (120, 880), (212, 906),
        (300, 470), (316, 980), (684, 980), (700, 470), (788, 906),
        (880, 880), (832, 380), (680, 218), (648, 205), (578, 188),
        (500, 214), (422, 188),
    ]
    draw.polygon(shirt, fill=INK)
    draw.ellipse([(428, 165), (572, 255)], fill=(247, 244, 238, 255))
    draw.arc([(428, 165), (572, 255)], 350, 190, fill=INK_DARK, width=12)
    _fold(draw, [(430, 420), (470, 700), (455, 960)], INK_DARK)
    _fold(draw, [(570, 420), (535, 720), (548, 960)], INK_DARK)
    draw.line([(146, 872), (206, 890)], fill=INK_DARK, width=8)
    draw.line([(854, 872), (794, 890)], fill=INK_DARK, width=8)
    return image


def draw_tee_ringer():
    image = draw_tee()
    draw = ImageDraw.Draw(image)
    draw.arc([(428, 165), (572, 255)], 350, 190, fill=(235, 231, 223, 255), width=12)
    draw.line([(252, 478), (342, 402)], fill=(235, 231, 223, 255), width=12)
    draw.line([(748, 478), (658, 402)], fill=(235, 231, 223, 255), width=12)
    return image


def draw_tee_pocket():
    image = draw_tee()
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle([(565, 330), (625, 395)], radius=4, fill=INK, outline=INK_DARK, width=3)
    return image


def draw_tee_crop():
    image = draw_tee()
    draw = ImageDraw.Draw(image)
    draw.rectangle([(0, 900), (1000, 1200)], fill=(236, 231, 222, 255))
    _shadow(image, (290, 860, 710, 940), opacity=45, offset=14)
    draw.line([(316, 890), (684, 890)], fill=INK_DARK, width=8)
    return image


def draw_tee_tie_dye():
    image = draw_tee()
    draw = ImageDraw.Draw(image)
    for (cx, cy, r, color) in [
        (420, 520, 90, (72, 96, 122, 255)),
        (590, 700, 110, (96, 118, 142, 255)),
        (470, 840, 70, (72, 96, 122, 255)),
    ]:
        draw.ellipse([(cx - r, cy - r), (cx + r, cy + r)], outline=color, width=14)
    return image


def draw_dad_cap():
    return draw_cap()


def draw_trucker_cap():
    image = draw_cap()
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle([(348, 412), (652, 646)], radius=26, fill=(246, 243, 236, 255))
    draw.line([(500, 416), (500, 642)], fill=(226, 221, 212, 255), width=2)
    return image


def draw_snapback():
    image = draw_cap()
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle([(250, 660), (750, 706)], radius=18, fill=(52, 58, 70, 255))
    return image


def draw_zip_sweatshirt():
    return draw_ziphoodie()


def draw_sweatshirt():
    return draw_crewneck()


def draw_crop_hoodie():
    return draw_hoodie()


SPECS = {
    "tee": (draw_tee, (355, 320, 290, 380)),
    "tee-vneck": (draw_tee_vneck, (355, 340, 290, 380)),
    "tee-long": (draw_tee_long_sleeve, (355, 320, 290, 380)),
    "tee-ringer": (draw_tee_ringer, (355, 320, 290, 380)),
    "tee-pocket": (draw_tee_pocket, (355, 320, 290, 380)),
    "tee-crop": (draw_tee_crop, (355, 320, 290, 360)),
    "tee-tie-dye": (draw_tee_tie_dye, (355, 320, 290, 380)),
    "hoodie": (draw_hoodie, (345, 330, 310, 400)),
    "ziphoodie": (draw_ziphoodie, (345, 330, 310, 400)),
    "crewneck": (draw_crewneck, (350, 320, 300, 380)),
    "cap": (draw_cap, (360, 330, 280, 200)),
    "cap-trucker": (draw_trucker_cap, (360, 330, 280, 200)),
    "cap-snapback": (draw_snapback, (360, 330, 280, 200)),
    "bucket": (draw_bucket_hat, (350, 360, 300, 220)),
    "beanie": (draw_beanie, (340, 330, 320, 260)),
    "pillow": (draw_pillow, (280, 280, 440, 440)),
    "blanket": (draw_blanket, (320, 280, 560, 440)),
    "tumbler": (draw_tumbler, (310, 380, 280, 480)),
    "travel-mug": (draw_travel_mug, (300, 380, 280, 480)),
    "bottle": (draw_bottle, (350, 430, 200, 450)),
    "notebook": (draw_notebook, (330, 280, 340, 500)),
    "mousepad": (draw_mousepad, (300, 280, 600, 380)),
    "coaster": (draw_coaster, (350, 350, 300, 300)),
    "sleeve": (draw_sleeve, (300, 340, 400, 520)),
    "drawstring": (draw_drawstring, (330, 420, 340, 420)),
    "glass": (draw_glass_mug, (330, 300, 540, 380)),
    "espresso": (draw_espresso, (350, 350, 300, 260)),
    "stein": (draw_stein, (330, 320, 480, 340)),
    "framed": (draw_framed_poster, (180, 180, 640, 1040)),
    "canvasprint": (draw_canvas_print, (140, 120, 720, 960)),
    "poster": (draw_poster, (130, 130, 740, 1140)),
    "mug": (draw_mug, (330, 300, 540, 380)),
    "tote": (draw_tote, (305, 420, 390, 460)),
    "phone": (draw_phone_case, (330, 200, 240, 760)),
}


def classify(slug: str) -> str:
    s = slug
    if "phone" in s or "case" in s:
        return "phone"
    if "mouse" in s:
        return "mousepad"
    if "coaster" in s:
        return "coaster"
    if "notebook" in s:
        return "notebook"
    if "laptop" in s:
        return "sleeve"
    if "pillow" in s:
        return "pillow"
    if "blanket" in s:
        return "blanket"
    if "travel-coffee-mug" in s:
        return "travel-mug"
    if "tumbler" in s:
        return "tumbler"
    if "bottle" in s:
        return "bottle"
    if "stein" in s:
        return "stein"
    if "espresso" in s:
        return "espresso"
    if "glass" in s:
        return "glass"
    if "mug" in s or "cup" in s:
        return "mug"
    if "framed" in s:
        return "framed"
    if "canvas-print" in s:
        return "canvasprint"
    if "poster" in s or "art-print" in s:
        return "poster"
    if "bucket" in s:
        return "bucket"
    if "beanie" in s:
        return "beanie"
    if "snapback" in s:
        return "cap-snapback"
    if "trucker" in s:
        return "cap-trucker"
    if "cap" in s or "hat" in s:
        return "cap"
    if "drawstring" in s:
        return "drawstring"
    if "tote" in s or "bag" in s:
        return "tote"
    if "zip" in s:
        return "ziphoodie"
    if "hoodie" in s:
        return "hoodie"
    if "sweatshirt" in s:
        return "crewneck"
    if "v-neck" in s:
        return "tee-vneck"
    if "long" in s:
        return "tee-long"
    if "ringer" in s:
        return "tee-ringer"
    if "pocket" in s:
        return "tee-pocket"
    if "crop-top" in s:
        return "tee-crop"
    if "tie-dye" in s:
        return "tee-tie-dye"
    if "tee" in s or "shirt" in s:
        return "tee"
    return "tee"


def png_bytes(image: Image.Image) -> bytes:
    output = io.BytesIO()
    image.save(output, format="PNG", optimize=True)
    return output.getvalue()


def main(dry_run: bool = False) -> None:
    products = Product.objects.all().order_by("name")
    print(f"Updating {products.count()} products")

    for product in products:
        kind = classify(product.slug)
        draw_fn, rect = SPECS[kind]
        image = draw_fn()
        name = f"plain-{product.slug}.png"
        print(f"  {product.slug:28s} -> {kind:16s} {image.size[0]}x{image.size[1]}")

        if dry_run:
            continue

        product.image.save(name, ContentFile(png_bytes(image)), save=True)

        for stage in product.stages.all():
            if stage.mockup_image:
                continue
            stage.mockup_image.save(name, ContentFile(png_bytes(image)), save=False)
            stage.mockup_width = image.size[0]
            stage.mockup_height = image.size[1]
            stage.save()

            area = stage.print_area
            if area:
                x, y, w, h = rect
                area.mockup_x = x
                area.mockup_y = y
                area.mockup_width = w
                area.mockup_height = h
                area.width_mm = Decimal("200.00")
                area.height_mm = (Decimal("200.00") * Decimal(h) / Decimal(w)).quantize(Decimal("0.01"))
                area.save()

    print("Done." if not dry_run else "Dry run complete.")


if __name__ == "__main__":
    main(dry_run="--dry-run" in sys.argv)
