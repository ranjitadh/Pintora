import base64
import hashlib
import hmac
import json
from decimal import Decimal

from django.test import override_settings
from rest_framework import status

from catalog.models import PricingRule
from commerce.models import Cart, Order, StoreConfiguration, WebhookEvent
from core.testing import TempMediaTestCase, design_payload, make_product, make_user
from designer.models import Design


class CommerceApiTests(TempMediaTestCase):
    def setUp(self):
        self.product, self.stage, self.area, self.variant, self.method = make_product(
            discounts=[{"min_qty": 2, "percent": 5}, {"min_qty": 10, "percent": 10}]
        )
        PricingRule.objects.create(
            product=self.product,
            printing_method=self.method,
            rule_type=PricingRule.RuleType.PER_CHARACTER,
            amount=Decimal("0.10"),
        )
        config = StoreConfiguration.get_solo()
        config.shipping_fee = Decimal("4.95")
        config.tax_rate = Decimal("0")
        config.free_shipping_threshold = None
        config.demo_mode = True
        config.save()

        self.user = make_user(email="buyer@example.com")
        self.other = make_user(email="other@example.com")
        self.admin = make_user(email="admin@example.com", role="admin")
        self.design = Design.objects.create(
            user=self.user,
            product=self.product,
            stage=self.stage,
            name="Buyer artwork",
            canvas_json=design_payload(self.stage, text="Hello"),
            status=Design.Status.SAVED,
        )
        self.client.force_authenticate(self.user)

    def _add_item(self, quantity=2, design=None):
        return self.client.post(
            "/api/cart/items/",
            {
                "product": str(self.product.id),
                "variant": str(self.variant.id),
                "design": str((design or self.design).id),
                "printing_method": str(self.method.id),
                "quantity": quantity,
            },
            format="json",
        )

    def _checkout(self):
        return self.client.post(
            "/api/orders/",
            {
                "shipping_name": "Buyer Name",
                "shipping_address": "1 Main Street",
                "shipping_city": "Portland",
                "shipping_postal_code": "97205",
                "shipping_country": "United States",
                "demo": True,
            },
            format="json",
        )

    def test_pricing_quote_is_server_authoritative(self):
        response = self.client.post(
            "/api/pricing/",
            {
                "product": str(self.product.id),
                "variant": str(self.variant.id),
                "design": str(self.design.id),
                "printing_method": str(self.method.id),
                "quantity": 2,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["unit_price"], "23.50")
        self.assertEqual(response.data["subtotal"], "47.00")
        self.assertEqual(response.data["discount"], "2.35")
        self.assertEqual(response.data["total"], "44.65")
        self.assertEqual(response.data["design_stats"]["characters"], 5)

    def test_pricing_requires_access_to_design(self):
        self.client.force_authenticate(self.other)
        response = self.client.post(
            "/api/pricing/",
            {"product": str(self.product.id), "design": str(self.design.id), "quantity": 1},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_cart_add_list_update_and_remove(self):
        added = self._add_item(quantity=2)
        self.assertEqual(added.status_code, status.HTTP_201_CREATED, added.data)
        self.assertEqual(added.data["item_count"], 2)
        self.assertEqual(added.data["totals"]["subtotal"], "47.00")
        self.assertEqual(added.data["totals"]["discount"], "2.35")
        self.assertEqual(added.data["totals"]["shipping"], "4.95")
        self.assertEqual(added.data["totals"]["total"], "49.60")

        cart = self.client.get("/api/cart/")
        self.assertEqual(cart.status_code, status.HTTP_200_OK)
        item_id = cart.data["items"][0]["id"]

        patched = self.client.patch(f"/api/cart/items/{item_id}/", {"quantity": 3}, format="json")
        self.assertEqual(patched.status_code, status.HTTP_200_OK)
        self.assertEqual(patched.data["item_count"], 3)

        removed = self.client.delete(f"/api/cart/items/{item_id}/")
        self.assertEqual(removed.status_code, status.HTTP_200_OK)
        self.assertEqual(removed.data["item_count"], 0)

    def test_cart_rejects_design_owned_by_another_user(self):
        foreign_design = Design.objects.create(
            user=self.other,
            product=self.product,
            stage=self.stage,
            name="Not yours",
            canvas_json=design_payload(self.stage),
        )
        response = self._add_item(design=foreign_design)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_checkout_creates_order_and_converts_cart(self):
        self._add_item(quantity=2)
        response = self._checkout()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        order = Order.objects.get(pk=response.data["id"])
        self.assertEqual(order.status, Order.Status.PAID)
        self.assertEqual(order.payment_status, Order.PaymentStatus.DEMO)
        self.assertEqual(order.subtotal, Decimal("47.00"))
        self.assertEqual(order.discount, Decimal("2.35"))
        self.assertEqual(order.shipping, Decimal("4.95"))
        self.assertEqual(order.total, Decimal("49.60"))
        self.assertEqual(order.items.count(), 1)
        self.assertEqual(order.items.first().product_name, self.product.name)
        self.assertEqual(Cart.objects.get(user=self.user).status, Cart.Status.CONVERTED)

        listing = self.client.get("/api/orders/")
        self.assertEqual(listing.data["count"], 1)

    def test_empty_cart_cannot_checkout(self):
        response = self._checkout()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_customer_cannot_read_another_customers_order(self):
        self._add_item()
        order_id = self._checkout().data["id"]
        self.client.force_authenticate(self.other)
        response = self.client.get(f"/api/orders/{order_id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_admin_order_management_and_dashboard(self):
        self._add_item()
        order_id = self._checkout().data["id"]

        self.client.force_authenticate(self.admin)
        listing = self.client.get("/api/admin/orders/")
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        self.assertEqual(listing.data["count"], 1)

        patched = self.client.patch(
            f"/api/admin/orders/{order_id}/", {"status": "processing"}, format="json"
        )
        self.assertEqual(patched.status_code, status.HTTP_200_OK)
        self.assertEqual(patched.data["status"], "processing")

        dashboard = self.client.get("/api/admin/dashboard/")
        self.assertEqual(dashboard.status_code, status.HTTP_200_OK)
        self.assertEqual(dashboard.data["orders"], 1)
        self.assertEqual(len(dashboard.data["recent_orders"]), 1)

        self.client.force_authenticate(self.user)
        denied = self.client.get("/api/admin/dashboard/")
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

    def test_store_config_is_public_and_admin_updatable(self):
        public = self.client.get("/api/store/config/")
        self.assertEqual(public.status_code, status.HTTP_200_OK)
        self.assertEqual(public.data["currency"], "USD")

        self.client.force_authenticate(self.admin)
        patched = self.client.patch(
            "/api/admin/store/config/", {"announcement": "New drop", "shipping_fee": "5.50"}, format="json"
        )
        self.assertEqual(patched.status_code, status.HTTP_200_OK)
        self.assertEqual(patched.data["announcement"], "New drop")
        self.assertEqual(patched.data["shipping_fee"], "5.50")

    @override_settings(SHOPIFY_WEBHOOK_SECRET="test-webhook-secret")
    def test_shopify_webhook_verifies_signature_and_deduplicates(self):
        order = Order.objects.create(
            user=self.user, number="PR-TEST-WEBHOOK", status=Order.Status.PENDING,
            payment_status=Order.PaymentStatus.UNPAID,
        )
        payload = {
            "id": 991122,
            "name": "#1001",
            "note_attributes": [{"name": "printora_order_number", "value": order.number}],
        }
        body = json.dumps(payload).encode()
        digest = base64.b64encode(
            hmac.new(b"test-webhook-secret", body, hashlib.sha256).digest()
        ).decode()
        headers = {
            "HTTP_X_SHOPIFY_HMAC_SHA256": digest,
            "HTTP_X_SHOPIFY_TOPIC": "orders/paid",
            "HTTP_X_SHOPIFY_WEBHOOK_ID": "wh-test-1",
        }
        response = self.client.post(
            "/api/shopify/webhooks/", data=body, content_type="application/json", **headers
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        order.refresh_from_db()
        self.assertEqual(order.payment_status, Order.PaymentStatus.PAID)
        self.assertEqual(order.status, Order.Status.PROCESSING)

        duplicate = self.client.post(
            "/api/shopify/webhooks/", data=body, content_type="application/json", **headers
        )
        self.assertEqual(duplicate.status_code, status.HTTP_200_OK)
        self.assertEqual(duplicate.data["status"], "duplicate_ignored")
        self.assertEqual(WebhookEvent.objects.count(), 1)

    def test_shopify_webhook_rejects_invalid_signature(self):
        response = self.client.post(
            "/api/shopify/webhooks/",
            data=b"{}",
            content_type="application/json",
            HTTP_X_SHOPIFY_HMAC_SHA256="invalid",
            HTTP_X_SHOPIFY_TOPIC="orders/paid",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # ------------------------------------------------------------------ #
    # Stock validation & cart-deduplication tests                          #
    # ------------------------------------------------------------------ #

    def test_adding_same_item_twice_merges_into_single_line(self):
        """Adding the identical product+variant+design+method twice must merge into 1 cart line."""
        first = self._add_item(quantity=1)
        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.data)

        second = self._add_item(quantity=1)
        self.assertEqual(second.status_code, status.HTTP_200_OK, second.data)

        cart = self.client.get("/api/cart/")
        self.assertEqual(cart.status_code, status.HTTP_200_OK)
        self.assertEqual(len(cart.data["items"]), 1, "Expected exactly 1 cart line after merging duplicates")
        self.assertEqual(cart.data["items"][0]["quantity"], 2, "Merged line should have quantity 2")

    def test_cart_rejects_out_of_stock_variant(self):
        """Adding a variant with stock_quantity=0 must return 400."""
        self.variant.stock_quantity = 0
        self.variant.save(update_fields=["stock_quantity"])

        response = self._add_item(quantity=1)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("out of stock", response.data.get("detail", "").lower())

    def test_cart_rejects_quantity_exceeding_stock(self):
        """Adding more items than available stock must return 400."""
        self.variant.stock_quantity = 3
        self.variant.save(update_fields=["stock_quantity"])

        response = self._add_item(quantity=5)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("only 3 available", response.data.get("detail", "").lower())

    def test_checkout_decrements_stock(self):
        """Completing checkout must reduce the variant's stock_quantity by the ordered amount."""
        self.variant.stock_quantity = 100
        self.variant.save(update_fields=["stock_quantity"])

        self._add_item(quantity=3)
        response = self._checkout()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock_quantity, 97)

    def test_checkout_rejects_insufficient_stock(self):
        """If stock drops below cart quantity before checkout, must return 400 with a clear error."""
        self._add_item(quantity=5)

        # Simulate stock being sold out between add-to-cart and checkout
        self.variant.stock_quantity = 2
        self.variant.save(update_fields=["stock_quantity"])

        response = self._checkout()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("insufficient stock", response.data.get("detail", "").lower())
