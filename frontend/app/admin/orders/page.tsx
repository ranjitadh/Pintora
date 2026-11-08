"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, Search, SlidersHorizontal } from "lucide-react";
import { api, errorMessage, mediaUrl } from "@/lib/api";
import { AdminHeader, StatCard, TableShell, Td, Th } from "@/components/admin";
import { Alert, Badge, Button, Field, LinkButton, LoadingBlock, Modal } from "@/components/ui";
import type { Order, OrderListItem, Paginated } from "@/lib/types";
import { formatDate, money, ORDER_STATUSES, PAYMENT_STATUSES, statusTone, titleCase } from "@/lib/utils";

function AdminOrdersContent() {
  const searchParams = useSearchParams();
  const focus = searchParams.get("focus");
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selected, setSelected] = useState<Order | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ status: "", payment_status: "", notes: "" });

  const loadOrders = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), page_size: "20" });
    if (query) params.set("search", query);
    if (status) params.set("status", status);
    api
      .get<Paginated<OrderListItem>>(`/admin/orders/?${params.toString()}`)
      .then((data) => {
        setOrders(data.results);
        setCount(data.count);
        setTotalPages(data.total_pages);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [page, query, status]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const openOrder = useCallback(async (id: string) => {
    setDetailLoading(true);
    setError("");
    try {
      const order = await api.get<Order>(`/admin/orders/${id}/`);
      setSelected(order);
      setForm({ status: order.status, payment_status: order.payment_status, notes: order.notes || "" });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (focus) openOrder(focus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  const saveOrder = async () => {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const updated = await api.patch<Order>(`/admin/orders/${selected.id}/`, form);
      setSelected(updated);
      setForm({ status: updated.status, payment_status: updated.payment_status, notes: updated.notes || "" });
      loadOrders();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    setQuery(search.trim());
  };

  return (
    <div className="space-y-7">
      <AdminHeader
        breadcrumbs={[{ label: "Commerce", href: "/admin" }, { label: "Orders" }]}
        title="Orders"
        description="Track production stages, update payment status and grab print-ready files."
        actions={<Badge className="bg-ink/5 text-muted">{count} orders</Badge>}
      />

      {error && <Alert>{error}</Alert>}

      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={submitSearch} className="flex flex-1 gap-2 sm:max-w-md">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search order number or email…"
              className="field pl-9"
            />
          </div>
          <Button type="submit" size="sm" variant="secondary">Search</Button>
        </form>
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={14} className="text-muted" />
          <select
            value={status}
            onChange={(event) => { setStatus(event.target.value); setPage(1); }}
            className="field w-auto py-2 text-xs"
          >
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <LoadingBlock label="Loading orders…" />
      ) : (
        <TableShell>
          {orders.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-muted">No orders match this view.</p>
          ) : (
            <table className="w-full">
              <thead className="border-b border-ink/10 bg-sand/40">
                <tr>
                  <Th>Order</Th>
                  <Th>Customer</Th>
                  <Th>Status</Th>
                  <Th>Payment</Th>
                  <Th>Items</Th>
                  <Th>Placed</Th>
                  <Th className="text-right">Total</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/5">
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => openOrder(order.id)}
                    className="cursor-pointer hover:bg-sand/20"
                  >
                    <Td className="font-semibold text-clay">{order.number}</Td>
                    <Td className="max-w-[180px] truncate text-muted">{order.customer_email || "—"}</Td>
                    <Td><Badge className={statusTone[order.status] || "bg-sand"}>{titleCase(order.status)}</Badge></Td>
                    <Td><Badge className={statusTone[order.payment_status] || "bg-sand"}>{titleCase(order.payment_status)}</Badge></Td>
                    <Td className="text-muted">{order.item_count}</Td>
                    <Td className="text-muted">{formatDate(order.created_at)}</Td>
                    <Td className="text-right font-semibold">{money(order.total)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TableShell>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button>
          </div>
        </div>
      )}

      <Modal open={!!selected || detailLoading} onClose={() => setSelected(null)} title={selected ? `Order ${selected.number}` : "Loading order…"} wide>
        {detailLoading && !selected && <LoadingBlock label="Opening order…" />}
        {selected && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={statusTone[selected.status] || "bg-sand"}>{titleCase(selected.status)}</Badge>
              <Badge className={statusTone[selected.payment_status] || "bg-sand"}>Payment: {titleCase(selected.payment_status)}</Badge>
              <span className="text-xs text-muted">{formatDate(selected.created_at, true)}</span>
            </div>

            <div className="space-y-2">
              {selected.items.map((item) => (
                <div key={item.id} className="flex gap-3 rounded-xl border border-ink/10 bg-white p-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-sand">
                    {item.preview_url ? <img src={mediaUrl(item.preview_url)} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{item.product_name} × {item.quantity}</p>
                    <p className="text-[11px] text-muted">{[item.variant_name, item.printing_method_name].filter(Boolean).join(" · ")}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {item.exports.filter((file) => file.status === "completed" && file.url).map((file) => (
                        <a key={file.id} href={mediaUrl(file.url!)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-olive-soft px-2 py-1 text-[10px] font-semibold text-olive">
                          <Download size={10} /> {file.file_type.toUpperCase()} {file.dpi} DPI
                        </a>
                      ))}
                      {!item.exports.some((file) => file.status === "completed" && file.url) && (
                        <span className="text-[10px] text-muted">No print file yet</span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm font-semibold">{money(item.line_total)}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Order status">
                <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="field">
                  {ORDER_STATUSES.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}
                </select>
              </Field>
              <Field label="Payment status">
                <select value={form.payment_status} onChange={(event) => setForm((current) => ({ ...current, payment_status: event.target.value }))} className="field">
                  {PAYMENT_STATUSES.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Internal notes">
              <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={2} className="field" />
            </Field>

            <div className="grid gap-3 rounded-xl bg-sand/50 p-4 text-xs sm:grid-cols-2">
              <div>
                <p className="font-semibold">Ship to</p>
                <p className="mt-1 text-muted">{selected.shipping_name}</p>
                <p className="text-muted">{selected.shipping_address}</p>
                <p className="text-muted">{selected.shipping_city} {selected.shipping_postal_code}, {selected.shipping_country}</p>
              </div>
              <div>
                <p className="font-semibold">Totals</p>
                <p className="mt-1 text-muted">Subtotal {money(selected.subtotal)} · Shipping {money(selected.shipping)}</p>
                <p className="text-muted">Discount {money(selected.discount)} · Tax {money(selected.tax)}</p>
                <p className="mt-1 font-display text-xl text-ink">{money(selected.total)}</p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>
              <Button onClick={saveOrder} loading={saving}>Save changes</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <AdminOrdersContent />
    </Suspense>
  );
}
