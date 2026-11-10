import io
import logging

from django.core.files.base import ContentFile
from PIL import Image
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsAdminRole
from production.render import RenderError, render_canvas, render_preview_bytes
from .models import Clipart, Design, DesignAsset, DesignTemplate, DesignVersion, FontResource
from .serializers import (
    AdminClipartSerializer,
    AdminFontResourceSerializer,
    AdminTemplateSerializer,
    ClipartSerializer,
    DesignAssetSerializer,
    DesignListSerializer,
    DesignSerializer,
    DesignVersionSerializer,
    DesignWriteSerializer,
    FontResourceSerializer,
    TemplateSerializer,
)
from .uploads import UploadValidationError, sanitize_svg, svg_dimensions, validate_upload

logger = logging.getLogger(__name__)


def _save_preview(design):
    try:
        content, _warnings = render_preview_bytes(design, stage=design.stage, width=640)
        filename = f"design-{design.id}-v{design.version}.png"
        design.preview_image.save(filename, ContentFile(content), save=False)
        design.save(update_fields=["preview_image", "updated_at"])
    except (RenderError, Exception) as exc:  # preview failure must not lose the design
        logger.warning("Preview generation failed for design %s: %s", design.id, exc)


class TemplateViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    serializer_class = TemplateSerializer
    pagination_class = None

    def get_queryset(self):
        qs = DesignTemplate.objects.filter(is_active=True, visibility="public").select_related("product")
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category__iexact=category)
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(name__icontains=search)
        return qs


class ClipartViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    serializer_class = ClipartSerializer
    pagination_class = None

    def get_queryset(self):
        qs = Clipart.objects.filter(is_active=True)
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category__iexact=category)
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(name__icontains=search)
        return qs


class FontViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    serializer_class = FontResourceSerializer
    pagination_class = None

    def get_queryset(self):
        return FontResource.objects.filter(is_active=True)


class DesignViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["name"]
    ordering_fields = ["name", "created_at", "updated_at"]
    ordering = ["-updated_at"]

    def get_queryset(self):
        user = self.request.user
        qs = Design.objects.select_related("product", "stage").prefetch_related("versions")
        if user.is_superuser or user.role in ("admin", "staff"):
            return qs
        return qs.filter(user=user)

    def get_serializer_class(self):
        if self.action in ("list",):
            return DesignListSerializer
        if self.action in ("create", "update", "partial_update"):
            return DesignWriteSerializer
        return DesignSerializer

    def create(self, request, *args, **kwargs):
        serializer = DesignWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        design = Design.objects.create(
            user=request.user,
            product=data["product_obj"],
            stage=data["stage_obj"],
            name=data.get("name") or "Untitled design",
            canvas_json=data["canvas_json"],
            status=data.get("status", Design.Status.SAVED),
            metadata=data.get("metadata") or {},
            version=1,
        )
        DesignVersion.objects.create(
            design=design,
            version=1,
            canvas_json=design.canvas_json,
            created_by=request.user,
        )
        _save_preview(design)
        design.refresh_from_db()
        return Response(
            DesignSerializer(design, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        design = self.get_object()
        serializer = DesignWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        design.product = data["product_obj"]
        design.stage = data["stage_obj"]
        design.name = data.get("name") or design.name
        design.canvas_json = data["canvas_json"]
        design.status = data.get("status", design.status)
        design.metadata = data.get("metadata") or design.metadata
        design.version += 1
        design.save()
        DesignVersion.objects.create(
            design=design,
            version=design.version,
            canvas_json=design.canvas_json,
            created_by=request.user,
        )
        _save_preview(design)
        design.refresh_from_db()
        return Response(DesignSerializer(design, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="autosave")
    def autosave(self, request, pk=None):
        design = self.get_object()
        serializer = DesignWriteSerializer(data={**request.data, "status": "draft"})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        design.canvas_json = data["canvas_json"]
        design.stage = data["stage_obj"]
        design.name = data.get("name") or design.name
        design.save(update_fields=["canvas_json", "stage", "name", "updated_at"])
        return Response({"id": str(design.id), "updated_at": design.updated_at, "version": design.version})

    @action(detail=True, methods=["get"], url_path="versions")
    def versions(self, request, pk=None):
        design = self.get_object()
        serializer = DesignVersionSerializer(
            design.versions.all()[:50], many=True, context={"request": request}
        )
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path=r"versions/(?P<version_id>[^/.]+)/restore")
    def restore(self, request, pk=None, version_id=None):
        design = self.get_object()
        try:
            version = design.versions.get(pk=version_id)
        except DesignVersion.DoesNotExist:
            return Response({"detail": "Version not found."}, status=404)
        design.canvas_json = version.canvas_json
        design.version += 1
        design.save()
        DesignVersion.objects.create(
            design=design,
            version=design.version,
            canvas_json=design.canvas_json,
            created_by=request.user,
        )
        _save_preview(design)
        design.refresh_from_db()
        return Response(DesignSerializer(design, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def duplicate(self, request, pk=None):
        design = self.get_object()
        copy = Design.objects.create(
            user=request.user,
            product=design.product,
            stage=design.stage,
            name=f"Copy of {design.name}"[:180],
            canvas_json=design.canvas_json,
            status=Design.Status.DRAFT,
            metadata=design.metadata,
            version=1,
        )
        DesignVersion.objects.create(
            design=copy, version=1, canvas_json=copy.canvas_json, created_by=request.user
        )
        _save_preview(copy)
        copy.refresh_from_db()
        return Response(
            DesignSerializer(copy, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class UploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    throttle_scope = "upload"

    def post(self, request):
        upload = request.FILES.get("file")
        if not upload:
            return Response({"detail": "No file was provided."}, status=400)
        original_name = upload.name[:255]
        is_svg = (upload.name or "").lower().endswith(".svg") or upload.content_type == "image/svg+xml"

        try:
            if is_svg:
                raw = upload.read()
                safe = sanitize_svg(raw)
                width, height = svg_dimensions(safe)
                asset = DesignAsset(
                    user=request.user,
                    asset_type=DesignAsset.AssetType.UPLOAD,
                    original_name=original_name,
                    mime_type="image/svg+xml",
                    size_bytes=len(safe),
                    width=width,
                    height=height,
                )
                asset.file.save(f"{original_name.rsplit('.', 1)[0]}.svg", ContentFile(safe), save=False)
                asset.save()
            else:
                mime, width, height, image_format = validate_upload(upload)
                asset = DesignAsset(
                    user=request.user,
                    asset_type=DesignAsset.AssetType.UPLOAD,
                    original_name=original_name,
                    mime_type=mime,
                    size_bytes=upload.size,
                    width=width,
                    height=height,
                )
                asset.file.save(original_name, upload, save=False)
                asset.save()
        except UploadValidationError as exc:
            return Response({"detail": str(exc)}, status=400)

        return Response(
            DesignAssetSerializer(asset, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class AdminTemplateViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    serializer_class = AdminTemplateSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    queryset = DesignTemplate.objects.all().order_by("category", "name")
    pagination_class = None

    def perform_create(self, serializer):
        template = serializer.save()
        self._maybe_preview(template)

    def perform_update(self, serializer):
        template = serializer.save()
        if not template.preview_image:
            self._maybe_preview(template)

    def _maybe_preview(self, template):
        try:
            image, _warnings = render_canvas(template.canvas_json, 600)
            output = io.BytesIO()
            image.save(output, format="PNG")
            template.preview_image.save(f"template-{template.id}.png", ContentFile(output.getvalue()), save=True)
        except Exception as exc:
            logger.warning("Template preview failed: %s", exc)


class AdminClipartViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    serializer_class = AdminClipartSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    queryset = Clipart.objects.all().order_by("category", "name")
    pagination_class = None

    def perform_create(self, serializer):
        clipart = serializer.save()
        self._thumbnail(clipart)

    def perform_update(self, serializer):
        clipart = serializer.save()
        self._thumbnail(clipart)

    def _thumbnail(self, clipart):
        if not clipart.image:
            return
        try:
            image = Image.open(clipart.image.path).convert("RGBA")
            image.thumbnail((320, 320), Image.LANCZOS)
            output = io.BytesIO()
            image.save(output, format="PNG")
            clipart.thumbnail.save(f"thumb-{clipart.id}.png", ContentFile(output.getvalue()), save=True)
        except Exception as exc:
            logger.warning("Clipart thumbnail failed: %s", exc)


class AdminFontViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    serializer_class = AdminFontResourceSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    queryset = FontResource.objects.all().order_by("sort_order", "name")
    pagination_class = None

    def perform_create(self, serializer):
        upload = self.request.FILES.get("file")
        if upload and not upload.name.lower().endswith((".ttf", ".otf", ".woff", ".woff2")):
            from rest_framework.exceptions import ValidationError

            raise ValidationError({"file": "Font files must be TTF, OTF, WOFF, or WOFF2."})
        serializer.save()
