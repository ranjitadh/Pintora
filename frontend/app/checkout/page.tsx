"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Lock, ShieldCheck, Truck } from "lucide-react";
import { api, errorMessage, mediaUrl } from "@/lib/api";
import { notifyCart, useAuth } from "@/lib/auth";
import type { Cart, Order } from "@/lib/types";
import { money } from "@/lib/utils";
import { Alert, Button, Field, LinkButton, LoadingBlock } from "@/components/ui";

export default function CheckoutPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    shipping_name: "",
    shipping_phone: "",
    shipping_address: "",
    shipping_city: "",
    shipping_postal_code: "",
    shipping_country: "United States",
    notes: "",
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    setForm((current) => ({
      ...current,
      shipping_name: current.shipping_name || `${user.first_name || ""} ${user.last_name || ""}`.trim(),
      shipping_phone: current.shipping_phone || user.profile?.phone || "",
      shipping_address: current.shipping_address || user.profile?.address || "",
      shipping_city: current.shipping_city || user.profile?.city || "",
      shipping_postal_code: current.shipping_postal_code || user.profile?.postal_code || "",
      shipping_country: user.profile?.country || current.shipping_country,
    }));
    api
      .get<Cart>("/cart/")
      .then(setCart)
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const order = await api.post<Order>("/orders/", { ...form, demo: true });
      notifyCart();
      router.push(`/orders/${order.id}?placed=1`);
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  };

  if (authLoading || (user && loading)) return <LoadingBlock label="Preparing checkout…" />;

  if (!user) {
    return (
      <div className="container-x py-16 text-center">
        <p className="font-display text-3xl">Sign in to check out.</p>
        <LinkButton href="/login?next=/checkout" className="mt-5">Sign in</LinkButton>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="container-x py-16 text-center">
        <p className="font-display text-3xl">Your bag is empty.</p>
        <LinkButton href="/shop" className="mt-5" variant="secondary">Back to shop</LinkButton>
      </div>
    );
  }

  return (
    <div className="container-x py-10 lg:py-14">
      <Link href="/cart" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink">
        <ArrowLeft size={14} /> Back to bag
      </Link>
      <div className="mt-4">
        <p className="eyebrow">Secure checkout</p>
        <h1 className="mt-2 display-title">Where should we send it?</h1>
      </div>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_380px]">
        <form onSubmit={submit} className="card space-y-5 p-6 sm:p-8">
          {error && <Alert>{error}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <input required value={form.shipping_name} onChange={(event) => update("shipping_name", event.target.value)} className="field" />
            </Field>
            <Field label="Phone (optional)">
              <input value={form.shipping_phone} onChange={(event) => update("shipping_phone", event.target.value)} className="field" />
            </Field>
          </div>
          <Field label="Street address">
            <input required value={form.shipping_address} onChange={(event) => update("shipping_address", event.target.value)} className="field" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="City">
              <input required value={form.shipping_city} onChange={(event) => update("shipping_city", event.target.value)} className="field" />
            </Field>
            <Field label="Postal code">
              <input value={form.shipping_postal_code} onChange={(event) => update("shipping_postal_code", event.target.value)} className="field" />
            </Field>
            <Field label="Country">
              <input required value={form.shipping_country} onChange={(event) => update("shipping_country", event.target.value)} className="field" />
            </Field>
          </div>
          <Field label="Order notes (optional)">
            <textarea rows={3} value={form.notes} onChange={(event) => update("notes", event.target.value)} className="field resize-none" />
          </Field>

          <div className="rounded-2xl border border-ink/10 bg-sand/40 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><Lock size={15} /> Demo payment</div>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              This storefront is running in demo mode. Placing the order marks it as demo-paid and moves it into the
              production workflow. No card details are collected and no real charge is made.
            </p>
          </div>

          <Button type="submit" size="lg" className="w-full" loading={submitting}>
            Place demo order · {money(cart.totals.total)}
          </Button>
          <p className="text-center text-[10px] text-muted">By placing this order you agree to the demo store terms.</p>
        </form>

        <aside className="card space-y-4 p-6 lg:sticky lg:top-24">
          <h2 className="font-display text-2xl">Your order</h2>
          <div className="max-h-[300px] space-y-3 overflow-y-auto pr-1">
            {cart.items.map((item) => (
              <div key={item.id} className="flex gap-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-sand">
                  {item.design_detail?.preview_url || item.product_detail.image_url ? (
                    <img src={mediaUrl(item.design_detail?.preview_url || item.product_detail.image_url)} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.product_detail.name}</p>
                  <p className="text-[11px] text-muted">
                    {[item.variant_detail?.color_name, item.variant_detail?.size].filter(Boolean).join(" / ")} · Qty {item.quantity}
                  </p>
                </div>
                <span className="text-xs font-semibold">{money(item.line_total)}</span>
              </div>
            ))}
          </div>
          <div className="space-y-1.5 border-t border-ink/10 pt-3 text-sm">
            <div className="flex justify-between text-muted"><span>Subtotal</span><span>{money(cart.totals.subtotal)}</span></div>
            {Number(cart.totals.discount) > 0 && <div className="flex justify-between text-olive"><span>Discount</span><span>−{money(cart.totals.discount)}</span></div>}
            <div className="flex justify-between text-muted"><span>Shipping</span><span>{Number(cart.totals.shipping) === 0 ? "Free" : money(cart.totals.shipping)}</span></div>
            <div className="flex justify-between text-muted"><span>Tax</span><span>{money(cart.totals.tax)}</span></div>
            <div className="flex items-baseline justify-between border-t border-ink/10 pt-2">
              <span className="font-semibold">Total</span>
              <span className="font-display text-2xl">{money(cart.totals.total)}</span>
            </div>
          </div>
          <div className="space-y-2 border-t border-ink/10 pt-3 text-[11px] text-muted">
            <p className="flex items-center gap-2"><Truck size={13} /> Ships in 2–4 business days</p>
            <p className="flex items-center gap-2"><ShieldCheck size={13} /> Print-ready files generated at 300 DPI</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
