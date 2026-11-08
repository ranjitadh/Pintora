"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import {
  BadgeDollarSign,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Palette,
  Settings,
  Shapes,
  ShoppingBag,
  Store,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
}

interface AdminSidebarProps {
  className?: string;
}

const SECTIONS: { title: string; items: AdminNavItem[] }[] = [
  {
    title: "OVERVIEW",
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true }],
  },
  {
    title: "COMMERCE",
    items: [
      { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
      { href: "/admin/products", label: "Products", icon: Package },
      { href: "/admin/customers", label: "Customers", icon: Users },
      { href: "/admin/pricing", label: "Pricing", icon: BadgeDollarSign },
    ],
  },
  {
    title: "DESIGN",
    items: [{ href: "/admin/catalog", label: "Catalog", icon: Shapes }],
  },
  {
    title: "SYSTEM",
    items: [{ href: "/admin/settings", label: "Settings", icon: Settings }],
  },
];

export function AdminSidebar({ className }: AdminSidebarProps) {
  const { logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const renderNavLinks = () => (
    <nav className="flex-1 space-y-2 px-2 py-3 overflow-y-auto">
      {SECTIONS.map((section) => (
        <div key={section.title} className="mb-2">
          <h3 className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
            {section.title}
          </h3>
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                    "text-muted hover:bg-white hover:text-ink"
                  )}
                >
                  <div className="shrink-0 rounded-lg bg-ink/5 p-1.5 text-clay">
                    <Icon size={16} />
                  </div>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const renderBrand = () => (
    <Link href="/admin" className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-cream">
        <Store size={18} />
      </span>
      <span>
        <span className="block font-display text-xl leading-none">Printora</span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted">Studio admin</span>
      </span>
    </Link>
  );

  const renderSignOut = () => (
    <button
      onClick={logout}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium transition",
        "text-muted hover:bg-ink/5 hover:text-ink"
      )}
    >
      <LogOut size={14} />
      Sign out
    </button>
  );

  return (
    <>
      {/* Desktop sidebar: always open, sticky */}
      <aside
        className={cn(
          "hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:border-r lg:border-ink/10 lg:bg-white",
          "flex flex-col border-r border-ink/10 bg-white",
          className
        )}
        aria-label="Main navigation"
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-ink/10">
          {renderBrand()}
        </div>

        {renderNavLinks()}

        <div className="px-3 pb-4">
          <div className="px-2 pt-2 card">{renderSignOut()}</div>
        </div>
      </aside>

      {/* Mobile drawer: fixed overlay */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-ink/10 transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:hidden w-64"
        )}
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-ink/10">
          {renderBrand()}
          <button
            onClick={closeMobile}
            className="rounded-full p-1.5 text-muted hover:bg-ink/5 hover:text-ink transition"
            aria-label="Close navigation"
          >
            <X size={16} />
          </button>
        </div>

        {renderNavLinks()}

        <div className="px-3 pb-4">
          <div className="px-2 pt-2 card">
            <button
              onClick={logout}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium transition text-muted hover:bg-ink/5 hover:text-ink"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Mobile backdrop: below drawer, above content */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={closeMobile}
        />
      )}
    </>
  );
}

interface AdminHeaderProps {
  eyebrow?: string;
  breadcrumbs?: { label: string; href?: string }[];
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function AdminHeader({
  eyebrow = "Studio admin",
  breadcrumbs,
  title,
  description,
  actions,
  className,
}: AdminHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-muted">
          {breadcrumbs.map((crumb, index) => (
            <span key={crumb.label} className="flex items-center gap-1">
              {index > 0 && <ChevronRight size={10} className="text-muted" />}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-clay transition">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-clay font-semibold">{crumb.label}</span>
              )}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-1 font-display text-4xl">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function AdminMobileHeader({ title, onMenu }: { title: string; onMenu: () => void }) {
  const { logout } = useAuth();
  return (
    <div className="mb-5 flex items-center justify-between lg:hidden">
      <button
        onClick={onMenu}
        className="flex items-center gap-2 rounded-lg border border-ink/15 bg-white px-3 py-2 text-clay hover:bg-clay hover:text-cream transition"
      >
        <Menu size={16} />
        <span className="text-xs font-semibold uppercase tracking-wider">Menu</span>
      </button>
      <Link href="/admin" className="flex items-center gap-2 font-display text-xl">
        <Store size={18} className="text-clay" /> Studio
      </Link>
      <button onClick={logout} className="text-xs font-semibold text-muted">Sign out</button>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  href,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  href?: string;
  tone?: "default" | "clay" | "olive";
}) {
  const body = (
    <div
      className={cn(
        "card h-full p-5 transition",
        href && "hover:-translate-y-0.5 hover:border-clay/40",
        tone === "clay" && "bg-clay/5",
        tone === "olive" && "bg-olive-soft"
      )}
    >
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
        {icon && <span className="text-clay">{icon}</span>}
      </div>
      <p className="mt-3 font-display text-3xl leading-none">{value}</p>
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function TableShell({ children }: { children: React.ReactNode }) {
  return <div className="card overflow-hidden"><div className="overflow-x-auto">{children}</div></div>;
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn("whitespace-nowrap px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-muted", className)}>{children}</th>;
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("whitespace-nowrap px-4 py-3.5 text-sm", className)}>{children}</td>;
}

export function AdminTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string; count?: number }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-full border border-ink/10 bg-white p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "rounded-full px-4 py-2 text-xs font-semibold transition",
            active === tab.id ? "bg-ink text-cream" : "text-muted hover:text-ink"
          )}
        >
          {tab.label}
          {typeof tab.count === "number" && <span className="ml-1.5 opacity-60">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}
