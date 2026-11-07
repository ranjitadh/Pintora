from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ExportCreateView, ExportViewSet, HealthView

router = DefaultRouter()
router.register("exports", ExportViewSet, basename="export")

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("exports/create/", ExportCreateView.as_view(), name="export-create"),
    path("", include(router.urls)),
]
