from rest_framework import status

from core.testing import TempMediaTestCase, design_payload, make_product, make_user, png_upload
from designer.models import Design, DesignAsset


class DesignerApiTests(TempMediaTestCase):
    def setUp(self):
        self.product, self.stage, self.area, self.variant, self.method = make_product()
        self.user = make_user(email="designer@example.com")
        self.other = make_user(email="other@example.com")
        self.client.force_authenticate(self.user)

    def _create_design(self, text="Hello Printora"):
        response = self.client.post(
            "/api/designs/",
            {
                "product": str(self.product.id),
                "stage": str(self.stage.id),
                "name": "My design",
                "canvas_json": design_payload(self.stage, text=text),
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return response

    def test_create_design_generates_version_and_preview(self):
        response = self._create_design()
        design = Design.objects.get(pk=response.data["id"])
        self.assertEqual(design.version, 1)
        self.assertEqual(design.user, self.user)
        self.assertEqual(design.versions.count(), 1)
        self.assertTrue(design.preview_image)
        self.assertEqual(response.data["status"], "saved")

    def test_create_design_accepts_plain_canvas_and_assigns_stage(self):
        canvas = design_payload(self.stage)["stages"][str(self.stage.id)]
        canvas["stageId"] = str(self.stage.id)
        response = self.client.post(
            "/api/designs/",
            {"product": str(self.product.id), "stage": str(self.stage.id), "canvas_json": canvas},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        design = Design.objects.get(pk=response.data["id"])
        self.assertIn(str(self.stage.id), design.canvas_json["stages"])

    def test_update_autosave_versions_and_restore(self):
        created = self._create_design(text="Version one")
        design_id = created.data["id"]

        updated = self.client.patch(
            f"/api/designs/{design_id}/",
            {
                "product": str(self.product.id),
                "stage": str(self.stage.id),
                "name": "Updated design",
                "canvas_json": design_payload(self.stage, text="Version two"),
            },
            format="json",
        )
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.assertEqual(updated.data["version"], 2)

        autosaved = self.client.post(
            f"/api/designs/{design_id}/autosave/",
            {"product": str(self.product.id), "canvas_json": design_payload(self.stage, text="Autosave")},
            format="json",
        )
        self.assertEqual(autosaved.status_code, status.HTTP_200_OK)
        self.assertEqual(autosaved.data["version"], 2)

        versions = self.client.get(f"/api/designs/{design_id}/versions/")
        self.assertEqual(versions.status_code, status.HTTP_200_OK)
        self.assertEqual(len(versions.data), 2)
        first_version_id = versions.data[-1]["id"]

        restored = self.client.post(
            f"/api/designs/{design_id}/versions/{first_version_id}/restore/", {}, format="json"
        )
        self.assertEqual(restored.status_code, status.HTTP_200_OK)
        self.assertEqual(restored.data["version"], 3)
        stage_key = str(self.stage.id)
        text = restored.data["canvas_json"]["stages"][stage_key]["objects"][0]["text"]
        self.assertEqual(text, "Version one")

    def test_duplicate_design(self):
        created = self._create_design()
        response = self.client.post(f"/api/designs/{created.data['id']}/duplicate/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotEqual(response.data["id"], created.data["id"])
        self.assertTrue(response.data["name"].startswith("Copy of"))

    def test_designs_are_private_to_owner(self):
        created = self._create_design()
        self.client.force_authenticate(self.other)
        blocked = self.client.get(f"/api/designs/{created.data['id']}/")
        self.assertEqual(blocked.status_code, status.HTTP_404_NOT_FOUND)
        listing = self.client.get("/api/designs/")
        self.assertEqual(listing.data["count"], 0)

    def test_design_rejects_inline_data_urls(self):
        payload = design_payload(self.stage)
        stage_canvas = payload["stages"][str(self.stage.id)]
        stage_canvas["objects"] = [
            {
                "type": "image",
                "src": "data:image/png;base64,AAAA",
                "left": 100,
                "top": 100,
                "width": 100,
                "height": 100,
                "scaleX": 1,
                "scaleY": 1,
                "angle": 0,
                "opacity": 1,
            }
        ]
        response = self.client.post(
            "/api/designs/",
            {"product": str(self.product.id), "canvas_json": payload},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("canvas_json", response.data["errors"])

    def test_png_upload_returns_dimensions(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        upload = SimpleUploadedFile("art.png", png_upload(), content_type="image/png")
        response = self.client.post("/api/uploads/", {"file": upload}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["width"], 320)
        self.assertEqual(response.data["height"], 240)
        self.assertEqual(response.data["mime_type"], "image/png")
        self.assertTrue(DesignAsset.objects.filter(pk=response.data["id"]).exists())

    def test_svg_upload_is_sanitized(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        svg = b"""<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100">
        <script>alert('xss')</script><rect x="0" y="0" width="200" height="100" fill="#123456"/>
        </svg>"""
        upload = SimpleUploadedFile("art.svg", svg, content_type="image/svg+xml")
        response = self.client.post("/api/uploads/", {"file": upload}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        asset = DesignAsset.objects.get(pk=response.data["id"])
        content = asset.file.read()
        self.assertNotIn(b"<script", content)
        self.assertIn(b"<svg", content)
        self.assertEqual(response.data["width"], 200)
        self.assertEqual(response.data["height"], 100)

    def test_invalid_upload_is_rejected(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        upload = SimpleUploadedFile("not-an-image.png", b"definitely not a png", content_type="image/png")
        response = self.client.post("/api/uploads/", {"file": upload}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_public_templates_and_cliparts(self):
        self.client.force_authenticate(user=None)
        templates = self.client.get("/api/templates/")
        self.assertEqual(templates.status_code, status.HTTP_200_OK)
        cliparts = self.client.get("/api/cliparts/")
        self.assertEqual(cliparts.status_code, status.HTTP_200_OK)
        self.client.force_authenticate(self.user)

    def test_admin_can_create_template_with_plain_canvas(self):
        admin = make_user(email="template-admin@example.com", role="admin")
        self.client.force_authenticate(admin)
        canvas = design_payload(self.stage)["stages"][str(self.stage.id)]
        response = self.client.post(
            "/api/admin/templates/",
            {
                "name": "Admin template",
                "category": "Test",
                "canvas_json": canvas,
                "price": "0.00",
                "visibility": "public",
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["slug"], "admin-template")
        self.assertTrue(response.data["preview_url"])

    def test_image_src_validation_accepts_relative_media_and_internal_docker_hosts(self):
        from designer.validation import DesignValidationError, validate_canvas

        stage_id = str(self.stage.id)

        # 1. Relative media URL is accepted
        canvas_relative = design_payload(self.stage)
        canvas_relative["stages"][stage_id]["objects"].append(
            {"type": "image", "src": "/media/uploads/user_1/photo.png", "width": 100, "height": 100}
        )
        validated = validate_canvas(canvas_relative)
        self.assertIsNotNone(validated)

        # 2. Docker internal host backend:8000 is accepted
        canvas_docker = design_payload(self.stage)
        canvas_docker["stages"][stage_id]["objects"].append(
            {"type": "image", "src": "http://backend:8000/media/uploads/user_1/photo.png", "width": 100, "height": 100}
        )
        validated = validate_canvas(canvas_docker)
        self.assertIsNotNone(validated)

        # 3. External unapproved host is rejected
        canvas_external = design_payload(self.stage)
        canvas_external["stages"][stage_id]["objects"].append(
            {"type": "image", "src": "https://malicious-site.com/media/exploit.png", "width": 100, "height": 100}
        )
        with self.assertRaises(DesignValidationError):
            validate_canvas(canvas_external)
