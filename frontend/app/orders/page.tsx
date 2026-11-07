"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Package, ShoppingBag } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { OrderListItem, Paginated } from "@/lib/types";
import { formatDate, money, statusTone, titleCase } from "@/lib/utils";
import { Alert, Badge, EmptyState, LinkButton, LoadingBlock } from "@/components/ui";

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    api
      .get<Paginated<OrderListItem>>("/orders/")
      .then((data) => setOrders(data.results))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  if (authLoading || (user && loading)) return <LoadingBlock label="Loading your orders…" />;

  if (!user) {
    return (
      <div className="container-x py-16">
        <EmptyState
          icon={<Package />}
          title="Sign in to see your orders"
          description="Your order history and print files live in your studio account."
          action={<LinkButton href="/login?next=/orders">Sign in</LinkButton>}
        />
      </div>
    );
  }

  return (
    <div className="container-x py-10 lg:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Your orders</p>
          <h1 className="mt-2 display-title">Made & delivered.</h1>
        </div>
        <Link href="/designs" className="link-underline text-sm font-semibold">My designs</Link>
      </div>

      {error && <div className="mt-5"><Alert>{error}</Alert></div>}

      {orders.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<ShoppingBag />}
            title="No orders yet"
            description="When you place an order, it will appear here with its production files."
            action={<LinkButton href="/shop">Find your canvas</LinkButton>}
          />
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {orders.map((order) => (
            <Link key={order.id} href={`/orders/${order.id}`} className="card flex flex-col gap-4 p-5 transition hover:border-clay/40 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-xl">{order.number}</span>
                  <Badge className={statusTone[order.status] || "bg-sand"}>{titleCase(order.status)}</Badge>
                  <Badge className="bg-ink/5 text-muted">Payment: {titleCase(order.payment_status)}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted">
                  {formatDate(order.created_at, true)} · {order.item_count} item{order.item_count === 1 ? "" : "s"}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="font-display text-2xl">{money(order.total)}</p>
                <p className="text-[10px] uppercase tracking-wide text-muted">View order</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
