import uuid
from decimal import Decimal

from django.conf import settings as django_settings
from django.db import models
from django.utils import timezone

from catalog.models import PrintingMethod, Product, ProductVariant
from core.models import TimeStampedModel
from designer.models import Design


def generate_order_number():
    stamp = timezone.now().strftime("%y%m%d")
    return f"PR-{stamp}-{uuid.uuid4().hex[:6].upper()}"


class Cart(TimeStampedModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        CONVERTED = "converted", "Converted"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(django_settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="carts")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "status"])]

    @classmethod
    def get_active(cls, user):
        cart = cls.objects.filter(user=user, status=cls.Status.ACTIVE).first()
        return cart or cls.objects.create(user=user)


class CartItem(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="cart_items")
    variant = models.ForeignKey(ProductVariant, on_delete=models.SET_NULL, null=True, blank=True)
    design = models.ForeignKey(Design, on_delete=models.SET_NULL, null=True, blank=True, related_name="cart_items")
    printing_method = models.ForeignKey(PrintingMethod, on_delete=models.SET_NULL, null=True, blank=True)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    line_total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    configuration = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.product.name} × {self.quantity}"


class Order(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PAID = "paid", "Paid"
        PROCESSING = "processing", "Processing"
        READY = "ready_for_production", "Ready for production"
        PRINTING = "printing", "Printing"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    class PaymentStatus(models.TextChoices):
        UNPAID = "unpaid", "Unpaid"
        DEMO = "demo", "Demo payment"
        PAID = "paid", "Paid"
        REFUNDED = "refunded", "Refunded"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    number = models.CharField(max_length=30, unique=True, default=generate_order_number, editable=False)
    user = models.ForeignKey(django_settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="orders")
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.PENDING)
    payment_status = models.CharField(max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.UNPAID)
    currency = models.CharField(max_length=3, default="USD")
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    shipping = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    tax = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    email = models.EmailField(blank=True)
    shipping_name = models.CharField(max_length=180, blank=True)
    shipping_phone = models.CharField(max_length=40, blank=True)
    shipping_address = models.CharField(max_length=255, blank=True)
    shipping_city = models.CharField(max_length=120, blank=True)
    shipping_postal_code = models.CharField(max_length=30, blank=True)
    shipping_country = models.CharField(max_length=80, blank=True)
    notes = models.TextField(blank=True)

    shopify_order_id = models.CharField(max_length=80, blank=True, db_index=True)
    stripe_session_id = models.CharField(max_length=255, blank=True, db_index=True)
    stripe_payment_intent_id = models.CharField(max_length=255, blank=True, db_index=True)
    metadata = models.JSONField(default=dict, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "-created_at"]), models.Index(fields=["status"])]

    def __str__(self):
        return self.number

    @property
    def item_count(self):
        return sum(item.quantity for item in self.items.all())


class OrderItem(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, related_name="order_items")
    variant = models.ForeignKey(ProductVariant, on_delete=models.SET_NULL, null=True, blank=True)
    design = models.ForeignKey(Design, on_delete=models.SET_NULL, null=True, blank=True, related_name="order_items")
    printing_method = models.ForeignKey(PrintingMethod, on_delete=models.SET_NULL, null=True, blank=True)
    product_name = models.CharField(max_length=180)
    variant_name = models.CharField(max_length=120, blank=True)
    printing_method_name = models.CharField(max_length=80, blank=True)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    line_total = models.DecimalField(max_digits=10, decimal_places=2)
    preview_image = models.ImageField(upload_to="orders/previews/", blank=True, null=True)
    configuration = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.product_name} × {self.quantity}"


class StoreConfiguration(TimeStampedModel):
    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    store_name = models.CharField(max_length=120, default="Printora")
    currency = models.CharField(max_length=3, default="USD")
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    shipping_fee = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    free_shipping_threshold = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    demo_mode = models.BooleanField(default=True)
    shopify_domain = models.CharField(max_length=180, blank=True)
    shopify_enabled = models.BooleanField(default=False)
    announcement = models.CharField(max_length=240, blank=True)
    settings = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = "store configuration"

    @classmethod
    def get_solo(cls):
        obj, _created = cls.objects.get_or_create(pk=1)
        return obj

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @property
    def shopify_credentials_configured(self):
        from django.conf import settings

        return bool(settings.SHOPIFY_STORE_DOMAIN and settings.SHOPIFY_ACCESS_TOKEN)

    def __str__(self):
        return self.store_name


class WebhookEvent(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    topic = models.CharField(max_length=80)
    external_id = models.CharField(max_length=120, blank=True)
    payload = models.JSONField(default=dict)
    verified = models.BooleanField(default=False)
    processed = models.BooleanField(default=False)
    error = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["topic", "external_id"], name="unique_webhook_topic_external_id",
                condition=~models.Q(external_id=""),
            )
        ]
