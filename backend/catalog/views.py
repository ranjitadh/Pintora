from django.db.models import Count, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from core.pagination import StandardPagination
from core.permissions import IsAdminRole
from .models import (
    PrintingMethod,
    Product,
    ProductCategory,
    ProductImage,
    ProductStage,
    ProductVariant,
    PricingRule,
)
from .serializers import (
    AdminCategorySerializer,
    AdminPricingRuleSerializer,
    AdminPrintAreaSerializer,
    AdminPrintingMethodSerializer,
    AdminProductSerializer,
    AdminStageSerializer,
    AdminVariantSerializer,
    PrintingMethodSerializer,
    ProductCategorySerializer,
    ProductDetailSerializer,
    ProductImageSerializer,
    ProductListSerializer,
)


def product_public_qs():
    return (
        Product.objects.filter(is_active=True)
        .select_related("category")
        .prefetch_related(
            "images",
            "variants",
            "stages__print_area",
            "printing_method_links__printing_method",
        )
    )


class ProductCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    serializer_class = ProductCategorySerializer
    lookup_field = "slug"
    pagination_class = None

    def get_queryset(self):
        return ProductCategory.objects.filter(is_active=True).annotate(
            product_count=Count("products", filter=Q(products__is_active=True))
        )


class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    lookup_field = "slug"
    pagination_class = StandardPagination

    def get_queryset(self):
        qs = product_public_qs()
        params = self.request.query_params
        search = params.get("search") or params.get("q")
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(short_description__icontains=search))
        category = params.get("category")
        if category:
            qs = qs.filter(category__slug=category)
        if params.get("featured") in ("1", "true", "True"):
            qs = qs.filter(is_featured=True)
        sort = params.get("sort", "newest")
        ordering = {
            "newest": "-created_at",
            "oldest": "created_at",
            "price_asc": "base_price",
            "price_desc": "-base_price",
            "name": "name",
            "name_desc": "-name",
        }.get(sort, "-created_at")
        return qs.order_by(ordering)

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ProductDetailSerializer
        return ProductListSerializer

    def paginate_queryset(self, queryset):
        if self.action == "list":
            return super().paginate_queryset(queryset)
        return None


class PrintingMethodViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    serializer_class = PrintingMethodSerializer
    queryset = PrintingMethod.objects.filter(is_active=True)
    pagination_class = None


class AdminCategoryViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    serializer_class = AdminCategorySerializer
    queryset = ProductCategory.objects.all().annotate(product_count=Count("products"))
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    pagination_class = None

    def get_serializer_context(self):
        return {"request": self.request}


class AdminProductViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    serializer_class = AdminProductSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        qs = Product.objects.select_related("category").prefetch_related("images", "stages").annotate(
            stage_count=Count("stages")
        )
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(name__icontains=search)
        return qs.order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["get", "post"], url_path="images")
    def images(self, request, pk=None):
        product = self.get_object()
        if request.method == "GET":
            serializer = ProductImageSerializer(
                product.images.all(), many=True, context={"request": request}
            )
            return Response(serializer.data)
        serializer = ProductImageSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        image = serializer.save(product=product)
        return Response(
            ProductImageSerializer(image, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["delete"], url_path=r"images/(?P<image_id>[^/.]+)")
    def delete_image(self, request, pk=None, image_id=None):
        product = self.get_object()
        try:
            image = product.images.get(pk=image_id)
        except ProductImage.DoesNotExist:
            return Response({"detail": "Image not found."}, status=status.HTTP_404_NOT_FOUND)
        image.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get", "post"], url_path="stages")
    def stages(self, request, pk=None):
        product = self.get_object()
        if request.method == "GET":
            serializer = AdminStageSerializer(
                product.stages.all(), many=True, context={"request": request}
            )
            return Response(serializer.data)
        serializer = AdminStageSerializer(
            data=request.data, context={"request": request, "product": product}
        )
        serializer.is_valid(raise_exception=True)
        stage = serializer.save(product=product)
        return Response(
            AdminStageSerializer(stage, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["get", "post"], url_path="printing-methods")
    def printing_methods(self, request, pk=None):
        from .models import ProductPrintingMethod
        from .serializers import ProductPrintingMethodSerializer

        product = self.get_object()
        if request.method == "GET":
            links = product.printing_method_links.select_related("printing_method").all()
            return Response(
                ProductPrintingMethodSerializer(links, many=True, context={"request": request}).data
            )
        printing_method_id = request.data.get("printing_method")
        if product.printing_method_links.filter(printing_method_id=printing_method_id).exists():
            return Response(
                {"detail": "This printing method is already linked to this product."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        link = ProductPrintingMethod.objects.create(
            product=product,
            printing_method_id=printing_method_id,
            price_adjustment=request.data.get("price_adjustment", 0),
            is_default=bool(request.data.get("is_default", False)),
        )
        if link.is_default:
            product.printing_method_links.exclude(pk=link.pk).update(is_default=False)
        return Response(
            ProductPrintingMethodSerializer(link, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["delete"], url_path=r"printing-methods/(?P<link_id>[^/.]+)")
    def delete_printing_method(self, request, pk=None, link_id=None):
        from .models import ProductPrintingMethod

        product = self.get_object()
        try:
            link = product.printing_method_links.get(pk=link_id)
        except ProductPrintingMethod.DoesNotExist:
            return Response({"detail": "Printing method link not found."}, status=404)
        link.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="set-cover")
    def set_cover(self, request, pk=None):
        product = self.get_object()
        image_id = request.data.get("image_id")
        try:
            image = product.images.get(pk=image_id)
        except ProductImage.DoesNotExist:
            return Response({"detail": "Image not found."}, status=status.HTTP_404_NOT_FOUND)
        product.image.save(image.image.name.split("/")[-1], image.image.file, save=True)
        return Response(AdminProductSerializer(product, context={"request": request}).data)


class AdminStageViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    serializer_class = AdminStageSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    queryset = ProductStage.objects.select_related("print_area", "product").order_by("sort_order")

    def get_queryset(self):
        qs = super().get_queryset()
        product = self.request.query_params.get("product")
        if product:
            qs = qs.filter(product_id=product)
        return qs

    @action(detail=True, methods=["get", "patch"], url_path="print-area")
    def print_area(self, request, pk=None):
        stage = self.get_object()
        if not stage.print_area:
            return Response({"detail": "This stage has no print area."}, status=404)
        area = stage.print_area
        if request.method == "GET":
            return Response(AdminPrintAreaSerializer(area).data)
        serializer = AdminPrintAreaSerializer(area, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class AdminVariantViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    serializer_class = AdminVariantSerializer
    pagination_class = None
    queryset = ProductVariant.objects.all().order_by("sort_order", "name")

    def get_queryset(self):
        qs = super().get_queryset()
        product = self.request.query_params.get("product")
        if product:
            qs = qs.filter(product_id=product)
        return qs


class AdminPrintingMethodViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    serializer_class = AdminPrintingMethodSerializer
    queryset = PrintingMethod.objects.all()
    pagination_class = None


class AdminPricingRuleViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    serializer_class = AdminPricingRuleSerializer
    queryset = PricingRule.objects.all().select_related("product", "printing_method")
    pagination_class = None

    def get_queryset(self):
        qs = super().get_queryset()
        product = self.request.query_params.get("product")
        if product:
            qs = qs.filter(product_id=product)
        return qs
