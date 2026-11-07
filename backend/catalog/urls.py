from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AdminCategoryViewSet,
    AdminPrintingMethodViewSet,
    AdminPricingRuleViewSet,
    AdminProductViewSet,
    AdminStageViewSet,
    AdminVariantViewSet,
    PrintingMethodViewSet,
    ProductCategoryViewSet,
    ProductViewSet,
)

router = DefaultRouter()
router.register("categories", ProductCategoryViewSet, basename="category")
router.register("products", ProductViewSet, basename="product")
router.register("printing-methods", PrintingMethodViewSet, basename="printing-method")

admin_router = DefaultRouter()
admin_router.register("categories", AdminCategoryViewSet, basename="admin-category")
admin_router.register("products", AdminProductViewSet, basename="admin-product")
admin_router.register("stages", AdminStageViewSet, basename="admin-stage")
admin_router.register("variants", AdminVariantViewSet, basename="admin-variant")
admin_router.register("printing-methods", AdminPrintingMethodViewSet, basename="admin-printing-method")
admin_router.register("pricing-rules", AdminPricingRuleViewSet, basename="admin-pricing-rule")

urlpatterns = [
    path("", include(router.urls)),
    path("admin/", include(admin_router.urls)),
]
