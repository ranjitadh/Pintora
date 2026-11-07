"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Clock3, Package, Palette, ShoppingBag, Users, Wallet } from "lucide-react";
import { api, errorMessage, mediaUrl } from "@/lib/api";
import { AdminHeader, StatCard, TableShell, Td, Th } from "@/components/admin";
import { Alert, Badge, LinkButton, LoadingBlock } from "@/components/ui";
import type { DashboardData } from "@/lib/types";
import { formatDate, money, statusTone, titleCase } from "@/lib/utils";

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<DashboardData>("/admin/dashboard/")
      .then(setData)
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingBlock label="Counting the studio…" />;
  if (!data) return <Alert>{error || "Could not load the dashboard."}</Alert>;

  const maxStatus = Math.max(...data.orders_by_status.map((entry) => entry.count), 1);

  return (
    <div className="space-y-7">
      <AdminHeader
        title="Good to see you."
        description="A live pulse on orders, revenue, designs and the catalogue."
        actions={
          <>
            <LinkButton href="/admin/products" size="sm" variant="secondary"><Package size={14} /> Products</LinkButton>
            <LinkButton href="/admin/orders" size="sm">Open orders <ArrowUpRight size={14} /></LinkButton>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue" value={money(data.revenue)} hint={`${data.orders} orders all time`} icon={<Wallet size={18} />} tone="clay" />
        <StatCard label="Orders" value={data.orders} hint={`${data.pending_orders} still in production`} icon={<ShoppingBag size={18} />} href="/admin/orders" />
        <StatCard label="Customers" value={data.customers} hint={`${data.designs} saved designs`} icon={<Users size={18} />} href="/admin/customers" />
        <StatCard label="Catalogue" value={data.products} hint={`${data.active_products} active products`} icon={<Package size={18} />} href="/admin/products" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-2xl">Recent orders</h2>
            <Link href="/admin/orders" className="text-xs font-semibold text-clay hover:underline">View all</Link>
          </div>
          <TableShell>
            {data.recent_orders.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted">No orders yet.</p>
            ) : (
              <table className="w-full">
                <thead className="border-b border-ink/10 bg-sand/40">
                  <tr>
                    <Th>Order</Th>
                    <Th>Customer</Th>
                    <Th>Status</Th>
                    <Th>Placed</Th>
                    <Th className="text-right">Total</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/5">
                  {data.recent_orders.map((order) => (
                    <tr key={order.id} className="hover:bg-sand/20">
                      <Td>
                        <Link href={`/admin/orders?focus=${order.id}`} className="font-semibold text-clay hover:underline">{order.number}</Link>
                      </Td>
                      <Td className="max-w-[160px] truncate text-muted">{order.customer_email || "—"}</Td>
                      <Td><Badge className={statusTone[order.status] || "bg-sand"}>{titleCase(order.status)}</Badge></Td>
                      <Td className="text-muted">{formatDate(order.created_at)}</Td>
                      <Td className="text-right font-semibold">{money(order.total)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TableShell>
        </section>

        <section className="space-y-6">
          <div className="card p-5">
            <h2 className="font-display text-xl">Production board</h2>
            <p className="mt-1 text-xs text-muted">Orders by current status.</p>
            <div className="mt-4 space-y-3">
              {data.orders_by_status.length === 0 && <p className="text-xs text-muted">Nothing in the queue.</p>}
              {data.orders_by_status.map((entry) => (
                <div key={entry.status}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold">{titleCase(entry.status)}</span>
                    <span className="text-muted">{entry.count}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-sand">
                    <div className="h-full rounded-full bg-clay" style={{ width: `${Math.max((entry.count / maxStatus) * 100, 6)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl">Fresh designs</h2>
              <Palette size={16} className="text-clay" />
            </div>
            <div className="mt-3 space-y-2">
              {data.recent_designs.length === 0 && <p className="text-xs text-muted">No designs saved yet.</p>}
              {data.recent_designs.slice(0, 5).map((design) => (
                <div key={design.id} className="flex items-center gap-3 rounded-xl p-1.5">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-sand">
                    {design.preview_url ? (
                      <img src={mediaUrl(design.preview_url)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center"><Clock3 size={14} className="text-muted" /></div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{design.name}</p>
                    <p className="truncate text-[10px] text-muted">{design.product_name} · {formatDate(design.updated_at)}</p>
                  </div>
                  <Badge className={statusTone[design.status] || "bg-sand"}>{titleCase(design.status)}</Badge>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
