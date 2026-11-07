"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ArrowLeft, Check, Download, FileDown, PackageCheck, PenTool, Printer, Truck } from "lucide-react";
import { api, errorMessage, mediaUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { GeneratedFile, Order, OrderItem } from "@/lib/types";
import { formatDate, money, statusTone, titleCase } from "@/lib/utils";
import { Alert, Badge, Button, LinkButton, LoadingBlock } from "@/components/ui";

const FLOW: { status: string; label: string; icon: any }[] = [
  { status: "paid", label: "Paid", icon: Check },
  { status: "processing", label: "Processing", icon: PackageCheck },
  { status: "ready_for_production", label: "Ready", icon: PenTool },
  { status: "printing", label: "Printing", icon: Printer },
  { status: "completed", label: "Completed", icon: Truck },
];

function OrderDetailContent() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState("");
  const placed = search.get("placed") === "1";

  const loadOrder = () => {
    api
      .get<Order>(`/orders/${params.id}/`)
      .then(setOrder)
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    loadOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, user, authLoading]);

  const generateExport = async (item: OrderItem) => {
    setExporting(item.id);
    setError("");
    try {
      await api.post<GeneratedFile>("/exports/create/", { order_item: item.id, file_type: "png", dpi: 150 });
      loadOrder();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setExporting("");
    }
  };

  if (authLoading || (user && loading)) return <LoadingBlock label="Opening your order…" />;
  if (!user) {
    return (
      <div className="container-x py-16 text-center">
        <p className="font-display text-3xl">Sign in to view this order.</p>
        <LinkButton href={`/login?next=/orders/${params.id}`} className="mt-5">Sign in</LinkButton>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container-x py-16 text-center">
        <Alert>{error || "Order not found."}</Alert>
        <LinkButton href="/orders" className="mt-5" variant="secondary">Back to orders</LinkButton>
      </div>
    );
  }

  const currentIndex = FLOW.findIndex((step) => step.status === order.status);
  const cancelled = order.status === "cancelled";

  return (
    <div className="container-x py-10 lg:py-14">
      <Link href="/orders" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink">
        <ArrowLeft size={14} /> All orders
      </Link>

      {placed && (
        <div className="mt-4">
          <Alert tone="success">
            Order placed! Your demo payment is confirmed and the studio has your print files.
          </Alert>
        </div>
      )}
      {error && <div className="mt-4"><Alert>{error}</Alert></div>}

      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Order {order.number}</p>
          <h1 className="mt-2 font-display text-4xl">{titleCase(order.status)}</h1>
          <p className="mt-2 text-xs text-muted">Placed {formatDate(order.created_at, true)} · Payment {titleCase(order.payment_status)}</p>
        </div>
        <Badge className={statusTone[order.status] || "bg-sand"}>{titleCase(order.status)}</Badge>
      </div>

      {!cancelled && (
        <div className="mt-8 grid gap-2 sm:grid-cols-5">
          {FLOW.map((step, index) => {
            const reached = currentIndex >= index && currentIndex !== -1;
            const Icon = step.icon;
            return (
              <div key={step.status} className={`rounded-2xl border p-4 ${reached ? "border-clay/30 bg-clay/5" : "border-ink/10 bg-white"}`}>
                <Icon size={17} className={reached ? "text-clay" : "text-muted"} />
                <p className={`mt-2 text-xs font-semibold ${reached ? "text-ink" : "text-muted"}`}>{step.label}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {order.items.map((item) => (
            <div key={item.id} className="card p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="h-32 w-32 shrink-0 overflow-hidden rounded-2xl bg-sand">
                  {item.preview_url ? (
                    <img src={mediaUrl(item.preview_url)} alt={item.product_name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted">No preview</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="font-display text-xl">{item.product_name}</h2>
                      <p className="mt-1 text-xs text-muted">
                        {[item.variant_name, item.printing_method_name].filter(Boolean).join(" · ")} · Qty {item.quantity}
                      </p>
                      {item.design && (
                        <p className="mt-1 text-xs text-muted">
                          Artwork: {item.design.name}
                          {item.product_slug && (
                            <Link href={`/editor/${item.product_slug}?design=${item.design.id}`} className="ml-1 text-clay underline">edit</Link>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-sm font-semibold">{money(item.line_total)}</div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {item.exports.map((file) => (
                      <a
                        key={file.id}
                        href={file.url ? mediaUrl(file.url) : undefined}
                        target="_blank"
                        rel="noreferrer"
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold ${
                          file.status === "completed" ? "bg-olive-soft text-olive" : "bg-sand text-muted"
                        }`}
                      >
                        <FileDown size={12} /> {file.file_type.toUpperCase()} · {file.dpi} DPI · {titleCase(file.status)}
                      </a>
                    ))}
                    <Button size="sm" variant="outline" loading={exporting === item.id} onClick={() => generateExport(item)}>
                      <Download size={13} /> Print-ready PNG
                    </Button>
                  </div>
                  {item.exports.some((file) => file.warnings?.length) && (
                    <p className="mt-2 text-[11px] text-amber-700">
                      {item.exports.find((file) => file.warnings?.length)?.warnings.join(" ")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <aside className="space-y-4">
          <div className="card p-6">
            <h2 className="font-display text-xl">Summary</h2>
            <div className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-muted"><span>Subtotal</span><span>{money(order.subtotal)}</span></div>
              {Number(order.discount) > 0 && <div className="flex justify-between text-olive"><span>Discount</span><span>−{money(order.discount)}</span></div>}
              <div className="flex justify-between text-muted"><span>Shipping</span><span>{money(order.shipping)}</span></div>
              <div className="flex justify-between text-muted"><span>Tax</span><span>{money(order.tax)}</span></div>
              <div className="flex items-baseline justify-between border-t border-ink/10 pt-2">
                <span className="font-semibold">Total</span>
                <span className="font-display text-2xl">{money(order.total)}</span>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="font-display text-xl">Shipping to</h2>
            <address className="mt-3 space-y-0.5 text-sm not-italic text-muted">
              <div className="font-semibold text-ink">{order.shipping_name}</div>
              <div>{order.shipping_address}</div>
              <div>{order.shipping_city} {order.shipping_postal_code}</div>
              <div>{order.shipping_country}</div>
              {order.shipping_phone && <div className="pt-1">{order.shipping_phone}</div>}
            </address>
            {order.notes && (
              <p className="mt-3 rounded-lg bg-sand/60 p-3 text-xs italic text-muted">“{order.notes}”</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <OrderDetailContent />
    </Suspense>
  );
}
