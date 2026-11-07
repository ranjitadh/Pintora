from django.contrib import admin

from .models import GeneratedFile


@admin.register(GeneratedFile)
class GeneratedFileAdmin(admin.ModelAdmin):
    list_display = ("id", "design", "file_type", "status", "dpi", "width_px", "height_px", "created_at")
    list_filter = ("file_type", "status", "dpi")
    search_fields = ("design__name", "design__user__email")
    readonly_fields = ("id", "width_px", "height_px", "size_bytes", "warnings", "created_at", "completed_at")
