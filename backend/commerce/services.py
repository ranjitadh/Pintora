from decimal import Decimal

from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone

from catalog.models import PrintingMethod, Product, ProductVariant
from designer.models import Design
from .models import Cart, CartItem, Order, OrderItem, StoreConfiguration
from .pricing import calculate_price, money


class CartError(ValueError):
    pass


def quote_item(*, product, quantity=1, variant=None, design=None, printing_method=None):
    return calculate_price(
        product=product,
        quantity=quantity,
        variant=variant,
        design=design,
        printing_method=printing_method,
    )


def _shipping_for(subtotal, config):
    if config.free_shipping_threshold is not None and subtotal >= config.free_shipping_threshold:
        return Decimal("0.00")
    return money(config.shipping_fee)


def cart_totals(cart):
    config = StoreConfiguration.get_solo()
    items = list(cart.items.all())
    subtotal = Decimal("0")
    discount = Decimal("0")
    lines_total = Decimal("0")
    for item in items:
        quote = (item.configuration or {}).get("quote") or {}
        subtotal += Decimal(str(quote.get("subtotal", item.line_total)))
        discount += Decimal(str(quote.get("discount", "0")))
        lines_total += Decimal(item.line_total)
    subtotal = money(subtotal)
    discount = money(discount)
    lines_total = money(lines_total)
    shipping = _shipping_for(lines_total, config)
    tax = money(lines_total * config.tax_rate / 100) if config.tax_rate else Decimal("0.00")
    total = money(lines_total + shipping + tax)
    return {
        "subtotal": str(subtotal),
        "discount": str(discount),
        "shipping": str(shipping),
        "tax": str(tax),
        "total": str(total),
        "currency": config.currency,
        "free_shipping_threshold": str(config.free_shipping_threshold) if config.free_shipping_threshold is not None else None,
    }


def add_cart_item(user, *, product_id, variant_id=None, design_id=None, printing_method_id=None, quantity=1):
    try:
        product = Product.objects.get(pk=product_id, is_active=True)
    except Product.DoesNotExist:
        raise CartError("Product not found.")

    quantity = max(1, int(quantity or 1))

    variant = None
    if variant_id:
        variant = ProductVariant.objects.filter(pk=variant_id, product=product, is_active=True).first()
        if variant is None:
            raise CartError("The selected variant is not available.")
        if variant.stock_quantity <= 0:
            raise CartError(f"'{variant.name}' is currently out of stock.")

    printing_method = None
    if printing_method_id:
        printing_method = PrintingMethod.objects.filter(pk=printing_method_id, is_active=True).first()
        if printing_method is None or not product.printing_method_links.filter(printing_method=printing_method).exists():
            raise CartError("The selected printing method is not available.")

    design = None
    if design_id:
        design = Design.objects.filter(pk=design_id, user=user, product=product).first()
        if design is None:
            raise CartError("Design not found for this product.")
        if design.stage_id is None:
            design.stage = product.stages.filter(is_active=True).first()

    cart = Cart.get_active(user)

    existing = cart.items.filter(
        product=product,
        variant=variant,
        design=design,
        printing_method=printing_method,
    ).first()

    target_qty = (existing.quantity + quantity) if existing else quantity
    if variant and target_qty > variant.stock_quantity:
        raise CartError(
            f"Cannot add {quantity} item(s). Only {variant.stock_quantity} available in stock "
            f"(you already have {existing.quantity if existing else 0} in your bag)."
        )

    if existing:
        return update_cart_item(existing, target_qty)

    quote = quote_item(
        product=product, quantity=quantity, variant=variant, design=design, printing_method=printing_method
    )
    item = CartItem.objects.create(
        cart=cart,
        product=product,
        variant=variant,
        design=design,
        printing_method=printing_method,
        quantity=quantity,
        unit_price=Decimal(quote["unit_price"]),
        line_total=Decimal(quote["total"]),
        configuration={"quote": quote},
    )
    return item


def update_cart_item(item, quantity):
    quantity = max(1, int(quantity or 1))
    if item.variant:
        if item.variant.stock_quantity <= 0:
            raise CartError(f"'{item.variant.name}' is currently out of stock.")
        if quantity > item.variant.stock_quantity:
            raise CartError(
                f"Cannot update quantity to {quantity}. Only {item.variant.stock_quantity} available in stock."
            )
    quote = quote_item(
        product=item.product,
        quantity=quantity,
        variant=item.variant,
        design=item.design,
        printing_method=item.printing_method,
    )
    item.quantity = quantity
    item.unit_price = Decimal(quote["unit_price"])
    item.line_total = Decimal(quote["total"])
    item.configuration = {"quote": quote}
    item.save(update_fields=["quantity", "unit_price", "line_total", "configuration", "updated_at"])
    return item


