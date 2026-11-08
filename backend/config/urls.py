from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("catalog.urls")),
    path("api/", include("designer.urls")),
    path("api/", include("commerce.urls")),
    path("api/", include("production.urls")),
    path("api/assistant/", include("assistant.urls")),
]

def serve_media(request, path):
    return serve(request, path, document_root=settings.MEDIA_ROOT)


if settings.DEBUG or getattr(settings, "SERVE_MEDIA", True):
    urlpatterns += [
        re_path(r"^media/(?P<path>.*)$", serve_media),
    ]
