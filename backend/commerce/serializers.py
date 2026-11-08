from decimal import Decimal

from rest_framework import serializers

from catalog.models import PrintingMethod, Product, ProductVariant
from catalog.serializers import ProductListSerializer, ProductVariantSerializer
from designer.models import Design
from designer.serializers import DesignListSerializer
from .models import Cart, CartItem, Order, OrderItem, StoreConfiguration, WebhookEvent


def file_url(request, field):
    if not field:
        return None
    return request.build_absolute_uri(field.url) if request else field.url


class CartItemSerializer(serializers.ModelSerializer):
    product_detail = ProductListSerializer(source="product", read_only=True)
    variant_detail = ProductVariantSerializer(source="variant", read_only=True)
    design_detail = DesignListSerializer(source="design", read_only=True)
    printing_method_name = serializers.CharField(source="printing_method.name", read_only=True, default=None)

    class Meta:
        model = CartItem
        fields = [
            "id", "product", "product_detail", "variant", "variant_detail", "design",
            "design_detail", "printing_method", "printing_method_name", "quantity",
            "unit_price", "line_total", "configuration", "created_at",
        ]
        read_only_fields = ["unit_price", "line_total", "configuration"]


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    item_count = serializers.SerializerMethodField()
    totals = serializers.SerializerMethodField()

    class Meta:
        model = Cart
        fields = ["id", "status", "items", "item_count", "totals", "updated_at"]

    def get_item_count(self, obj):
        return sum(item.quantity for item in obj.items.all())

    def get_totals(self, obj):
        from .services import cart_totals

        return cart_totals(obj)


class AddCartItemSerializer(serializers.Serializer):
    product = serializers.UUIDField()
    variant = serializers.UUIDField(required=False, allow_null=True)
    design = serializers.UUIDField(required=False, allow_null=True)
    printing_method = serializers.UUIDField(required=False, allow_null=True)
    quantity = serializers.IntegerField(min_value=1, max_value=1000, default=1)


class UpdateCartItemSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=1, max_value=1000)


class CheckoutSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False, allow_blank=True)
    shipping_name = serializers.CharField(max_length=180)
    shipping_phone = serializers.CharField(max_length=40, required=False, allow_blank=True)
    shipping_address = serializers.CharField(max_length=255)
    shipping_city = serializers.CharField(max_length=120)
    shipping_postal_code = serializers.CharField(max_length=30, required=False, allow_blank=True)
    shipping_country = serializers.CharField(max_length=80)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=2000)
    demo = serializers.BooleanField(default=True)


class CheckoutSessionSerializer(serializers.Serializer):
    order = serializers.UUIDField(read_only=True)
    order_number = serializers.CharField(read_only=True)
    session_id = serializers.CharField(read_only=True)
    url = serializers.URLField(read_only=True)
    status = serializers.CharField(read_only=True)


class OrderItemSerializer(serializers.ModelSerializer):
    preview_url = serializers.SerializerMethodField()
    order = serializers.UUIDField(read_only=True)
    design = DesignListSerializer(read_only=True)
    product_slug = serializers.SlugRelatedField(source="product", slug_field="slug", read_only=True)
    exports = serializers.SerializerMethodField()
    stage = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = [
            "id", "order", "product", "product_name", "product_slug", "variant", "variant_name",
            "printing_method", "printing_method_name", "design", "preview_url", "quantity",
            "unit_price", "line_total", "configuration", "exports", "stage",
        ]

    def get_preview_url(self, obj):
        return file_url(self.context.get("request"), obj.preview_image)

    def get_exports(self, obj):
        files = obj.generated_files.all()
        return [
            {
                "id": str(f.id),
                "file_type": f.file_type,
                "status": f.status,
                "url": file_url(self.context.get("request"), f.file),
                "dpi": f.dpi,
                "warnings": f.warnings,
            }
            for f in files
        ]

    def get_stage(self, obj):
        return obj.design.stage_id if obj.design else None


class OrderListSerializer(serializers.ModelSerializer):
    item_count = serializers.SerializerMethodField()
    customer_email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = Order
        fields = [
            "id", "number", "status", "payment_status", "currency", "subtotal", "discount",
            "shipping", "tax", "total", "item_count", "customer_email", "created_at", "paid_at",
        ]

    def get_item_count(self, obj):
        return sum(item.quantity for item in obj.items.all())


class OrderSerializer(OrderListSerializer):
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta(OrderListSerializer.Meta):
        fields = OrderListSerializer.Meta.fields + [
            "items", "email", "shipping_name", "shipping_phone", "shipping_address",
            "shipping_city", "shipping_postal_code", "shipping_country", "notes",
            "shopify_order_id", "metadata", "updated_at",
        ]


class AdminOrderUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = ["status", "payment_status", "notes", "shopify_order_id"]


class StoreConfigSerializer(serializers.ModelSerializer):
    shopify_credentials_configured = serializers.BooleanField(read_only=True)
    stripe_configured = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = StoreConfiguration
        fields = [
            "store_name", "currency", "tax_rate", "shipping_fee", "free_shipping_threshold",
            "demo_mode", "shopify_domain", "shopify_enabled", "shopify_credentials_configured",
            "stripe_configured", "announcement", "settings",
        ]

    def get_stripe_configured(self, obj):
        from django.conf import settings
        return bool(settings.STRIPE_SECRET_KEY and settings.STRIPE_ENABLED)


class NewsletterSubscribeSerializer(serializers.Serializer):
    email = serializers.EmailField()
    source = serializers.CharField(max_length=40, required=False, allow_blank=True, default="footer")

    def validate_email(self, value):
        return value.strip().lower()

    def validate_source(self, value):
        value = (value or "footer").strip().lower()
        return value[:40] or "footer"


class WebhookEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = WebhookEvent
        fields = ["id", "topic", "external_id", "verified", "processed", "error", "created_at"]