@transaction.atomic
def checkout_cart(user, data):
    cart = Cart.objects.filter(user=user, status=Cart.Status.ACTIVE).first()
    if cart is None or not cart.items.exists():
        raise CartError("Your cart is empty.")

    # Validate stock and atomically lock variants to prevent overselling
    for item in cart.items.select_related("variant"):
        if item.variant_id:
            locked_variant = (
                ProductVariant.objects.select_for_update()
                .filter(pk=item.variant_id)
                .first()
            )
            if locked_variant is None or not locked_variant.is_active:
                raise CartError(f"Variant '{item.variant_name or 'item'}' is no longer available.")
            if locked_variant.stock_quantity < item.quantity:
                raise CartError(
                    f"Insufficient stock for {locked_variant.name}. "
                    f"Only {locked_variant.stock_quantity} available in stock, but your order requested {item.quantity}."
                )
            locked_variant.stock_quantity -= item.quantity
            locked_variant.save(update_fields=["stock_quantity", "updated_at"])

    config = StoreConfiguration.get_solo()
    order = Order.objects.create(
        user=user,
        email=data.get("email") or user.email,
        shipping_name=data["shipping_name"],
        shipping_phone=data.get("shipping_phone", ""),
        shipping_address=data["shipping_address"],
        shipping_city=data["shipping_city"],
        shipping_postal_code=data.get("shipping_postal_code", ""),
        shipping_country=data["shipping_country"],
        notes=data.get("notes", ""),
        currency=config.currency,
        metadata={"source": "local_demo_checkout" if config.demo_mode else "local_checkout"},
    )

    subtotal = Decimal("0")
    discount_total = Decimal("0")
    lines_total = Decimal("0")

    for item in cart.items.select_related("product", "variant", "design", "printing_method"):
        quote = quote_item(
            product=item.product,
            quantity=item.quantity,
            variant=item.variant,
            design=item.design,
            printing_method=item.printing_method,
        )
        item.unit_price = Decimal(quote["unit_price"])
        item.line_total = Decimal(quote["total"])
        item.configuration = {"quote": quote}
        item.save(update_fields=["unit_price", "line_total", "configuration"])

        subtotal += Decimal(quote["subtotal"])
        discount_total += Decimal(quote["discount"])
        lines_total += Decimal(quote["total"])

        order_item = OrderItem.objects.create(
            order=order,
            product=item.product,
            variant=item.variant,
            design=item.design,
            printing_method=item.printing_method,
            product_name=item.product.name,
            variant_name=item.variant.name if item.variant else "",
            printing_method_name=item.printing_method.name if item.printing_method else "",
            quantity=item.quantity,
            unit_price=item.unit_price,
            line_total=item.line_total,
            configuration={
                "variant": item.variant.name if item.variant else None,
                "color": item.variant.color_name if item.variant else None,
                "size": item.variant.size if item.variant else None,
                "design_id": str(item.design_id) if item.design_id else None,
                "stage_id": str(item.design.stage_id) if item.design and item.design.stage_id else None,
                "quote": quote,
            },
        )
        if item.design and item.design.preview_image:
            try:
                content = item.design.preview_image.read()
                order_item.preview_image.save(
                    f"order-{order.number}-{order_item.id}.png", ContentFile(content), save=False
                )
                order_item.save(update_fields=["preview_image"])
            except OSError:
                pass

    shipping = _shipping_for(money(lines_total), config)
    tax = money(money(lines_total) * config.tax_rate / 100) if config.tax_rate else Decimal("0.00")
    total = money(money(lines_total) + shipping + tax)

    order.subtotal = money(subtotal)
    order.discount = money(discount_total)
    order.shipping = shipping
    order.tax = tax
    order.total = total
    if data.get("demo", True) and config.demo_mode:
        order.status = Order.Status.PAID
        order.payment_status = Order.PaymentStatus.DEMO
        order.paid_at = timezone.now()
        order.metadata["payment_note"] = "Demo checkout — no real payment was processed."
    else:
        order.status = Order.Status.PENDING
        order.payment_status = Order.PaymentStatus.UNPAID
    order.save()

    cart.status = Cart.Status.CONVERTED
    cart.save(update_fields=["status", "updated_at"])
    for item in cart.items.all():
        if item.design_id:
            Design.objects.filter(pk=item.design_id).update(status=Design.Status.ORDERED)
    return order
