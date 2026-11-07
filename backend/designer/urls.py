from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AdminClipartViewSet,
    AdminFontViewSet,
    AdminTemplateViewSet,
    ClipartViewSet,
    DesignViewSet,
    FontViewSet,
    TemplateViewSet,
    UploadView,
)

router = DefaultRouter()
router.register("templates", TemplateViewSet, basename="template")
router.register("cliparts", ClipartViewSet, basename="clipart")
router.register("fonts", FontViewSet, basename="font")
router.register("designs", DesignViewSet, basename="design")

admin_router = DefaultRouter()
admin_router.register("templates", AdminTemplateViewSet, basename="admin-template")
admin_router.register("cliparts", AdminClipartViewSet, basename="admin-clipart")
admin_router.register("fonts", AdminFontViewSet, basename="admin-font")

urlpatterns = [
    path("", include(router.urls)),
    path("uploads/", UploadView.as_view(), name="upload"),
    path("admin/", include(admin_router.urls)),
]
