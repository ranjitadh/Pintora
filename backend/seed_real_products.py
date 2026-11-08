"""
Seed real product images from the Printora product assets zip file.
Run with: cd backend && .venv/bin/python seed_real_products.py
"""
import django
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from catalog.models import ProductCategory, Product, ProductVariant, ProductImage
from catalog.models import PrintingMethod, ProductStage, PrintArea, ProductPrintingMethod
from django.core.files.base import ContentFile
from django.contrib.auth import get_user_model
from django.utils.text import slugify
from decimal import Decimal

MEDIA_PRODUCTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "media", "products")
os.makedirs(MEDIA_PRODUCTS_DIR, exist_ok=True)


# Product data from the zip file catalog
PRODUCTS = [
    {
        "slug": "ceramic-mug",
        "name": "Ceramic Mug",
        "category": "Drinkware",
        "short_description": "Personalized ceramic mug with a smooth finish.",
        "description": "High-quality ceramic mug with a smooth finish, ideal for personalized artwork and everyday use.",
        "base_price": Decimal("16.90"),
        "image_file": "ceramic-mug.jpg",
        "variants": [("11 oz", Decimal("0.00")), ("15 oz", Decimal("3.00"))],
    },
    {
        "slug": "canvas-tote-bag",
        "name": "Canvas Tote Bag",
        "category": "Bags",
        "short_description": "Reusable canvas tote for everyday use.",
        "description": "Reusable cotton-look canvas tote bag with a spacious main compartment and a printable front area.",
        "base_price": Decimal("19.90"),
        "image_file": "canvas-tote-bag.jpg",
        "variants": [("Natural", Decimal("0.00")), ("Black", Decimal("3.00"))],
    },
    {
        "slug": "classic-t-shirt",
        "name": "Classic T-Shirt",
        "category": "Apparel",
        "short_description": "Soft, comfortable everyday cotton t-shirt.",
        "description": "Soft everyday cotton t-shirt with a comfortable regular fit and a front printable area.",
        "base_price": Decimal("24.90"),
        "image_file": "classic-t-shirt.jpg",
        "variants": [("S", Decimal("0.00")), ("M", Decimal("0.00")), ("L", Decimal("2.00")), ("XL", Decimal("4.00")), ("XXL", Decimal("6.00"))],
    },
    {
        "slug": "premium-hoodie",
        "name": "Premium Hoodie",
        "category": "Apparel",
        "short_description": "A cozy hoodie for all-season styling.",
        "description": "Cozy pullover hoodie with a front pouch pocket and a large chest print area.",
        "base_price": Decimal("54.90"),
        "image_file": "premium-hoodie.jpg",
        "variants": [("S", Decimal("0.00")), ("M", Decimal("2.00")), ("L", Decimal("4.00")), ("XL", Decimal("6.00")), ("XXL", Decimal("8.00"))],
    },
    {
        "slug": "phone-case",
        "name": "Phone Case",
        "category": "Accessories",
        "short_description": "Protective case with a customizable back.",
        "description": "Protective phone case with a smooth printable back surface for custom artwork.",
        "base_price": Decimal("22.90"),
        "image_file": "phone-case.jpg",
        "variants": [("iPhone models", Decimal("0.00")), ("Samsung models", Decimal("0.00"))],
    },
    {
        "slug": "botanical-art-poster",
        "name": "Botanical Art Poster",
        "category": "Wall Art",
        "short_description": "Botanical-inspired premium art poster.",
        "description": "Premium art poster featuring a botanical-inspired visual, suitable for home or office decor.",
        "base_price": Decimal("29.90"),
        "image_file": "botanical-art-poster.jpg",
        "variants": [("A4", Decimal("0.00")), ("A3", Decimal("8.00")), ("A2", Decimal("12.00"))],
    },
    {
        "slug": "coastal-canvas-print",
        "name": "Coastal Canvas Print",
        "category": "Wall Art",
        "short_description": "Coastal landscape canvas wall art.",
        "description": "Gallery-style canvas wall print featuring a coastal landscape, designed for home or office display.",
        "base_price": Decimal("39.90"),
        "image_file": "coastal-canvas-print.jpg",
        "variants": [("12x16 in", Decimal("0.00")), ("16x20 in", Decimal("12.00")), ("24x36 in", Decimal("24.00"))],
    },
    {
        "slug": "decorative-pillow",
        "name": "Decorative Pillow",
        "category": "Home & Living",
        "short_description": "Soft decorative pillow for a cozy home.",
        "description": "Soft decorative cushion cover with a printable front panel for personalized home accents.",
        "base_price": Decimal("26.90"),
        "image_file": "decorative-pillow.jpg",
        "variants": [("16x16 in", Decimal("0.00")), ("18x18 in", Decimal("4.00")), ("20x20 in", Decimal("8.00"))],
    },
]

