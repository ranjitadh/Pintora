import uuid

from django.conf import settings
from django.db import models
from django.utils.text import slugify

from core.models import TimeStampedModel


def unique_slug(model, value, queryset=None):
    base = slugify(value)[:180] or "item"
    candidate = base
    qs = queryset if queryset is not None else model.objects.all()
    counter = 2
    while qs.filter(slug=candidate).exists():
        candidate = f"{base}-{counter}"
        counter += 1
    return candidate


class ProductCategory(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=180, unique=True, blank=True)
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to="categories/", blank=True, null=True)
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["sort_order", "name"]
        verbose_name_plural = "product categories"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(ProductCategory, self.name, ProductCategory.objects.exclude(pk=self.pk))
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Product(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category = models.ForeignKey(
        ProductCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name="products"
    )
    name = models.CharField(max_length=180)
    slug = models.SlugField(max_length=200, unique=True, blank=True)
    short_description = models.CharField(max_length=280, blank=True)
    description = models.TextField(blank=True)
    base_price = models.DecimalField(max_digits=10, decimal_places=2)
    compare_at_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default="USD")
    image = models.ImageField(upload_to="products/", blank=True, null=True)
    is_active = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False)
    quantity_discounts = models.JSONField(
        default=list,
        blank=True,
        help_text='Example: [{"min_qty": 10, "percent": 5}, {"min_qty": 25, "percent": 10}]',
    )
    metadata = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="products_created"
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["is_active", "is_featured"]), models.Index(fields=["slug"])]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(Product, self.name, Product.objects.exclude(pk=self.pk))
        super().save(*args, **kwargs)

    @property
    def min_price(self):
        return self.base_price

    def __str__(self):
        return self.name


class ProductImage(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="products/gallery/")
    alt = models.CharField(max_length=180, blank=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "created_at"]


class ProductVariant(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="variants")
    name = models.CharField(max_length=120)
    sku = models.CharField(max_length=80, blank=True)
    color_name = models.CharField(max_length=60, blank=True)
    color_hex = models.CharField(max_length=9, blank=True, default="#1f1f1f")
    size = models.CharField(max_length=40, blank=True)
    price_delta = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    stock_quantity = models.PositiveIntegerField(default=1000)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "name"]
        constraints = [
            models.UniqueConstraint(fields=["product", "name"], name="unique_variant_name_per_product")
        ]

    def __str__(self):
        return f"{self.product.name} — {self.name}"


class PrintingMethod(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=80)
    slug = models.SlugField(max_length=90, unique=True, blank=True)
    description = models.TextField(blank=True)
    base_fee = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    per_area_fee = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "name"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(PrintingMethod, self.name, PrintingMethod.objects.exclude(pk=self.pk))
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class ProductPrintingMethod(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="printing_method_links")
    printing_method = models.ForeignKey(
        PrintingMethod, on_delete=models.CASCADE, related_name="product_links"
    )
    price_adjustment = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    is_default = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["product", "printing_method"], name="unique_printing_method_per_product"
            )
        ]
        ordering = ["-is_default", "printing_method__sort_order"]


class PrintArea(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120, default="Print area")
    width_mm = models.DecimalField(max_digits=8, decimal_places=2)
    height_mm = models.DecimalField(max_digits=8, decimal_places=2)
    mockup_x = models.PositiveIntegerField(help_text="Left offset in mockup pixels")
    mockup_y = models.PositiveIntegerField(help_text="Top offset in mockup pixels")
    mockup_width = models.PositiveIntegerField(help_text="Width of printable region in mockup pixels")
    mockup_height = models.PositiveIntegerField(help_text="Height of printable region in mockup pixels")
    safe_area_mm = models.DecimalField(max_digits=5, decimal_places=2, default=3)
    bleed_mm = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    editor_dpi = models.PositiveIntegerField(default=150)
    export_dpi = models.PositiveIntegerField(default=300)
    min_dpi = models.PositiveIntegerField(default=150)
    grid_mm = models.PositiveIntegerField(default=10)
    shape = models.CharField(
        max_length=20,
        choices=[("rectangle", "Rectangle"), ("cylinder", "Cylinder / wrap")],
        default="rectangle",
    )

    @property
    def width_px(self):
        return round(float(self.width_mm) / 25.4 * self.editor_dpi)

    @property
    def height_px(self):
        return round(float(self.height_mm) / 25.4 * self.editor_dpi)

    @property
    def export_width_px(self):
        return round(float(self.width_mm) / 25.4 * self.export_dpi)

    @property
    def export_height_px(self):
        return round(float(self.height_mm) / 25.4 * self.export_dpi)

    def __str__(self):
        return f"{self.name} ({self.width_mm}×{self.height_mm} mm)"


class ProductStage(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="stages")
    name = models.CharField(max_length=80, default="Front")
    slug = models.SlugField(max_length=90, blank=True)
    mockup_image = models.ImageField(upload_to="mockups/", blank=True, null=True)
    mockup_width = models.PositiveIntegerField(default=1000)
    mockup_height = models.PositiveIntegerField(default=1000)
    print_area = models.OneToOneField(
        PrintArea, on_delete=models.CASCADE, related_name="stage", null=True, blank=True
    )
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["sort_order", "name"]
        constraints = [
            models.UniqueConstraint(fields=["product", "name"], name="unique_stage_name_per_product")
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(ProductStage, self.name, ProductStage.objects.exclude(pk=self.pk))
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.product.name} — {self.name}"


class PricingRule(TimeStampedModel):
    class RuleType(models.TextChoices):
        BASE_SURCHARGE = "base_surcharge", "Base surcharge"
        PER_QUANTITY = "per_quantity", "Per quantity"
        PER_PRINT_AREA = "per_print_area", "Per print area"
        PER_IMAGE = "per_image", "Per uploaded image"
        PER_CLIPART = "per_clipart", "Per clipart item"
        PER_CHARACTER = "per_character", "Per character"
        PER_LINE = "per_line", "Per text line"
        PER_COLOR = "per_color", "Per unique color"
        PER_DESIGN = "per_design", "Per design"
        PER_SHAPE = "per_shape", "Per shape"
        PER_VARIANT = "per_variant", "Variant surcharge"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, null=True, blank=True, related_name="pricing_rules"
    )
    printing_method = models.ForeignKey(
        PrintingMethod, on_delete=models.CASCADE, null=True, blank=True, related_name="pricing_rules"
    )
    rule_type = models.CharField(max_length=30, choices=RuleType.choices)
    amount = models.DecimalField(max_digits=8, decimal_places=2)
    description = models.CharField(max_length=180, blank=True)
    config = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["rule_type", "created_at"]

    def __str__(self):
        return f"{self.get_rule_type_display()} — {self.amount}"
