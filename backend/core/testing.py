"""Shared helpers for the Printora backend test suite."""
import shutil
import tempfile
from decimal import Decimal

from django.test import override_settings
from PIL import Image
from rest_framework.test import APITestCase

from accounts.models import User, UserProfile
from catalog.models import (
    PrintArea,
    PrintingMethod,
    Product,
    ProductCategory,
    ProductPrintingMethod,
    ProductStage,
    ProductVariant,
)

TEST_PASSWORD = "Br1ghtStudio!42"


def make_user(email="customer@example.com", role="customer", password=TEST_PASSWORD, **extra):
    user = User.objects.create_user(
        username=email, email=email, password=password, role=role, **extra
    )
    UserProfile.objects.get_or_create(user=user)
    return user


def make_product(slug="test-tee", *, name="Test Tee", price="20.00", discounts=None):
    category, _ = ProductCategory.objects.get_or_create(
        name="Test Apparel", defaults={"description": "Test category"}
    )
    product = Product.objects.create(
        category=category,
        name=name,
        slug=slug,
        short_description="A test product",
        description="A product created for tests.",
        base_price=Decimal(price),
        quantity_discounts=discounts or [],
    )
    area = PrintArea.objects.create(
        name=f"{name} print area",
        width_mm=Decimal("305"),
        height_mm=Decimal("406"),
        mockup_x=360,
        mockup_y=340,
        mockup_width=300,
        mockup_height=400,
        editor_dpi=150,
        export_dpi=300,
    )
    stage = ProductStage.objects.create(
        product=product,
        name="Front",
        slug="front",
        print_area=area,
        mockup_width=1000,
        mockup_height=1200,
    )
    variant = ProductVariant.objects.create(
        product=product, name="Black / M", sku="TEST-BLK-M", color_name="Black", size="M",
        price_delta=Decimal("2.00"),
    )
    method, _ = PrintingMethod.objects.get_or_create(
        slug="test-print",
        defaults={"name": "Test Print", "base_fee": Decimal("1.00"), "per_area_fee": Decimal("0.00")},
    )
    ProductPrintingMethod.objects.create(product=product, printing_method=method, is_default=True)
    return product, stage, area, variant, method


def design_payload(stage, text="Hello"):
    return {
        "stages": {
            str(stage.id): {
                "version": "5.3.0",
                "width": stage.print_area.width_px,
                "height": stage.print_area.height_px,
                "objects": [
                    {
                        "type": "textbox",
                        "version": "5.3.0",
                        "originX": "center",
                        "originY": "center",
                        "left": stage.print_area.width_px / 2,
                        "top": stage.print_area.height_px / 2,
                        "width": 800,
                        "text": text,
                        "fontSize": 80,
                        "fontFamily": "Inter",
                        "fontWeight": "bold",
                        "textAlign": "center",
                        "fill": "#111111",
                        "lineHeight": 1.16,
                        "scaleX": 1,
                        "scaleY": 1,
                        "angle": 0,
                        "opacity": 1,
                    }
                ],
            }
        },
        "activeStage": str(stage.id),
    }


def png_upload(name="upload.png", size=(320, 240), color=(120, 180, 200)):
    import io

    image = Image.new("RGB", size, color)
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


class TempMediaTestCase(APITestCase):
    @classmethod
    def setUpClass(cls):
        cls._media_dir = tempfile.mkdtemp(prefix="printora-test-media-")
        cls._media_override = override_settings(MEDIA_ROOT=cls._media_dir)
        cls._media_override.enable()
        super().setUpClass()

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        cls._media_override.disable()
        shutil.rmtree(cls._media_dir, ignore_errors=True)
