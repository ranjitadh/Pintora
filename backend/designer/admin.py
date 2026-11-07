from django.contrib import admin

from .models import Clipart, Design, DesignAsset, DesignTemplate, DesignVersion, FontResource


class DesignVersionInline(admin.TabularInline):
    model = DesignVersion
    extra = 0
    readonly_fields = ("version", "canvas_json", "preview_image", "created_by", "created_at")


@admin.register(Design)
class DesignAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "product", "stage", "status", "version", "updated_at")
    list_filter = ("status", "product")
    search_fields = ("name", "user__email")
    readonly_fields = ("id", "version", "created_at", "updated_at")
    inlines = [DesignVersionInline]


@admin.register(DesignTemplate)
class DesignTemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "product", "visibility", "is_active")
    list_filter = ("category", "visibility", "is_active")
    search_fields = ("name", "category")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Clipart)
class ClipartAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "price", "is_active", "sort_order")
    list_filter = ("category", "is_active")
    search_fields = ("name", "category")


@admin.register(FontResource)
class FontResourceAdmin(admin.ModelAdmin):
    list_display = ("name", "family", "weight", "style", "is_active", "sort_order")
    list_filter = ("is_active", "style")


@admin.register(DesignAsset)
class DesignAssetAdmin(admin.ModelAdmin):
    list_display = ("original_name", "user", "asset_type", "mime_type", "size_bytes", "created_at")
    list_filter = ("asset_type", "mime_type")
    search_fields = ("original_name", "user__email")
