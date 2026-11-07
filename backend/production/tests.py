from rest_framework import status

from core.testing import TempMediaTestCase, design_payload, make_product, make_user
from designer.models import Design
from production.models import GeneratedFile
from production.render import render_canvas


class ProductionApiTests(TempMediaTestCase):
    def setUp(self):
        self.product, self.stage, self.area, self.variant, self.method = make_product()
        self.user = make_user(email="creator@example.com")
        self.other = make_user(email="other@example.com")
        self.admin = make_user(email="admin@example.com", role="admin")
        self.design = Design.objects.create(
            user=self.user,
            product=self.product,
            stage=self.stage,
            name="Production design",
            canvas_json=design_payload(self.stage, text="Print me"),
            status=Design.Status.SAVED,
        )

    def test_render_canvas_draws_objects_and_warns_on_paths(self):
        canvas = {
            "width": 600,
            "height": 800,
            "objects": [
                {
                    "type": "rect", "originX": "center", "originY": "center",
                    "left": 300, "top": 300, "width": 240, "height": 160,
                    "fill": "#d95d39", "angle": 0, "opacity": 1, "scaleX": 1, "scaleY": 1,
                },
                {
                    "type": "text", "originX": "center", "originY": "center",
                    "left": 300, "top": 520, "text": "Printora", "fontSize": 64,
                    "fontFamily": "Inter", "fontWeight": "bold", "fill": "#111111",
                    "angle": 0, "opacity": 1, "scaleX": 1, "scaleY": 1,
                },
                {"type": "path", "path": [["M", 0, 0], ["L", 10, 10]]},
            ],
        }
        image, warnings_list = render_canvas(canvas, 300)
        self.assertEqual(image.size, (300, 400))
        self.assertTrue(any("path" in warning.lower() for warning in warnings_list))
        self.assertIsNotNone(image.getbbox())

    def test_customer_export_is_png_and_dpi_capped(self):
        self.client.force_authenticate(self.user)
        response = self.client.post(
            "/api/exports/create/",
            {"design": str(self.design.id), "stage": str(self.stage.id), "file_type": "png", "dpi": 600},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["status"], "completed")
        self.assertEqual(response.data["file_type"], "png")
        self.assertEqual(response.data["dpi"], 150)
        self.assertEqual(response.data["width_px"], 1801)
        self.assertTrue(response.data["url"])
        generated = GeneratedFile.objects.get(pk=response.data["id"])
        self.assertTrue(generated.file)
        with generated.file.open("rb") as handle:
            self.assertEqual(handle.read(8), b"\x89PNG\r\n\x1a\n")

    def test_customer_cannot_export_svg(self):
        self.client.force_authenticate(self.user)
        response = self.client.post(
            "/api/exports/create/",
            {"design": str(self.design.id), "file_type": "svg", "dpi": 300},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_export_svg_and_pdf(self):
        self.client.force_authenticate(self.admin)
        svg = self.client.post(
            "/api/exports/create/",
            {"design": str(self.design.id), "stage": str(self.stage.id), "file_type": "svg", "dpi": 300},
            format="json",
        )
        self.assertEqual(svg.status_code, status.HTTP_201_CREATED, svg.data)
        self.assertEqual(svg.data["status"], "completed")
        generated = GeneratedFile.objects.get(pk=svg.data["id"])
        with generated.file.open("rb") as handle:
            content = handle.read()
        self.assertIn(b"<svg", content)
        self.assertIn(b"</svg>", content)

        pdf = self.client.post(
            "/api/exports/create/",
            {"design": str(self.design.id), "stage": str(self.stage.id), "file_type": "pdf", "dpi": 300},
            format="json",
        )
        self.assertEqual(pdf.status_code, status.HTTP_201_CREATED, pdf.data)
        generated = GeneratedFile.objects.get(pk=pdf.data["id"])
        with generated.file.open("rb") as handle:
            self.assertTrue(handle.read(5).startswith(b"%PDF"))

    def test_customer_cannot_export_another_users_design(self):
        self.client.force_authenticate(self.other)
        response = self.client.post(
            "/api/exports/create/",
            {"design": str(self.design.id), "file_type": "png"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        listed = self.client.get("/api/exports/")
        self.assertEqual(listed.data["count"], 0)

    def test_export_listing_is_scoped_to_owner(self):
        self.client.force_authenticate(self.user)
        created = self.client.post(
            "/api/exports/create/",
            {"design": str(self.design.id), "file_type": "png", "dpi": 150},
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        listed = self.client.get(f"/api/exports/?design={self.design.id}")
        self.assertEqual(listed.data["count"], 1)

        self.client.force_authenticate(self.admin)
        admin_list = self.client.get("/api/exports/")
        self.assertEqual(admin_list.data["count"], 1)

    def test_export_requires_stage(self):
        self.stage.print_area = None
        self.stage.save(update_fields=["print_area"])
        self.client.force_authenticate(self.user)
        response = self.client.post(
            "/api/exports/create/",
            {"design": str(self.design.id), "file_type": "png"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_svg_export_renders_path_elements(self):
        """Valid Fabric path objects must become real SVG <path> elements."""
        path_canvas = {
            "version": "5.3.0",
            "width": self.area.width_px,
            "height": self.area.height_px,
            "objects": [
                {
                    "type": "path",
                    "left": 100,
                    "top": 100,
                    "width": 200,
                    "height": 200,
                    "fill": "#d95d39",
                    "stroke": "#111111",
                    "strokeWidth": 2,
                    "opacity": 1,
                    "scaleX": 1,
                    "scaleY": 1,
                    "angle": 0,
                    "path": [
                        ["M", 0, 0],
                        ["L", 150, 50],
                        ["L", 150, 150],
                        ["z"],
                    ],
                },
            ],
        }
        design = Design.objects.create(
            user=self.admin,
            product=self.product,
            stage=self.stage,
            name="Path design",
            canvas_json={"stages": {str(self.stage.id): path_canvas}, "activeStage": str(self.stage.id)},
            status=Design.Status.SAVED,
        )
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            "/api/exports/create/",
            {"design": str(design.id), "stage": str(self.stage.id), "file_type": "svg", "dpi": 300},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        generated = GeneratedFile.objects.get(pk=response.data["id"])
        with generated.file.open("rb") as handle:
            content = handle.read()
        self.assertIn(b"<svg", content)
        self.assertIn(b"<path ", content)
        self.assertIn(b"d=\"", content)
        self.assertNotIn(b"<!-- path object preserved", content)

    def test_svg_export_handles_multiple_and_stroked_paths(self):
        """Multiple paths, fills, strokes and transforms must all serialize."""
        path_canvas = {
            "version": "5.3.0",
            "width": self.area.width_px,
            "height": self.area.height_px,
            "objects": [
                {
                    "type": "path",
                    "left": 50,
                    "top": 50,
                    "fill": "#ffffff",
                    "stroke": "#000000",
                    "strokeWidth": 4,
                    "scaleX": 1,
                    "scaleY": 1,
                    "angle": 0,
                    "opacity": 1,
                    "path": [["M", 10, 10], ["L", 90, 90], ["z"]],
                },
                {
                    "type": "path",
                    "left": 150,
                    "top": 150,
                    "fill": "transparent",
                    "stroke": "#d95d39",
                    "strokeWidth": 1,
                    "scaleX": 2,
                    "scaleY": 2,
                    "angle": 45,
                    "opacity": 0.5,
                    "path": [["M", 0, 0], ["C", 10, 10, 20, 20, 30, 30], ["z"]],
                },
            ],
        }
        design = Design.objects.create(
            user=self.admin,
            product=self.product,
            stage=self.stage,
            name="Multi path design",
            canvas_json={"stages": {str(self.stage.id): path_canvas}, "activeStage": str(self.stage.id)},
            status=Design.Status.SAVED,
        )
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            "/api/exports/create/",
            {"design": str(design.id), "stage": str(self.stage.id), "file_type": "svg", "dpi": 300},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        generated = GeneratedFile.objects.get(pk=response.data["id"])
        with generated.file.open("rb") as content_handle:
            content = content_handle.read()
        self.assertEqual(content.count(b"<path "), 2)
        self.assertIn(b'stroke="#000000"', content)
        self.assertIn(b'stroke="#d95d39"', content)
        self.assertIn(b'fill="#ffffff"', content)
        self.assertIn(b'opacity="0.5"', content)
