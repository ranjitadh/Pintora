from django.conf import settings
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from catalog.models import ProductStage
from core.permissions import IsAdminRole
from commerce.models import OrderItem
from designer.models import Design
from .models import GeneratedFile
from .serializers import GeneratedFileSerializer
from .services import process_generated_file


class ExportCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        design_id = request.data.get("design")
        order_item_id = request.data.get("order_item")
        stage_id = request.data.get("stage")
        file_type = str(request.data.get("file_type", "png")).lower()
        try:
            dpi = int(request.data.get("dpi", 300))
        except (TypeError, ValueError):
            return Response({"detail": "DPI must be a number."}, status=400)

        is_admin = request.user.is_superuser or request.user.role in ("admin", "staff")

        design = None
        order_item = None
        if order_item_id:
            order_item = OrderItem.objects.select_related("order", "design", "product").filter(
                pk=order_item_id
            ).first()
            if order_item is None:
                return Response({"detail": "Order item not found."}, status=404)
            if not is_admin and order_item.order.user_id != request.user.id:
                return Response({"detail": "You do not have access to this order."}, status=403)
            design = order_item.design

        if design is None and design_id:
            design = Design.objects.select_related("product", "stage").filter(pk=design_id).first()
            if design is None:
                return Response({"detail": "Design not found."}, status=404)
            if not is_admin and design.user_id != request.user.id:
                return Response({"detail": "You do not have access to this design."}, status=403)

        if design is None:
            return Response({"detail": "A design or order item is required."}, status=400)

        if not is_admin and file_type != "png":
            return Response({"detail": "Only PNG downloads are available for customer designs."}, status=403)
        if dpi < 72 or dpi > 600:
            return Response({"detail": "DPI must be between 72 and 600."}, status=400)
        if not is_admin:
            dpi = min(dpi, 150)
        if file_type not in ("png", "svg", "pdf"):
            return Response({"detail": "Unsupported export format."}, status=400)

        stage = None
        if stage_id:
            stage = ProductStage.objects.select_related("print_area").filter(
                pk=stage_id, product=design.product
            ).first()
            if stage is None:
                return Response({"detail": "Stage not found for this design."}, status=404)
        stage = stage or design.stage
        if stage is None or stage.print_area is None:
            return Response({"detail": "This design has no printable stage."}, status=400)

        generated = GeneratedFile.objects.create(
            design=design,
            order_item=order_item,
            stage=stage,
            requested_by=request.user,
            file_type=file_type,
            dpi=dpi,
            status=GeneratedFile.Status.PENDING,
        )

        if settings.CELERY_TASK_ALWAYS_EAGER:
            process_generated_file(str(generated.id))
        else:
            from .tasks import generate_export_task

            generate_export_task.delay(str(generated.id))

        generated.refresh_from_db()
        return Response(
            GeneratedFileSerializer(generated, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class ExportViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = GeneratedFileSerializer

    def get_queryset(self):
        user = self.request.user
        qs = GeneratedFile.objects.select_related("design", "stage", "order_item__order")
        if not (user.is_superuser or user.role in ("admin", "staff")):
            qs = qs.filter(design__user=user)
        design = self.request.query_params.get("design")
        if design:
            qs = qs.filter(design_id=design)
        order_item = self.request.query_params.get("order_item")
        if order_item:
            qs = qs.filter(order_item_id=order_item)
        return qs

    def retrieve(self, request, *args, **kwargs):
        generated = self.get_object()
        if generated.status == GeneratedFile.Status.PENDING and settings.CELERY_TASK_ALWAYS_EAGER:
            process_generated_file(str(generated.id))
            generated.refresh_from_db()
        return Response(GeneratedFileSerializer(generated, context={"request": request}).data)


class HealthView(APIView):
    permission_classes = []

    def get(self, request):
        return Response({"status": "ok", "service": "printora-api"})
