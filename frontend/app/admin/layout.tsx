"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeDollarSign,
  LayoutDashboard,
  LogOut,
  Package,
  Palette,
  Settings,
  Shapes,
  ShoppingBag,
  Store,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { LoadingBlock, LinkButton } from "@/components/ui";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/pricing", label: "Pricing", icon: BadgeDollarSign },
  { href: "/admin/catalog", label: "Catalog", icon: Shapes },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading, isAdmin, logout } = useAuth();

  if (loading) return <LoadingBlock label="Opening the studio…" />;

  if (!user) {
    return (
      <div className="container-x py-20 text-center">
        <p className="eyebrow">Studio admin</p>
        <h1 className="mt-2 font-display text-4xl">Sign in to continue.</h1>
        <p className="mt-2 text-sm text-muted">The admin studio is private to store staff.</p>
        <LinkButton href="/login?next=/admin" className="mt-6">Sign in</LinkButton>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container-x py-20 text-center">
        <p className="eyebrow">Studio admin</p>
        <h1 className="mt-2 font-display text-4xl">You don&apos;t have access.</h1>
        <p className="mt-2 text-sm text-muted">This area is limited to store administrators.</p>
        <LinkButton href="/" className="mt-6" variant="secondary">Back to the shop</LinkButton>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f3ec]">
      <div className="container-x py-6 lg:py-10">
        <div className="mb-5 flex items-center justify-between lg:hidden">
          <Link href="/admin" className="flex items-center gap-2 font-display text-xl">
            <Store size={18} className="text-clay" /> Studio
          </Link>
          <button onClick={logout} className="text-xs font-semibold text-muted">Sign out</button>
        </div>

        <div className="lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-8">
          <aside className="hidden lg:block">
            <div className="sticky top-8 space-y-5">
              <Link href="/admin" className="flex items-center gap-2.5 px-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-cream"><Store size={18} /></span>
                <span>
                  <span className="block font-display text-xl leading-none">Printora</span>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-muted">Studio admin</span>
                </span>
              </Link>

              <nav className="space-y-1">
                {NAV.map((item) => {
                  const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                        active ? "bg-ink text-cream" : "text-muted hover:bg-white hover:text-ink"
                      )}
                    >
                      <item.icon size={16} />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="card p-3">
                <p className="truncate text-xs font-semibold">{user.display_name || user.email}</p>
                <p className="truncate text-[10px] text-muted">{user.email}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Link href="/" className="text-[10px] font-semibold text-clay hover:underline">View shop</Link>
                  <button onClick={logout} className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted hover:text-ink">
                    <LogOut size={11} /> Sign out
                  </button>
                </div>
              </div>
            </div>
          </aside>

          <div className="min-w-0">
            <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
              {NAV.map((item) => {
                const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold",
                      active ? "bg-ink text-cream" : "bg-white text-muted"
                    )}
                  >
                    <item.icon size={13} /> {item.label}
                  </Link>
                );
              })}
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
