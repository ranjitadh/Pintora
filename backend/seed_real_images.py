"""Replace generated product illustrations with real, plain product photos.

Each catalog kind maps to a free-license Pexels photo of a plain (blank)
product. Photos are downloaded into ``media/products/real/`` on first run and
then applied to the product cover image, every stage mockup, and the print
areas (as a fraction of the photo so the artwork overlay stays centred).

Usage:
    cd backend && .venv/bin/python seed_real_images.py
    cd backend && .venv/bin/python seed_real_images.py --dry-run
"""
import io
import os
import sys
import urllib.request
from decimal import Decimal

import django

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.conf import settings
from django.core.files.base import ContentFile
from PIL import Image

from catalog.models import Product, ProductImage
from seed_plain_images import classify

PEXELS = "https://images.pexels.com/photos/{pid}/pexels-photo-{pid}.jpeg?auto=compress&cs=tinysrgb&w=1200"

PHOTOS = {
    "tee": ("12025472", (0.36, 0.28, 0.64, 0.58)),
    "tee-vneck": ("12025472", (0.36, 0.28, 0.64, 0.58)),
    "tee-long": ("12025472", (0.36, 0.28, 0.64, 0.58)),
    "tee-ringer": ("12025472", (0.36, 0.28, 0.64, 0.58)),
    "tee-pocket": ("12025472", (0.36, 0.28, 0.64, 0.58)),
    "tee-crop": ("12025472", (0.36, 0.28, 0.64, 0.58)),
    "tee-tie-dye": ("12025472", (0.36, 0.28, 0.64, 0.58)),
    "hoodie": ("8217518", (0.36, 0.30, 0.64, 0.58)),
    "ziphoodie": ("8217518", (0.36, 0.30, 0.64, 0.58)),
    "crewneck": ("9920820", (0.36, 0.30, 0.64, 0.58)),
    "cap": ("9558786", (0.38, 0.30, 0.62, 0.50)),
    "cap-trucker": ("26956136", (0.38, 0.32, 0.62, 0.52)),
    "cap-snapback": ("18545451", (0.38, 0.32, 0.62, 0.52)),
    "bucket": ("6962046", (0.35, 0.30, 0.65, 0.55)),
    "beanie": ("1734798", (0.36, 0.30, 0.64, 0.55)),
    "mug": ("11075707", (0.30, 0.35, 0.62, 0.62)),
    "glass": ("5514785", (0.32, 0.35, 0.62, 0.62)),
    "espresso": ("459489", (0.35, 0.38, 0.62, 0.60)),
    "stein": ("5858020", (0.30, 0.32, 0.62, 0.62)),
    "tumbler": ("9245381", (0.34, 0.32, 0.60, 0.62)),
    "travel-mug": ("19155039", (0.34, 0.30, 0.60, 0.62)),
    "bottle": ("3737800", (0.38, 0.32, 0.60, 0.62)),
    "tote": ("9869067", (0.32, 0.32, 0.66, 0.62)),
    "drawstring": ("3850492", (0.32, 0.32, 0.66, 0.62)),
    "phone": ("13706809", (0.34, 0.22, 0.64, 0.70)),
    "poster": ("6373756", (0.28, 0.22, 0.72, 0.78)),
    "framed": ("5978721", (0.30, 0.18, 0.70, 0.80)),
    "canvasprint": ("8381889", (0.26, 0.22, 0.74, 0.78)),
    "pillow": ("16497537", (0.28, 0.28, 0.72, 0.68)),
    "blanket": ("30350497", (0.28, 0.30, 0.72, 0.68)),
    "notebook": ("6991435", (0.30, 0.24, 0.70, 0.70)),
    "mousepad": ("27559487", (0.26, 0.32, 0.74, 0.62)),
    "coaster": ("1441583", (0.32, 0.36, 0.64, 0.60)),
    "sleeve": ("89723", (0.30, 0.26, 0.70, 0.70)),
}

REAL_DIR = os.path.join(settings.MEDIA_ROOT, "products", "real")


def fetch_photo(kind, dry_run=False):
    pid, _ = PHOTOS[kind]
    path = os.path.join(REAL_DIR, f"{kind}.jpg")
    if os.path.exists(path) and os.path.getsize(path) > 10000:
        return path
    if dry_run:
        return None
    os.makedirs(REAL_DIR, exist_ok=True)
    request = urllib.request.Request(PEXELS.format(pid=pid), headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=60) as response:
        data = response.read()
    with open(path, "wb") as handle:
        handle.write(data)
    return path


def main(dry_run=False):
    products = Product.objects.all().order_by("name")
    print(f"Updating {products.count()} products")
    cache = {}

    for product in products:
        kind = classify(product.slug)
        if kind not in PHOTOS:
            kind = "tee"
        if kind not in cache:
            path = fetch_photo(kind, dry_run=dry_run)
            cache[kind] = (path, PHOTOS[kind][1])
        path, rect = cache[kind]
        if not path:
            print(f"  {product.slug:28s} -> {kind:14s} (skipped, dry run)")
            continue

        with Image.open(path) as photo:
            width, height = photo.size
        data = open(path, "rb").read()
        name = f"real-{product.slug}.jpg"
        fx1, fy1, fx2, fy2 = rect
        area_x = int(fx1 * width)
        area_y = int(fy1 * height)
        area_w = int((fx2 - fx1) * width)
        area_h = int((fy2 - fy1) * height)
        print(f"  {product.slug:28s} -> {kind:14s} {width}x{height}")

        if dry_run:
            continue

        product.image.save(name, ContentFile(data), save=True)

        for stage in product.stages.all():
            stage.mockup_image.save(name, ContentFile(data), save=False)
            stage.mockup_width = width
            stage.mockup_height = height
            stage.save()

            area = stage.print_area
            if area:
                area.mockup_x = area_x
                area.mockup_y = area_y
                area.mockup_width = area_w
                area.mockup_height = area_h
                area.width_mm = Decimal("200.00")
                area.height_mm = (Decimal("200.00") * Decimal(area_h) / Decimal(area_w)).quantize(Decimal("0.01"))
                area.save()

    if not dry_run:
        for gallery in ProductImage.objects.select_related("product"):
            path, _ = cache.get(classify(gallery.product.slug), (None, None))
            if not path:
                continue
            data = open(path, "rb").read()
            gallery.image.save(f"real-{gallery.product.slug}.jpg", ContentFile(data), save=True)

    print("Done." if not dry_run else "Dry run complete.")


if __name__ == "__main__":
    main(dry_run="--dry-run" in sys.argv)
