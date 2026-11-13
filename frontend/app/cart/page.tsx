"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { api, errorMessage, mediaUrl } from "@/lib/api";
import { notifyCart, useAuth } from "@/lib/auth";
import type { Cart } from "@/lib/types";
import { money } from "@/lib/utils";
import { Alert, Button, EmptyState, LinkButton, LoadingBlock } from "@/components/ui";

export default function CartPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyItem, setBusyItem] = useState("");

  const loadCart = () => {
    if (!user) return;
    api
      .get<Cart>("/cart/")
      .then(setCart)
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    loadCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (quantity < 1) return;
    setBusyItem(itemId);
    setError("");
    try {
      const updated = await api.patch<Cart>(`/cart/items/${itemId}/`, { quantity });
      setCart(updated);
      notifyCart();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyItem("");
    }
  };

  const removeItem = async (itemId: string) => {
    setBusyItem(itemId);
    setError("");
    try {
      const updated = await api.delete<Cart>(`/cart/items/${itemId}/`);
      setCart(updated);
      notifyCart();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyItem("");
    }
  };

  if (authLoading || (user && loading)) return <LoadingBlock label="Fetching your bag…" />;

  if (!user) {
    return (
      <div className="container-x py-16">
        <EmptyState
          icon={<ShoppingBag />}
          title="Sign in to see your bag"
          description="Your cart is tied to your studio account so designs and print files stay with you."
          action={<LinkButton href="/login?next=/cart">Sign in</LinkButton>}
        />
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="container-x py-16">
        <EmptyState
          icon={<ShoppingBag />}
          title="Your bag is empty"
          description="Find a canvas and make something only you could make."
          action={<LinkButton href="/shop">Start designing</LinkButton>}
        />
      </div>
    );
  }

  return (
    <div className="container-x py-10 lg:py-14">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Your bag</p>
          <h1 className="mt-2 display-title">Almost yours.</h1>
        </div>
        <Link href="/shop" className="link-underline text-sm font-semibold">Keep shopping</Link>
      </div>

      {error && <div className="mt-5"><Alert>{error}</Alert></div>}

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {cart.items.map((item) => (
            <div key={item.id} className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-sand">
                {item.design_detail?.preview_url || item.product_detail.image_url ? (
                  <img
                    src={mediaUrl(item.design_detail?.preview_url || item.product_detail.image_url)}
                    alt={item.product_detail.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted">Preview</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted">{item.product_detail.category?.name || "Custom"}</p>
                    <h2 className="font-display text-xl">{item.product_detail.name}</h2>
                    <p className="mt-1 text-xs text-muted">
                      {[item.variant_detail?.color_name, item.variant_detail?.size].filter(Boolean).join(" / ")}
                      {item.printing_method_name ? ` · ${item.printing_method_name}` : ""}
                    </p>
                    {item.design_detail && (
                      <p className="mt-1 text-xs text-muted">
                        Artwork: {item.design_detail.name}{" "}
                        {item.product_detail.slug && (
                          <Link href={`/editor/${item.product_detail.slug}?design=${item.design_detail.id}`} className="text-clay underline">
                            edit
                          </Link>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{money(item.line_total)}</p>
                    <p className="text-[10px] text-muted">{money(item.unit_price)} each</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <button
                      disabled={busyItem === item.id}
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      aria-label={`Decrease quantity of ${item.product_detail.name}`}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-ink/15 hover:border-ink disabled:opacity-40"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="w-9 text-center text-sm font-semibold">{item.quantity}</span>
                    <button
                      disabled={busyItem === item.id}
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      aria-label={`Increase quantity of ${item.product_detail.name}`}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-ink/15 hover:border-ink disabled:opacity-40"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                  <button
                    disabled={busyItem === item.id}
                    onClick={() => removeItem(item.id)}
                    className="flex items-center gap-1 text-xs text-muted hover:text-rose-600 disabled:opacity-40"
                  >
                    <Trash2 size={13} /> Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <aside className="card space-y-3 p-6 lg:sticky lg:top-24">
          <h2 className="font-display text-2xl">Order summary</h2>
          <div className="space-y-2 border-t border-ink/10 pt-3 text-sm">
            <div className="flex justify-between text-muted"><span>Subtotal</span><span>{money(cart.totals.subtotal)}</span></div>
            {Number(cart.totals.discount) > 0 && (
              <div className="flex justify-between text-olive"><span>Discount</span><span>−{money(cart.totals.discount)}</span></div>
            )}
            <div className="flex justify-between text-muted">
              <span>Shipping</span>
              <span>{Number(cart.totals.shipping) === 0 ? "Free" : money(cart.totals.shipping)}</span>
            </div>
            <div className="flex justify-between text-muted"><span>Tax</span><span>{money(cart.totals.tax)}</span></div>
            <div className="flex items-baseline justify-between border-t border-ink/10 pt-3">
              <span className="font-semibold">Total</span>
              <span className="font-display text-3xl">{money(cart.totals.total, cart.totals.currency)}</span>
            </div>
          </div>
          {cart.totals.free_shipping_threshold && Number(cart.totals.shipping) > 0 && (
            <p className="rounded-lg bg-sand/70 px-3 py-2 text-[11px] text-muted">
              Add {money(Number(cart.totals.free_shipping_threshold) - Number(cart.totals.subtotal) + Number(cart.totals.discount))} more for free shipping.
            </p>
          )}
          <Button size="lg" className="w-full" onClick={() => router.push("/checkout")}>
            Checkout <ArrowRight size={16} />
          </Button>
          <p className="text-center text-[10px] text-muted">
            Demo checkout — no card required and no real charge is made.
          </p>
        </aside>
      </div>
    </div>
  );
}