PRINTING_METHODS = [
    ("Sublimation", Decimal("0.00"), Decimal("0.00")),
    ("UV Print", Decimal("1.50"), Decimal("0.00")),
    ("Screen Print", Decimal("2.00"), Decimal("0.50")),
    ("DTG Print", Decimal("3.00"), Decimal("0.00")),
]

def main():
    User = get_user_model()
    admin_user = User.objects.filter(role="admin").first() or User.objects.filter(is_superuser=True).first()
    if not admin_user:
        admin_user = User.objects.create_superuser(
            email="admin@printora.local",
            password="change-this-admin-password",
            first_name="Printora",
            last_name="Admin",
        )

    # Ensure categories exist
    categories = {}
    for cat_name in ["Apparel", "Drinkware", "Bags", "Accessories", "Wall Art", "Home & Living"]:
        cat, created = ProductCategory.objects.get_or_create(
            name=cat_name,
            defaults={"slug": cat_name.lower().replace(" ", "-"), "description": f"{cat_name} products"},
        )
        categories[cat_name] = cat
        if created:
            print(f"  Created category: {cat_name}")

    # Ensure printing methods exist
    methods = {}
    for name, base_fee, per_area_fee in PRINTING_METHODS:
        method, _ = PrintingMethod.objects.get_or_create(
            name=name,
            defaults={"slug": slugify(name), "description": f"{name} printing method",
                      "base_fee": base_fee, "per_area_fee": per_area_fee, "sort_order": 0},
        )
        methods[name] = method

    created_count = 0
    updated_count = 0

    for pdata in PRODUCTS:
        category = categories[pdata["category"]]

        # Check if product exists
        product, created = Product.objects.get_or_create(
            slug=pdata["slug"],
            defaults={
                "name": pdata["name"],
                "short_description": pdata["short_description"],
                "description": pdata["description"],
                "base_price": pdata["base_price"],
                "currency": "USD",
                "category": category,
                "is_active": True,
                "is_featured": created_count < 6,
                "quantity_discounts": [
                    {"min_qty": 5, "percent": "5.00"},
                    {"min_qty": 10, "percent": "10.00"},
                    {"min_qty": 25, "percent": "15.00"},
                ],
                "created_by": admin_user,
            }
        )

        if not created:
            # Update existing product
            product.name = pdata["name"]
            product.short_description = pdata["short_description"]
            product.description = pdata["description"]
            product.base_price = pdata["base_price"]
            product.category = category
            product.is_active = True
            product.save()
            updated_count += 1
            print(f"  Updated product: {product.name}")
        else:
            created_count += 1
            print(f"  Created product: {product.name}")

        # Set the real image
        image_path = os.path.join(MEDIA_PRODUCTS_DIR, pdata["image_file"])
        if os.path.exists(image_path):
            with open(image_path, "rb") as f:
                product.image.save(f"{slugify(product.name)}.jpg", ContentFile(f.read()), save=True)
            print(f"    Image set: {pdata['image_file']}")
        else:
            print(f"    WARNING: Image not found: {image_path}")

        # Create or update stage and print area
        stage, _ = ProductStage.objects.get_or_create(
            product=product,
            name="Front",
            defaults={"slug": "front", "mockup_width": 1200, "mockup_height": 1200, "sort_order": 1, "is_active": True},
        )

        print_area, _ = PrintArea.objects.get_or_create(
            stage=stage,
            defaults={
                "name": "Front Print Area",
                "width_mm": "200",
                "height_mm": "200",
                "mockup_x": 300,
                "mockup_y": 300,
                "mockup_width": 600,
                "mockup_height": 600,
                "safe_area_mm": "5",
                "bleed_mm": "3",
                "editor_dpi": 150,
                "export_dpi": 300,
                "min_dpi": 150,
                "grid_mm": 10,
                "shape": "rectangle",
            }
        )
        stage.print_area = print_area
        stage.save()

        # Create variants
        for variant_name, price_delta in pdata["variants"]:
            ProductVariant.objects.get_or_create(
                product=product,
                name=variant_name,
                defaults={
                    "sku": f"{slugify(product.name)}-{slugify(variant_name)}-{uuid.uuid4().hex[:8]}",
                    "color_name": variant_name,
                    "color_hex": "#FFFFFF",
                    "size": "One Size",
                    "price_delta": price_delta,
                    "stock_quantity": 100,
                    "is_active": True,
                    "sort_order": 0,
                }
            )

        # Link printing methods
        for method_name, base_fee, per_area_fee in PRINTING_METHODS:
            ProductPrintingMethod.objects.get_or_create(
                product=product,
                printing_method=methods[method_name],
                defaults={"price_adjustment": Decimal("0.00"), "is_default": (method_name == "Sublimation")},
            )

    print(f"\n{'='*50}")
    print(f"Successfully created {created_count} new products, updated {updated_count} existing products!")
    print(f"Total products: {Product.objects.count()}")
    print(f"Images in {MEDIA_PRODUCTS_DIR}")

if __name__ == "__main__":
    main()