import uuid

from django.conf import settings
from django.db import models

from core.models import TimeStampedModel
from designer.models import Design


class GeneratedFile(TimeStampedModel):
    class FileType(models.TextChoices):
        PNG = "png", "PNG"
        SVG = "svg", "SVG"
        PDF = "pdf", "PDF"
        PREVIEW = "preview", "Preview"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    design = models.ForeignKey(Design, on_delete=models.CASCADE, related_name="generated_files")
    order_item = models.ForeignKey(
        "commerce.OrderItem", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="generated_files",
    )
    stage = models.ForeignKey(
        "catalog.ProductStage", on_delete=models.SET_NULL, null=True, blank=True
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )
    file_type = models.CharField(max_length=10, choices=FileType.choices)
    file = models.FileField(upload_to="exports/%Y/%m/", blank=True, null=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    dpi = models.PositiveIntegerField(default=300)
    width_px = models.PositiveIntegerField(default=0)
    height_px = models.PositiveIntegerField(default=0)
    size_bytes = models.PositiveBigIntegerField(default=0)
    error = models.TextField(blank=True)
    warnings = models.JSONField(default=list, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["design", "-created_at"])]

    def __str__(self):
        return f"{self.design_id} — {self.file_type}"
