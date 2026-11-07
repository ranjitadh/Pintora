from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AdminDashboardView,
    AdminOrderViewSet,
    AdminShopifyStatusView,
    AdminShopifySyncView,
    AdminStoreConfigView,
    AdminWebhookEventListView,
    CartItemView,
    CartItemsView,
    CartView,
    OrderDetailView,
    OrderListCreateView,
    PricingView,
    ShopifyWebhookView,
    StripeCheckoutSessionView,
    StripeWebhookView,
    StoreConfigView,
)

router = DefaultRouter()
router.register("admin/orders", AdminOrderViewSet, basename="admin-order")

urlpatterns = [
    path("pricing/", PricingView.as_view(), name="pricing"),
    path("cart/", CartView.as_view(), name="cart"),
    path("cart/items/", CartItemsView.as_view(), name="cart-items"),
    path("cart/items/<uuid:item_id>/", CartItemView.as_view(), name="cart-item"),
    path("checkout/session/", StripeCheckoutSessionView.as_view(), name="checkout-session"),
    path("orders/", OrderListCreateView.as_view(), name="orders"),
    path("orders/<uuid:pk>/", OrderDetailView.as_view(), name="order-detail"),
    path("stripe/webhooks/", StripeWebhookView.as_view(), name="stripe-webhook"),
    path("store/config/", StoreConfigView.as_view(), name="store-config"),
    path("admin/store/config/", AdminStoreConfigView.as_view(), name="admin-store-config"),
    path("admin/dashboard/", AdminDashboardView.as_view(), name="admin-dashboard"),
    path("admin/shopify/status/", AdminShopifyStatusView.as_view(), name="admin-shopify-status"),
    path("admin/shopify/sync/", AdminShopifySyncView.as_view(), name="admin-shopify-sync"),
    path("admin/webhooks/", AdminWebhookEventListView.as_view(), name="admin-webhooks"),
    path("shopify/webhooks/", ShopifyWebhookView.as_view(), name="shopify-webhook"),
    path("", include(router.urls)),
]
