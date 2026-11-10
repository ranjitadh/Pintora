"""Deterministic, privacy-safe order answers for the MerchPress Assistant.

Private order data is never sent to an AI provider. Order questions are
answered directly from the database, scoped to the signed-in account only.
"""
import re

from django.utils import timezone

from .faq import shipping_summary

ORDER_NUMBER_RE = re.compile(r"\bPR-\d{6}-[A-Z0-9]{6}\b", re.IGNORECASE)
ORDER_INTENT_RE = re.compile(
    r"\b("
    r"my orders?|order status|order update|order number|"
    r"track(?:ing)?\s+(?:my\s+)?order|"
    r"where(?:'|’)?s?\s+(?:is\s+)?my\s+(?:order|package|delivery)|"
    r"has\s+my\s+order|when\s+will\s+my\s+order|"
    r"look\s*up\s+(?:my\s+)?order|check\s+my\s+order|find\s+my\s+order|"
    r"status\s+of\s+my\s+order|order\s+history"
    r")",
    re.IGNORECASE,
)


def looks_like_order_question(message):
    return bool(ORDER_INTENT_RE.search(message) or ORDER_NUMBER_RE.search(message))


def _money(order):
    try:
        amount = f"{order.total:,.2f}"
    except (TypeError, ValueError):
        amount = str(order.total)
    return f"${amount}" if order.currency == "USD" else f"{order.currency} {amount}"


def _item_count(order):
    return sum(item.quantity for item in order.items.all())


def _order_summary(order, prefix="Your latest order"):
    placed = timezone.localtime(order.created_at).strftime("%B %d, %Y")
    items = _item_count(order)
    item_label = "item" if items == 1 else "items"
    sentence = (
        f"{prefix} {order.number} is {order.get_status_display().lower()}. "
        f"Payment status: {order.get_payment_status_display()}. "
        f"Total: {_money(order)} for {items} {item_label}, placed {placed}."
    )
    if order.status == "cancelled":
        sentence += " This order was cancelled, so it will not be printed."
    elif order.status in ("completed", "ready_for_production"):
        sentence += " Open the order page for the latest production and delivery updates."
    else:
        sentence += " Open the order page for the latest updates."
    return sentence


def order_reply(user, message):
    """Return ``(reply, action)`` for an order-related message.

    ``user`` must be an authenticated user; the caller handles anonymous
    visitors so private data is never queried without an account.
    """
    orders = user.orders.all()
    match = ORDER_NUMBER_RE.search(message)
    if match:
        requested_number = match.group(0).upper()
        order = orders.filter(number__iexact=requested_number).first()
        if order is None:
            return (
                "I couldn't find that order number on the signed-in account. For "
                "privacy, I can only show orders placed with this account. Check the "
                "order number or open your Orders page.",
                {"label": "Open orders", "href": "/orders"},
            )
        return _order_summary(order, prefix="Order"), {
            "label": "View order",
            "href": f"/orders/{order.id}",
        }

    order = orders.order_by("-created_at").first()
    if order is None:
        return (
            "You don't have any orders on this account yet. Once you check out, your "
            "order status will appear on the Orders page.",
            {"label": "Browse products", "href": "/shop"},
        )

    if orders.count() > 1:
        return (
            _order_summary(order)
            + " You have more than one order; open Orders to pick a different one.",
            {"label": "View order", "href": f"/orders/{order.id}"},
        )
    return _order_summary(order), {"label": "View order", "href": f"/orders/{order.id}"}


def anonymous_order_reply():
    return (
        "Order details are private. Sign in and I can check your latest order status "
        f"for you. In the meantime: {shipping_summary()}",
        {"label": "Sign in to view orders", "href": "/login?next=/orders"},
    )
