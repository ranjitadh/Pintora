"""Minimal, isolated Shopify Admin API + webhook integration."""
from __future__ import annotations

import base64
import hashlib
import hmac
import logging
from decimal import Decimal, InvalidOperation

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class ShopifyError(RuntimeError):
    pass


def credentials_configured() -> bool:
    return bool(settings.SHOPIFY_STORE_DOMAIN and settings.SHOPIFY_ACCESS_TOKEN)


def _base_url():
    return f"https://{settings.SHOPIFY_STORE_DOMAIN}/admin/api/{settings.SHOPIFY_API_VERSION}"


def _headers():
    return {
        "X-Shopify-Access-Token": settings.SHOPIFY_ACCESS_TOKEN,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def verify_webhook_hmac(body: bytes, digest: str, secret: str | None = None) -> bool:
    secret = secret or settings.SHOPIFY_WEBHOOK_SECRET
    if not secret or not digest:
        return False
    computed = base64.b64encode(hmac.new(secret.encode("utf-8"), body, hashlib.sha256).digest()).decode("ascii")
    return hmac.compare_digest(computed, digest.strip())


def fetch_products(limit: int = 50) -> list[dict]:
    if not credentials_configured():
        raise ShopifyError("Shopify credentials are not configured. Set SHOPIFY_STORE_DOMAIN and SHOPIFY_ACCESS_TOKEN.")
    try:
        response = requests.get(
            f"{_base_url()}/products.json",
            headers=_headers(),
            params={"limit": min(max(limit, 1), 250)},
            timeout=20,
        )
    except requests.RequestException as exc:
        raise ShopifyError(f"Could not reach Shopify: {exc}") from exc
    if response.status_code == 401:
        raise ShopifyError("Shopify rejected the access token.")
    if not response.ok:
        raise ShopifyError(f"Shopify returned HTTP {response.status_code}: {response.text[:300]}")
    products = response.json().get("products", [])
    return [
        {
            "shopify_id": str(item.get("id")),
            "title": item.get("title", "Untitled"),
            "handle": item.get("handle", ""),
            "description": item.get("body_html", ""),
            "vendor": item.get("vendor", ""),
            "status": item.get("status", ""),
            "variants": [
                {
                    "id": str(v.get("id")),
                    "title": v.get("title", ""),
                    "price": v.get("price", "0"),
                    "sku": v.get("sku", ""),
                }
                for v in item.get("variants", [])
            ],
            "image": (item.get("images") or [{}])[0].get("src") if item.get("images") else None,
        }
        for item in products
    ]


def import_products(products: list[dict], user=None) -> dict:
    from catalog.models import Product, ProductCategory, ProductVariant

    category, _ = ProductCategory.objects.get_or_create(
        name="Shopify", defaults={"description": "Products imported from Shopify."}
    )
    created = 0
    updated = 0
    for item in products:
        try:
            price = Decimal(item.get("variants", [{}])[0].get("price", "0") or "0")
        except (InvalidOperation, IndexError):
            price = Decimal("0")
        slug_exists = Product.objects.filter(metadata__shopify_id=item["shopify_id"]).first()
        defaults = {
            "name": item.get("title", "Untitled")[:180],
            "description": item.get("description", ""),
            "short_description": (item.get("title") or "")[:280],
            "base_price": max(price, Decimal("0")),
            "category": category,
            "is_active": False,
            "metadata": {"shopify_id": item["shopify_id"], "shopify_handle": item.get("handle", "")},
            "created_by": user,
        }
        if slug_exists:
            for key, value in defaults.items():
                if key != "created_by":
                    setattr(slug_exists, key, value)
            slug_exists.save()
            updated += 1
            continue
        product = Product.objects.create(**defaults)
        for variant in item.get("variants", []):
            ProductVariant.objects.create(
                product=product,
                name=variant.get("title") or "Default",
                sku=variant.get("sku", ""),
                price_delta=Decimal("0"),
            )
        created += 1
    return {"created": created, "updated": updated, "total": len(products)}


def mark_order_from_webhook(payload: dict) -> str:
    from commerce.models import Order

    note_attributes = {
        str(attr.get("name", "")).lower(): attr.get("value")
        for attr in payload.get("note_attributes", [])
        if isinstance(attr, dict)
    }
    order_number = note_attributes.get("printora_order_number") or payload.get("name")
    local = None
    if order_number:
        local = Order.objects.filter(number=order_number).first()
    if local is None and payload.get("id"):
        local = Order.objects.filter(shopify_order_id=str(payload["id"])).first()
    if local is None:
        return "no_matching_order"
    local.shopify_order_id = str(payload.get("id", local.shopify_order_id))
    local.payment_status = Order.PaymentStatus.PAID
    if local.status in (Order.Status.PENDING, Order.Status.PAID):
        local.status = Order.Status.PROCESSING
    local.save(update_fields=["shopify_order_id", "payment_status", "status", "updated_at"])
    return "order_updated"
