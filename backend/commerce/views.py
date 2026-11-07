import json
import logging

from django.db.models import Count, Q, Sum
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from catalog.models import PrintingMethod, Product, ProductVariant
from core.permissions import IsAdminRole
from designer.models import Design
from designer.serializers import DesignListSerializer
from .models import Cart, CartItem, Order, StoreConfiguration, WebhookEvent
from .pricing import money
from .serializers import (
    AdminOrderUpdateSerializer,
    CartItemSerializer,
    CartSerializer,
    CheckoutSerializer,
    OrderListSerializer,
    OrderSerializer,
    StoreConfigSerializer,
    WebhookEventSerializer,
)
from .services import CartError, add_cart_item, checkout_cart, quote_item, update_cart_item
from .shopify import ShopifyError, fetch_products, import_products, mark_order_from_webhook, verify_webhook_hmac

logger = logging.getLogger(__name__)


class PricingView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        product_id = request.data.get("product")
        try:
            product = Product.objects.get(pk=product_id, is_active=True)
        except (Product.DoesNotExist, ValueError, TypeError):
            return Response({"detail": "Product not found."}, status=404)

        variant = None
        if request.data.get("variant"):
            variant = ProductVariant.objects.filter(
                pk=request.data["variant"], product=product, is_active=True
            ).first()
            if variant is None:
                return Response({"detail": "Variant not found."}, status=400)

        printing_method = None
        if request.data.get("printing_method"):
            printing_method = PrintingMethod.objects.filter(
                pk=request.data["printing_method"], is_active=True
            ).first()
            if printing_method is None:
                return Response({"detail": "Printing method not found."}, status=400)

        design = None
        if request.data.get("design"):
            design = Design.objects.filter(pk=request.data["design"]).first()
            if design is None:
                return Response({"detail": "Design not found."}, status=404)
            if not (request.user.is_authenticated and (
                design.user_id == request.user.id or request.user.is_superuser or request.user.role in ("admin", "staff")
            )):
                return Response({"detail": "You do not have access to this design."}, status=403)

        try:
            quantity = int(request.data.get("quantity", 1))
        except (TypeError, ValueError):
            return Response({"detail": "Quantity must be a number."}, status=400)
        if quantity < 1 or quantity > 1000:
            return Response({"detail": "Quantity must be between 1 and 1000."}, status=400)

        try:
            quote = quote_item(
                product=product,
                quantity=quantity,
                variant=variant,
                design=design,
                printing_method=printing_method,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)
        return Response(quote)


class CartView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cart = Cart.get_active(request.user)
        return Response(CartSerializer(cart, context={"request": request}).data)

    def delete(self, request):
        cart = Cart.get_active(request.user)
        cart.items.all().delete()
        return Response(CartSerializer(cart, context={"request": request}).data)


class CartItemsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        product_id = request.data.get("product")
        quantity = request.data.get("quantity", 1)
        try:
            quantity = int(quantity)
        except (TypeError, ValueError):
            return Response({"detail": "Quantity must be a number."}, status=400)
        if quantity < 1 or quantity > 1000:
            return Response({"detail": "Quantity must be between 1 and 1000."}, status=400)
        try:
            item = add_cart_item(
                request.user,
                product_id=product_id,
                variant_id=request.data.get("variant"),
                design_id=request.data.get("design"),
                printing_method_id=request.data.get("printing_method"),
                quantity=quantity,
            )
        except CartError as exc:
            return Response({"detail": str(exc)}, status=400)
        cart = item.cart
        return Response(CartSerializer(cart, context={"request": request}).data, status=201)


class CartItemView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_item(self, request, item_id):
        return CartItem.objects.select_related("cart", "product", "variant", "design").filter(
            pk=item_id, cart__user=request.user, cart__status=Cart.Status.ACTIVE
        ).first()

    def patch(self, request, item_id):
        item = self._get_item(request, item_id)
        if item is None:
            return Response({"detail": "Cart item not found."}, status=404)
        try:
            quantity = int(request.data.get("quantity", item.quantity))
        except (TypeError, ValueError):
            return Response({"detail": "Quantity must be a number."}, status=400)
        if quantity < 1 or quantity > 1000:
            return Response({"detail": "Quantity must be between 1 and 1000."}, status=400)
        item = update_cart_item(item, quantity)
        return Response(CartSerializer(item.cart, context={"request": request}).data)

    def delete(self, request, item_id):
        item = self._get_item(request, item_id)
        if item is None:
            return Response({"detail": "Cart item not found."}, status=404)
        cart = item.cart
        item.delete()
        return Response(CartSerializer(cart, context={"request": request}).data)


