"""Server-authoritative pricing for customized products."""
from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from catalog.models import PricingRule, Product, ProductVariant
from designer.validation import extract_stage_canvas

TWO = Decimal("0.01")


def money(value) -> Decimal:
    return Decimal(value or 0).quantize(TWO, rounding=ROUND_HALF_UP)


def design_statistics(design) -> dict:
    stats = {
        "print_areas": 0,
        "images": 0,
        "cliparts": 0,
        "characters": 0,
        "lines": 0,
        "colors": set(),
        "shapes": 0,
        "objects": 0,
    }
    if design is None:
        return {**stats, "colors": set()}

    payload = design.canvas_json or {}
    stage_canvases = payload.get("stages") if isinstance(payload, dict) else None
    canvases = list(stage_canvases.values()) if isinstance(stage_canvases, dict) else [payload]

    for canvas in canvases:
        objects = [o for o in canvas.get("objects", []) if isinstance(o, dict)]
        if objects:
            stats["print_areas"] += 1
        for obj in objects:
            stats["objects"] += 1
            obj_type = obj.get("type")
            printora_type = obj.get("printoraType")
            if obj_type == "image":
                if printora_type == "clipart":
                    stats["cliparts"] += 1
                else:
                    stats["images"] += 1
            elif obj_type in ("text", "i-text", "textbox"):
                text = str(obj.get("text", ""))
                stats["characters"] += len(text)
                stats["lines"] += max(1, len(text.split("\n")))
            elif obj_type in ("rect", "circle", "triangle", "line", "polygon", "path"):
                stats["shapes"] += 1
            for field in ("fill", "stroke"):
                color = obj.get(field)
                if isinstance(color, str) and color.startswith("#"):
                    stats["colors"].add(color.lower())
    return stats


def _rules_for(product, printing_method):
    from django.db.models import Q

    return PricingRule.objects.filter(is_active=True, product__in=[product, None]).filter(
        Q(printing_method__isnull=True) | Q(printing_method=printing_method)
    )


def calculate_price(*, product: Product, quantity: int = 1, variant: ProductVariant | None = None,
                    design=None, printing_method=None) -> dict:
    quantity = max(1, int(quantity or 1))
    if variant is not None and variant.product_id != product.id:
        raise ValueError("The selected variant does not belong to this product.")

    product_link = None
    if printing_method is not None:
        product_link = product.printing_method_links.filter(printing_method=printing_method).first()
        if product_link is None:
            raise ValueError("The selected printing method is not available for this product.")

    stats = design_statistics(design)
    unit_lines = []
    unit = Decimal(product.base_price)

    if variant is not None:
        delta = Decimal(variant.price_delta)
        if delta:
            unit += delta
            unit_lines.append({"label": f"Variant: {variant.name}", "amount": str(money(delta))})

    if printing_method is not None:
        method_fee = Decimal(printing_method.base_fee) + Decimal(printing_method.per_area_fee) * stats["print_areas"]
        if product_link and product_link.price_adjustment:
            method_fee += Decimal(product_link.price_adjustment)
        if method_fee:
            unit += method_fee
            unit_lines.append(
                {"label": f"Printing method: {printing_method.name}", "amount": str(money(method_fee))}
            )

    rules = _rules_for(product, printing_method)
    rule_amounts = {
        "base_surcharge": Decimal("0"),
        "per_quantity": Decimal("0"),
        "per_print_area": Decimal("0"),
        "per_image": Decimal("0"),
        "per_clipart": Decimal("0"),
        "per_character": Decimal("0"),
        "per_line": Decimal("0"),
        "per_color": Decimal("0"),
        "per_design": Decimal("0"),
        "per_shape": Decimal("0"),
        "per_variant": Decimal("0"),
    }
    for rule in rules:
        amount = Decimal(rule.amount)
        rule_type = rule.rule_type
        if rule_type == "per_quantity":
            value = amount * quantity
        elif rule_type == "per_print_area":
            value = amount * stats["print_areas"]
        elif rule_type == "per_image":
            value = amount * stats["images"]
        elif rule_type == "per_clipart":
            value = amount * stats["cliparts"]
        elif rule_type == "per_character":
            value = amount * stats["characters"]
        elif rule_type == "per_line":
            value = amount * stats["lines"]
        elif rule_type == "per_color":
            value = amount * len(stats["colors"])
        elif rule_type == "per_design":
            value = amount if stats["objects"] else Decimal("0")
        elif rule_type == "per_shape":
            value = amount * stats["shapes"]
        elif rule_type == "per_variant":
            value = amount if variant is not None else Decimal("0")
        else:
            value = amount
        rule_amounts[rule_type] += value

    for rule_type, value in rule_amounts.items():
        if value:
            unit += value
            unit_lines.append(
                {
                    "label": dict(PricingRule.RuleType.choices).get(rule_type, rule_type),
                    "amount": str(money(value)),
                }
            )

    subtotal = money(unit * quantity)

    discount_percent = Decimal("0")
    for discount in sorted(product.quantity_discounts or [], key=lambda d: d.get("min_qty", 0), reverse=True):
        try:
            if quantity >= int(discount.get("min_qty", 0)):
                discount_percent = Decimal(str(discount.get("percent", 0)))
                break
        except (TypeError, ValueError):
            continue
    discount = money(subtotal * discount_percent / 100) if discount_percent else Decimal("0.00")
    total = money(subtotal - discount)

    return {
        "currency": product.currency,
        "quantity": quantity,
        "unit_price": str(money(unit)),
        "subtotal": str(subtotal),
        "discount_percent": str(discount_percent.normalize()) if discount_percent else "0",
        "discount": str(discount),
        "total": str(total),
        "breakdown": unit_lines,
        "design_stats": {
            "print_areas": stats["print_areas"],
            "images": stats["images"],
            "cliparts": stats["cliparts"],
            "characters": stats["characters"],
            "lines": stats["lines"],
            "colors": len(stats["colors"]),
            "shapes": stats["shapes"],
            "objects": stats["objects"],
        },
    }
