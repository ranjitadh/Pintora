import uuid

from django.conf import settings
from django.db import models

from catalog.models import Product, ProductStage
from core.models import TimeStampedModel


class DesignTemplate(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=180)
    slug = models.SlugField(max_length=200, unique=True, blank=True)
    category = models.CharField(max_length=80, default="General")
    tags = models.JSONField(default=list, blank=True)
    description = models.CharField(max_length=280, blank=True)
    product = models.ForeignKey(
        Product, on_delete=models.SET_NULL, null=True, blank=True, related_name="templates"
    )
    preview_image = models.ImageField(upload_to="templates/previews/", blank=True, null=True)
    canvas_json = models.JSONField()
    price = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    visibility = models.CharField(
        max_length=20, choices=[("public", "Public"), ("private", "Private")], default="public"
    )

    class Meta:
        ordering = ["category", "name"]

    def save(self, *args, **kwargs):
        if not self.slug:
            from catalog.models import unique_slug

            self.slug = unique_slug(DesignTemplate, self.name, DesignTemplate.objects.exclude(pk=self.pk))
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Clipart(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=180)
    category = models.CharField(max_length=80, default="General")
    tags = models.JSONField(default=list, blank=True)
    image = models.ImageField(upload_to="clipart/")
    thumbnail = models.ImageField(upload_to="clipart/thumbs/", blank=True, null=True)
    price = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["category", "sort_order", "name"]

    def __str__(self):
        return self.name


class FontResource(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120)
    family = models.CharField(max_length=120)
    file = models.FileField(upload_to="fonts/", blank=True, null=True)
    weight = models.CharField(max_length=40, default="400")
    style = models.CharField(max_length=40, default="normal")
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "name"]

    def __str__(self):
        return self.name


class Design(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SAVED = "saved", "Saved"
        ORDERED = "ordered", "Ordered"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="designs"
    )
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="designs")
    stage = models.ForeignKey(
        ProductStage, on_delete=models.SET_NULL, null=True, blank=True, related_name="designs"
    )
    name = models.CharField(max_length=180, default="Untitled design")
    canvas_json = models.JSONField(default=dict)
    preview_image = models.ImageField(upload_to="designs/previews/", blank=True, null=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    version = models.PositiveIntegerField(default=1)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [models.Index(fields=["user", "-updated_at"]), models.Index(fields=["product"])]

    def __str__(self):
        return f"{self.name} — {self.user.email}"


class DesignVersion(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    design = models.ForeignKey(Design, on_delete=models.CASCADE, related_name="versions")
    version = models.PositiveIntegerField()
    canvas_json = models.JSONField()
    preview_image = models.ImageField(upload_to="designs/versions/", blank=True, null=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )

    class Meta:
        ordering = ["-version"]
        constraints = [
            models.UniqueConstraint(fields=["design", "version"], name="unique_design_version")
        ]

    def __str__(self):
        return f"{self.design.name} v{self.version}"


class DesignAsset(TimeStampedModel):
    class AssetType(models.TextChoices):
        UPLOAD = "upload", "Customer upload"
        CLIPART = "clipart", "Clipart"
        MOCKUP = "mockup", "Mockup"
        PREVIEW = "preview", "Preview"
        FONT = "font", "Font"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="design_assets",
    )
    design = models.ForeignKey(
        Design, on_delete=models.SET_NULL, null=True, blank=True, related_name="assets"
    )
    file = models.FileField(upload_to="uploads/%Y/%m/")
    asset_type = models.CharField(max_length=20, choices=AssetType.choices, default=AssetType.UPLOAD)
    original_name = models.CharField(max_length=255, blank=True)
    mime_type = models.CharField(max_length=100, blank=True)
    size_bytes = models.PositiveBigIntegerField(default=0)
    width = models.PositiveIntegerField(default=0)
    height = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.original_name or self.file.name
