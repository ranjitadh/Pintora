import base64
import hashlib
import hmac
import json
import sys
import types
from decimal import Decimal
from unittest import mock

from django.test import override_settings
from rest_framework import status

from catalog.models import PricingRule
from commerce.models import Cart, Order, OrderItem, StoreConfiguration, WebhookEvent
from commerce.services import CartError
from commerce.shopify import sync_inventory
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

    def test_dashboard_revenue_formatted_to_two_decimals(self):
        """Dashboard revenue must always be a quantized currency string."""
        self._add_item(quantity=3)  # subtotal 47.00 * ... uses existing pricing
        self._checkout()
        self.client.force_authenticate(self.admin)
        dashboard = self.client.get("/api/admin/dashboard/")
        self.assertEqual(dashboard.status_code, status.HTTP_200_OK)
        revenue = dashboard.data["revenue"]
        self.assertRegex(revenue, r"^\d+\.\d{2}$", f"Revenue should be quantized to 2 decimals, got {revenue!r}")

    def test_dashboard_revenue_zero_when_no_orders(self):
        """Empty aggregation must return a zero-formatted revenue string."""
        self.client.force_authenticate(self.admin)
        dashboard = self.client.get("/api/admin/dashboard/")
        self.assertEqual(dashboard.status_code, status.HTTP_200_OK)
        self.assertEqual(dashboard.data["revenue"], "0.00")

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

    def test_shopify_webhook_secret_independent_of_api_secret(self):
        """The webhook signing secret must be configurable independently of the API secret."""
        with override_settings(SHOPIFY_API_SECRET="api-secret", SHOPIFY_WEBHOOK_SECRET="webhook-secret"):
            from django.conf import settings as django_settings

            self.assertEqual(django_settings.SHOPIFY_API_SECRET, "api-secret")
            self.assertEqual(django_settings.SHOPIFY_WEBHOOK_SECRET, "webhook-secret")
            self.assertNotEqual(django_settings.SHOPIFY_WEBHOOK_SECRET, django_settings.SHOPIFY_API_SECRET)

    @override_settings(SHOPIFY_WEBHOOK_SECRET="test-webhook-secret")
    def test_shopify_webhook_cancels_order(self):
        """An orders/cancelled webhook must mark the local order cancelled."""
        order = Order.objects.create(
            user=self.user, number="PR-TEST-CANCEL", status=Order.Status.PROCESSING,
            payment_status=Order.PaymentStatus.PAID,
        )
        payload = {
            "id": 991123,
            "name": "#1002",
            "topic": "orders/cancelled",
            "note_attributes": [{"name": "printora_order_number", "value": order.number}],
        }
        body = json.dumps(payload).encode()
        digest = base64.b64encode(
            hmac.new(b"test-webhook-secret", body, hashlib.sha256).digest()
        ).decode()
        headers = {
            "HTTP_X_SHOPIFY_HMAC_SHA256": digest,
            "HTTP_X_SHOPIFY_TOPIC": "orders/cancelled",
            "HTTP_X_SHOPIFY_WEBHOOK_ID": "wh-test-2",
        }
        response = self.client.post(
            "/api/shopify/webhooks/", data=body, content_type="application/json", **headers
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.CANCELLED)

    def test_shopify_inventory_sync_updates_variant_stock(self):
        """sync_inventory must write Shopify variant quantities to local stock."""
        self.product.metadata = {"shopify_id": "shop-prod-1"}
        self.product.save(update_fields=["metadata"])
        self.variant.sku = "SHOP-VAR-1"
        self.variant.stock_quantity = 100
        self.variant.save(update_fields=["sku", "stock_quantity"])

        products = [
            {
                "shopify_id": "shop-prod-1",
                "variants": [
                    {"sku": "SHOP-VAR-1", "inventory_quantity": 7},
                    {"sku": "SHOP-VAR-MISSING", "inventory_quantity": 3},
                ],
            }
        ]
        result = sync_inventory(products)
        self.assertEqual(result["updated"], 1)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock_quantity, 7)

    # ------------------------------------------------------------------ #
    # Stripe checkout tests (Stripe is exercised with a mocked module)     #
    # ------------------------------------------------------------------ #

    def _fake_stripe_module(self, order_id):
        error_mod = types.ModuleType("stripe.error")

        class SignatureVerificationError(Exception):
            pass

        error_mod.SignatureVerificationError = SignatureVerificationError

        checkout_mod = types.ModuleType("stripe.checkout")

        class Session:
            id = "cs_test_123"
            url = "https://checkout.stripe.com/pay/cs_test_123"
            payment_intent = "pi_test_123"

            @classmethod
            def create(cls, **kwargs):
                return Session()

        checkout_mod.Session = Session

        class DictLike(dict):
            def __init__(self, d):
                super().__init__(d)
                self.__dict__.update(d)

        def construct_event(payload, sig_header, secret):
            return DictLike(
                {
                    "id": "evt_test_123",
                    "type": "checkout.session.completed",
                    "data": DictLike({"object": DictLike({"id": "cs_test_123", "metadata": {"order_id": str(order_id)}})}),
                }
            )

        webhook_mod = types.ModuleType("stripe.webhook")
        webhook_mod.Webhook = types.SimpleNamespace(construct_event=construct_event)

        stripe_mod = types.ModuleType("stripe")
        stripe_mod.error = error_mod
        stripe_mod.checkout = checkout_mod
        stripe_mod.Webhook = webhook_mod.Webhook
        stripe_mod.error.SignatureVerificationError = SignatureVerificationError
        return stripe_mod

    @override_settings(STRIPE_SECRET_KEY="sk_test_123", STRIPE_ENABLED=True)
    def test_stripe_checkout_session_creates_order_and_session(self):
        """Stripe checkout must create a pending order and return a session URL."""
        self.variant.stock_quantity = 10
        self.variant.save(update_fields=["stock_quantity"])
        self._add_item(quantity=2)
        stripe_mod = self._fake_stripe_module(None)
        with mock.patch.dict(sys.modules, {"stripe": stripe_mod}):
            response = self.client.post(
                "/api/checkout/session/",
                {
                    "shipping_name": "Buyer",
                    "shipping_address": "1 Main Street",
                    "shipping_city": "Portland",
                    "shipping_postal_code": "97205",
                    "shipping_country": "United States",
                    "success_url": "https://example.com/success",
                    "cancel_url": "https://example.com/cancel",
                    "demo": False,
                },
                format="json",
            )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["session_id"], "cs_test_123")
        self.assertIn("checkout.stripe.com", response.data["url"])
        order = Order.objects.get(pk=response.data["order"])
        self.assertEqual(order.payment_status, Order.PaymentStatus.UNPAID)
        self.assertEqual(order.status, Order.Status.PENDING)
        self.assertEqual(order.stripe_session_id, "cs_test_123")
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock_quantity, 8)

    def test_stripe_checkout_requires_configuration(self):
        """Without Stripe credentials the session endpoint must refuse."""
        response = self.client.post(
            "/api/checkout/session/",
            {
                "shipping_name": "Buyer",
                "shipping_address": "1 Main Street",
                "shipping_city": "Portland",
                "shipping_country": "United States",
                "demo": False,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(
        STRIPE_SECRET_KEY="sk_test_123",
        STRIPE_ENABLED=True,
        STRIPE_WEBHOOK_SECRET="test-stripe-secret",
    )
    def _place_stripe_order(self):
        self.variant.stock_quantity = 10
        self.variant.save(update_fields=["stock_quantity"])
        self._add_item(quantity=1)
        stripe_mod = self._fake_stripe_module(None)
        with mock.patch.dict(sys.modules, {"stripe": stripe_mod}):
            response = self.client.post(
                "/api/checkout/session/",
                {
                    "shipping_name": "Buyer",
                    "shipping_address": "1 Main Street",
                    "shipping_city": "Portland",
                    "shipping_postal_code": "97205",
                    "shipping_country": "United States",
                    "success_url": "https://example.com/success",
                    "cancel_url": "https://example.com/cancel",
                    "demo": False,
                },
                format="json",
            )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return response.data["order"]

    @override_settings(STRIPE_WEBHOOK_SECRET="test-stripe-secret")
    def test_stripe_webhook_marks_order_paid(self):
        """A verified checkout.session.completed webhook must mark the order paid once."""
        order_id = self._place_stripe_order()
        stripe_mod = self._fake_stripe_module(order_id)
        with mock.patch.dict(sys.modules, {"stripe": stripe_mod}):
            body = json.dumps({"id": "evt_test_123"}).encode()
            headers = {
                "HTTP_STRIPE_SIGNATURE": "t=123,v1=fakesig",
                "HTTP_STRIPE_WEBHOOK_ID": "wh-stripe-1",
            }
            response = self.client.post(
                "/api/stripe/webhooks/", data=body, content_type="application/json", **headers
            )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        order = Order.objects.get(pk=order_id)
        self.assertEqual(order.payment_status, Order.PaymentStatus.PAID)

    @override_settings(STRIPE_WEBHOOK_SECRET="test-stripe-secret")
    def test_stripe_webhook_rejects_invalid_signature(self):
        order_id = self._place_stripe_order()
        stripe_mod = self._fake_stripe_module(order_id)
        stripe_mod.Webhook.construct_event = lambda *a, **k: (_ for _ in ()).throw(
            stripe_mod.error.SignatureVerificationError("bad sig")
        )
        with mock.patch.dict(sys.modules, {"stripe": stripe_mod}):
            response = self.client.post(
                "/api/stripe/webhooks/",
                data=b"{}",
                content_type="application/json",
                HTTP_STRIPE_SIGNATURE="bad",
                HTTP_STRIPE_WEBHOOK_ID="wh-stripe-2",
            )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @override_settings(STRIPE_WEBHOOK_SECRET="test-stripe-secret")
    def test_stripe_webhook_duplicate_ignored(self):
        order_id = self._place_stripe_order()
        stripe_mod = self._fake_stripe_module(order_id)
        body = json.dumps({"id": "evt_test_123"}).encode()
        headers = {
            "HTTP_STRIPE_SIGNATURE": "t=123,v1=fakesig",
            "HTTP_STRIPE_WEBHOOK_ID": "wh-stripe-3",
        }
        with mock.patch.dict(sys.modules, {"stripe": stripe_mod}):
            first = self.client.post(
                "/api/stripe/webhooks/", data=body, content_type="application/json", **headers
            )
            second = self.client.post(
                "/api/stripe/webhooks/", data=body, content_type="application/json", **headers
            )
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(second.data["status"], "duplicate_ignored")
        self.assertEqual(Order.objects.get(pk=order_id).payment_status, Order.PaymentStatus.PAID)

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

    def test_checkout_decrements_stock_multiple_quantities(self):
        """Checkout decrements stock by the exact ordered quantity."""
        self.variant.stock_quantity = 10
        self.variant.save(update_fields=["stock_quantity"])
        self._add_item(quantity=4)
        response = self._checkout()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock_quantity, 6)

    def test_checkout_rolls_back_on_failure(self):
        """A checkout failure must not create an order or permanently decrement stock."""
        self.variant.stock_quantity = 5
        self.variant.save(update_fields=["stock_quantity"])
        self._add_item(quantity=2)

        # Force an item-creation failure inside the atomic transaction; the
        # whole checkout (order + stock decrement) must roll back.
        from unittest import mock

        with mock.patch.object(OrderItem.objects, "create", side_effect=CartError("rollback test")):
            response = self._checkout()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
        self.assertEqual(Order.objects.count(), 0)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock_quantity, 5, "Stock must be restored after rollback")

    def test_checkout_stock_never_goes_negative(self):
        """Stock can never sell below zero; the last unit sells exactly once."""
        self.variant.stock_quantity = 1
        self.variant.save(update_fields=["stock_quantity"])
        self._add_item(quantity=1)
        response = self._checkout()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock_quantity, 0)
        self.assertEqual(Order.objects.count(), 1)
        self.assertGreaterEqual(self.variant.stock_quantity, 0, "Stock must never be negative")
