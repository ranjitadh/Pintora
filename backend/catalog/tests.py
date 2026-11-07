from decimal import Decimal

from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase

from catalog.models import PrintingMethod, Product, ProductStage
from core.testing import TempMediaTestCase, make_product, make_user, png_upload


class CatalogApiTests(TempMediaTestCase):
    def setUp(self):
        self.product, self.stage, self.area, self.variant, self.method = make_product()
        self.admin = make_user(email="admin@example.com", role="admin")
        self.customer = make_user(email="customer@example.com")

    def test_public_product_list_and_filters(self):
        second, _stage, _area, _variant, _method = make_product(
            slug="second-product", name="Second Product", price="30.00"
        )
        second.is_featured = True
        second.save(update_fields=["is_featured"])
        self.product.is_featured = True
        self.product.save(update_fields=["is_featured"])

        response = self.client.get("/api/products/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 2)

        filtered = self.client.get("/api/products/?search=Second")
        self.assertEqual(filtered.data["count"], 1)
        self.assertEqual(filtered.data["results"][0]["slug"], "second-product")

        featured = self.client.get("/api/products/?featured=1&sort=price_asc")
        self.assertEqual(featured.data["count"], 2)
        self.assertEqual(featured.data["results"][0]["slug"], self.product.slug)

        by_category = self.client.get("/api/products/?category=test-apparel")
        self.assertEqual(by_category.data["count"], 2)

    def test_product_detail_includes_variants_stages_and_printing_methods(self):
        response = self.client.get(f"/api/products/{self.product.slug}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "Test Tee")
        self.assertEqual(len(response.data["variants"]), 1)
        self.assertEqual(response.data["variants"][0]["size"], "M")
        self.assertEqual(len(response.data["stages"]), 1)
        self.assertEqual(response.data["stages"][0]["print_area"]["width_mm"], "305.00")
        self.assertEqual(len(response.data["printing_methods"]), 1)
        self.assertEqual(response.data["printing_methods"][0]["printing_method"]["name"], "Test Print")

    def test_categories_and_printing_methods_are_public(self):
        categories = self.client.get("/api/categories/")
        self.assertEqual(categories.status_code, status.HTTP_200_OK)
        self.assertEqual(categories.data[0]["product_count"], 1)

        methods = self.client.get("/api/printing-methods/")
        self.assertEqual(methods.status_code, status.HTTP_200_OK)
        self.assertEqual(methods.data[0]["name"], "Test Print")

    def test_admin_can_create_and_update_products(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            "/api/admin/products/",
            {
                "name": "Admin Created Tee",
                "short_description": "Created over the API",
                "base_price": "24.00",
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        product_id = response.data["id"]
        self.assertTrue(Product.objects.filter(pk=product_id).exists())

        patched = self.client.patch(
            f"/api/admin/products/{product_id}/",
            {"base_price": "26.50", "is_featured": True},
            format="json",
        )
        self.assertEqual(patched.status_code, status.HTTP_200_OK)
        self.assertEqual(patched.data["base_price"], "26.50")
        self.assertTrue(patched.data["is_featured"])

    def test_admin_can_create_stage_with_print_area(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            f"/api/admin/products/{self.product.id}/stages/",
            {
                "name": "Back",
                "sort_order": 2,
                "print_area_data": {
                    "name": "Back print area",
                    "width_mm": "280.00",
                    "height_mm": "350.00",
                    "mockup_x": 360,
                    "mockup_y": 360,
                    "mockup_width": 288,
                    "mockup_height": 360,
                },
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "Back")
        stage = ProductStage.objects.get(pk=response.data["id"])
        self.assertEqual(stage.print_area.width_mm, Decimal("280.00"))

    def test_customer_cannot_access_admin_endpoints(self):
        self.client.force_authenticate(self.customer)
        response = self.client.post(
            "/api/admin/products/", {"name": "Nope", "base_price": "1.00"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Product.objects.filter(name="Nope").exists())

    def test_admin_can_manage_gallery_and_cover(self):
        self.client.force_authenticate(self.admin)
        created = self.client.post(
            f"/api/admin/products/{self.product.id}/images/",
            {"image": SimpleUploadedFile("gallery.png", png_upload(), content_type="image/png"), "alt": "Gallery shot", "sort_order": 1},
            format="multipart",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
        image_id = created.data["id"]
        self.assertTrue(created.data["url"])

        cover = self.client.post(
            f"/api/admin/products/{self.product.id}/set-cover/",
            {"image_id": image_id},
            format="json",
        )
        self.assertEqual(cover.status_code, status.HTTP_200_OK)
        self.assertTrue(cover.data["image_url"])

        removed = self.client.delete(
            f"/api/admin/products/{self.product.id}/images/{image_id}/"
        )
        self.assertEqual(removed.status_code, status.HTTP_204_NO_CONTENT)

    def test_admin_can_attach_and_remove_printing_methods(self):
        self.client.force_authenticate(self.admin)
        extra_method = PrintingMethod.objects.create(name="Embroidery", slug="embroidery")
        created = self.client.post(
            f"/api/admin/products/{self.product.id}/printing-methods/",
            {
                "printing_method": str(extra_method.id),
                "price_adjustment": "1.50",
                "is_default": False,
            },
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
        link_id = created.data["id"]

        links = self.client.get(f"/api/admin/products/{self.product.id}/printing-methods/")
        self.assertEqual(links.status_code, status.HTTP_200_OK)
        self.assertEqual(len(links.data), 2)
        self.assertEqual(links.data[-1]["price_adjustment"], "1.50")

        removed = self.client.delete(
            f"/api/admin/products/{self.product.id}/printing-methods/{link_id}/"
        )
        self.assertEqual(removed.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(
            len(self.client.get(f"/api/admin/products/{self.product.id}/printing-methods/").data),
            1,
        )

    def test_admin_can_create_category(self):
        self.client.force_authenticate(self.admin)
        created = self.client.post(
            "/api/admin/categories/",
            {"name": "Wall Art", "description": "Posters and prints", "is_active": True},
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
        self.assertEqual(created.data["slug"], "wall-art")
        patched = self.client.patch(
            f"/api/admin/categories/{created.data['id']}/", {"is_active": False}, format="json"
        )
        self.assertEqual(patched.status_code, status.HTTP_200_OK)
        self.assertFalse(patched.data["is_active"])

    def test_inactive_products_are_hidden(self):
        self.product.is_active = False
        self.product.save(update_fields=["is_active"])
        detail = self.client.get(f"/api/products/{self.product.slug}/")
        self.assertEqual(detail.status_code, status.HTTP_404_NOT_FOUND)

    def test_duplicate_printing_method_link_returns_400(self):
        """POSTing the same printing method to a product twice must return 400, not 500."""
        self.client.force_authenticate(self.admin)
        url = f"/api/admin/products/{self.product.id}/printing-methods/"

        # First link already exists from make_product() — posting again must be rejected
        response = self.client.post(url, {"printing_method": self.method.id}, format="json")
        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
            msg="Duplicate printing method link should return 400, not 500",
        )
        self.assertIn("already linked", response.data.get("detail", "").lower())

    def test_media_file_served_when_debug_false(self):
        from django.core.files.base import ContentFile
        from django.test import override_settings

        self.product.image.save("test-cover.png", ContentFile(b"test-png-content"))
        cover_url = self.product.image.url

        with override_settings(DEBUG=False, SERVE_MEDIA=True):
            response = self.client.get(cover_url)
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(b"".join(response.streaming_content), b"test-png-content")
