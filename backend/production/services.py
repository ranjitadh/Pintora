"""Production export pipeline. Runs inline by default and through Celery when a
broker is configured (CELERY_TASK_ALWAYS_EAGER=false)."""
from __future__ import annotations

import logging
from django.core.files.base import ContentFile
from django.utils import timezone

from .models import GeneratedFile
from .render import RenderError, export_pdf, export_png, export_svg

logger = logging.getLogger(__name__)

RENDERERS = {
    "png": export_png,
    "svg": export_svg,
    "pdf": export_pdf,
}


def process_generated_file(file_id: str) -> str:
    generated = GeneratedFile.objects.select_related("design", "stage").filter(pk=file_id).first()
    if generated is None:
        return "missing"
    generated.status = GeneratedFile.Status.PROCESSING
    generated.save(update_fields=["status", "updated_at"])

    renderer = RENDERERS.get(generated.file_type)
    stage = generated.stage or generated.design.stage
    if renderer is None or stage is None:
        generated.status = GeneratedFile.Status.FAILED
        generated.error = "Unsupported file type or missing stage."
        generated.save(update_fields=["status", "error", "updated_at"])
        return "failed"

    try:
        if generated.file_type == "svg":
            content, width, height, warnings_list = renderer(generated.design, stage, generated.dpi)
            content_type = "image/svg+xml"
        else:
            content, width, height, warnings_list = renderer(generated.design, stage, generated.dpi)
            content_type = "image/png" if generated.file_type == "png" else "application/pdf"

        ext = generated.file_type
        filename = f"printora-{generated.design_id}-{stage.slug or stage.id}-{generated.dpi}dpi.{ext}"
        generated.file.save(filename, ContentFile(content), save=False)
        generated.width_px = width
        generated.height_px = height
        generated.size_bytes = len(content)
        generated.warnings = warnings_list
        generated.metadata = {
            "content_type": content_type,
            "stage_name": stage.name,
            "physical_width_mm": float(stage.print_area.width_mm) if stage.print_area else None,
            "physical_height_mm": float(stage.print_area.height_mm) if stage.print_area else None,
        }
        generated.status = GeneratedFile.Status.COMPLETED
        generated.completed_at = timezone.now()
        generated.error = ""
        generated.save()
        return "completed"
    except (RenderError, OSError, ValueError) as exc:
        logger.exception("Export failed for %s", generated.id)
        generated.status = GeneratedFile.Status.FAILED
        generated.error = str(exc)[:2000]
        generated.save(update_fields=["status", "error", "updated_at"])
        return "failed"
