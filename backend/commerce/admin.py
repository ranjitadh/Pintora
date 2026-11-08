from django.contrib import admin

from .models import Cart, CartItem, NewsletterSubscriber, Order, OrderItem, StoreConfiguration, WebhookEvent


class CartItemInline(admin.TabularInline):
    model = CartItem
    extra = 0


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ("product_name", "variant_name", "printing_method_name", "unit_price", "line_total")


@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):
    list_display = ("user", "status", "updated_at")
    list_filter = ("status",)
    search_fields = ("user__email",)
    inlines = [CartItemInline]


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("number", "email", "status", "payment_status", "total", "created_at")
    list_filter = ("status", "payment_status")
    search_fields = ("number", "email", "shipping_name")
    readonly_fields = ("number", "created_at", "updated_at")
    inlines = [OrderItemInline]


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ("order", "product_name", "variant_name", "quantity", "line_total")
    search_fields = ("order__number", "product_name")


@admin.register(StoreConfiguration)
class StoreConfigurationAdmin(admin.ModelAdmin):
    list_display = ("store_name", "currency", "demo_mode", "shopify_enabled", "updated_at")

    def has_add_permission(self, request):
        return not StoreConfiguration.objects.exists()


@admin.register(WebhookEvent)
class WebhookEventAdmin(admin.ModelAdmin):
    list_display = ("topic", "external_id", "verified", "processed", "created_at")
    list_filter = ("topic", "verified", "processed")
    search_fields = ("external_id",)


@admin.register(NewsletterSubscriber)
class NewsletterSubscriberAdmin(admin.ModelAdmin):
    list_display = ("email", "source", "is_active", "created_at")
    list_filter = ("is_active", "source")
    search_fields = ("email",)
    readonly_fields = ("created_at", "updated_at")