class OrderListCreateView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = OrderListSerializer

    def get_queryset(self):
        qs = Order.objects.filter(user=self.request.user).prefetch_related("items")
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def post(self, request):
        serializer = CheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            order = checkout_cart(request.user, serializer.validated_data)
        except CartError as exc:
            return Response({"detail": str(exc)}, status=400)
        return Response(
            OrderSerializer(order, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class OrderDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = OrderSerializer

    def get_queryset(self):
        qs = Order.objects.prefetch_related("items__generated_files")
        if self.request.user.is_superuser or self.request.user.role in ("admin", "staff"):
            return qs
        return qs.filter(user=self.request.user)


class AdminOrderViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        qs = Order.objects.select_related("user").prefetch_related(
            "items__generated_files", "items__design"
        )
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(number__icontains=search) | Q(email__icontains=search) | Q(user__email__icontains=search)
            )
        return qs.order_by("-created_at")

    def get_serializer_class(self):
        if self.action in ("update", "partial_update"):
            return AdminOrderUpdateSerializer
        if self.action == "list":
            return OrderListSerializer
        return OrderSerializer

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = AdminOrderUpdateSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(OrderSerializer(instance, context={"request": request}).data)

    @action(detail=True, methods=["get"])
    def production(self, request, pk=None):
        order = self.get_object()
        return Response(
            {
                "order": OrderSerializer(order, context={"request": request}).data,
                "downloadable": [
                    {
                        "item_id": str(item.id),
                        "product_name": item.product_name,
                        "quantity": item.quantity,
                        "design_id": str(item.design_id) if item.design_id else None,
                        "stage_id": str(item.design.stage_id) if item.design and item.design.stage_id else None,
                        "preview_url": request.build_absolute_uri(item.preview_image.url) if item.preview_image else None,
                    }
                    for item in order.items.all()
                ],
            }
        )


class StoreConfigView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        config = StoreConfiguration.get_solo()
        return Response(StoreConfigSerializer(config).data)


class AdminStoreConfigView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        return Response(StoreConfigSerializer(StoreConfiguration.get_solo()).data)

    def patch(self, request):
        config = StoreConfiguration.get_solo()
        serializer = StoreConfigSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(StoreConfigSerializer(config).data)


class AdminDashboardView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        order_revenue = Order.objects.exclude(
            status__in=[Order.Status.CANCELLED, Order.Status.PENDING]
        ).aggregate(total=Sum("total"))["total"] or 0
        data = {
            "products": Product.objects.count(),
            "active_products": Product.objects.filter(is_active=True).count(),
            "customers": User.objects.filter(role="customer", is_superuser=False).count(),
            "designs": Design.objects.count(),
            "orders": Order.objects.count(),
            "pending_orders": Order.objects.exclude(
                status__in=[Order.Status.COMPLETED, Order.Status.CANCELLED]
            ).count(),
            "revenue": str(money(order_revenue)),
            "recent_orders": OrderListSerializer(
                Order.objects.prefetch_related("items").order_by("-created_at")[:8],
                many=True,
                context={"request": request},
            ).data,
            "recent_designs": DesignListSerializer(
                Design.objects.select_related("product").order_by("-updated_at")[:8],
                many=True,
                context={"request": request},
            ).data,
            "orders_by_status": list(
                Order.objects.values("status").annotate(count=Count("id")).order_by("status")
            ),
        }
        return Response(data)


@method_decorator(csrf_exempt, name="dispatch")
class ShopifyWebhookView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    parser_classes = []

    def post(self, request):
        raw = request.body
        digest = request.headers.get("X-Shopify-Hmac-Sha256", "")
        topic = request.headers.get("X-Shopify-Topic", "unknown")
        external_id = request.headers.get("X-Shopify-Webhook-Id", "")
        if not verify_webhook_hmac(raw, digest):
            return Response({"detail": "Invalid webhook signature."}, status=401)
        try:
            payload = json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return Response({"detail": "Invalid JSON payload."}, status=400)

        if not external_id:
            external_id = str(payload.get("id", ""))[:120]

        if external_id and WebhookEvent.objects.filter(topic=topic, external_id=external_id).exists():
            return Response({"status": "duplicate_ignored"})

        event = WebhookEvent.objects.create(
            topic=topic, external_id=external_id, payload=payload, verified=True
        )
        try:
            result = "stored"
            if topic in ("orders/create", "orders/paid", "orders/updated"):
                result = mark_order_from_webhook(payload)
            event.processed = True
            event.save(update_fields=["processed", "updated_at"])
            return Response({"status": result})
        except Exception as exc:
            logger.exception("Shopify webhook processing failed")
            event.error = str(exc)[:2000]
            event.save(update_fields=["error", "updated_at"])
            return Response({"status": "accepted_with_errors", "detail": "Webhook stored; processing failed."})


class AdminShopifyStatusView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        from django.conf import settings as django_settings

        config = StoreConfiguration.get_solo()
        return Response(
            {
                "credentials_configured": config.shopify_credentials_configured,
                "store_domain": django_settings.SHOPIFY_STORE_DOMAIN,
                "api_version": django_settings.SHOPIFY_API_VERSION,
                "webhook_secret_configured": bool(django_settings.SHOPIFY_WEBHOOK_SECRET),
                "enabled": config.shopify_enabled,
                "demo_mode": config.demo_mode,
                "webhook_url": request.build_absolute_uri("/api/shopify/webhooks/"),
            }
        )


class AdminShopifySyncView(APIView):
    permission_classes = [IsAdminRole]

    def post(self, request):
        try:
            products = fetch_products(limit=int(request.data.get("limit", 50)))
        except ShopifyError as exc:
            return Response(
                {
                    "detail": str(exc),
                    "hint": "The local demo storefront remains fully usable without Shopify credentials.",
                },
                status=400,
            )
        if request.data.get("import"):
            result = import_products(products, user=request.user)
            return Response({"imported": result, "products": products})
        return Response({"products": products, "count": len(products)})


class AdminWebhookEventListView(generics.ListAPIView):
    permission_classes = [IsAdminRole]
    serializer_class = WebhookEventSerializer
    queryset = WebhookEvent.objects.all()
