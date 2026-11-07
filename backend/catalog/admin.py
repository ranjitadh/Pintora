from django.contrib import admin

from .models import (
    PrintArea,
    PrintingMethod,
    PricingRule,
    Product,
    ProductCategory,
    ProductImage,
    ProductPrintingMethod,
    ProductStage,
    ProductVariant,
)


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 0


class ProductVariantInline(admin.TabularInline):
    model = ProductVariant
    extra = 0


class ProductPrintingMethodInline(admin.TabularInline):
    model = ProductPrintingMethod
    extra = 0


@admin.register(ProductCategory)
class ProductCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "sort_order", "is_active")
    list_editable = ("sort_order", "is_active")
    search_fields = ("name",)
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "base_price", "is_active", "is_featured", "created_at")
    list_filter = ("is_active", "is_featured", "category")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}
    inlines = [ProductImageInline, ProductVariantInline, ProductPrintingMethodInline]


@admin.register(ProductStage)
class ProductStageAdmin(admin.ModelAdmin):
    list_display = ("product", "name", "slug", "sort_order", "is_active")
    list_filter = ("is_active", "product")
    search_fields = ("product__name", "name")


@admin.register(PrintArea)
class PrintAreaAdmin(admin.ModelAdmin):
    list_display = ("name", "width_mm", "height_mm", "editor_dpi", "export_dpi")


@admin.register(PrintingMethod)
class PrintingMethodAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "base_fee", "per_area_fee", "is_active")
    list_filter = ("is_active",)
    prepopulated_fields = {"slug": ("name",)}


@admin.register(PricingRule)
class PricingRuleAdmin(admin.ModelAdmin):
    list_display = ("rule_type", "product", "printing_method", "amount", "is_active")
    list_filter = ("rule_type", "is_active", "product")


@admin.register(ProductVariant)
class ProductVariantAdmin(admin.ModelAdmin):
    list_display = ("product", "name", "sku", "size", "color_name", "price_delta", "is_active")
    list_filter = ("is_active", "product")
    search_fields = ("name", "sku", "product__name")


@admin.register(ProductImage)
class ProductImageAdmin(admin.ModelAdmin):
    list_display = ("product", "alt", "sort_order")


@admin.register(ProductPrintingMethod)
class ProductPrintingMethodAdmin(admin.ModelAdmin):
    list_display = ("product", "printing_method", "price_adjustment", "is_default")
