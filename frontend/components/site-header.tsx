"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LogOut, Menu, ShoppingBag, UserRound, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import type { StoreConfig } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

const nav = [
  { href: "/shop", label: "Shop" },
  { href: "/templates", label: "Templates" },
  { href: "/#how-it-works", label: "How it works" },
];

export function SiteHeader() {
  const { user, loading, logout, cartCount, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    api
      .get<StoreConfig>("/store/config/")
      .then((config) => setAnnouncement(config.announcement || ""))
      .catch(() => {});
  }, []);

  return (
    <>
      {announcement && (
        <div className="bg-ink px-4 py-2 text-center text-[11px] font-medium tracking-wide text-cream">
          {announcement}
        </div>
      )}
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-cream/90 backdrop-blur-xl dark:border-white/10 dark:bg-ink/95">
        <div className="container-x flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-clay text-white">
            </span>
            <span className="font-display text-2xl font-semibold tracking-tight">MerchPress</span>
          </Link>

          <nav className="hidden items-center gap-7 md:flex">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="link-underline text-sm font-medium text-ink/75 hover:text-ink dark:text-cream/75 dark:hover:text-cream">
                {item.label}
              </Link>
            ))}
            {isAdmin && (
              <Link href="/admin" className="text-sm font-medium text-clay hover:text-clay-dark">
                Admin
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-2">
            {!loading && user ? (
              <div className="hidden items-center gap-2 md:flex">
                <Link
                  href="/account"
                  className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium hover:bg-ink/5"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-olive text-[11px] font-bold text-cream">
                    {user.display_name?.slice(0, 2).toUpperCase() || <UserRound size={14} />}
                  </span>
                  <span className="max-w-[110px] truncate">{user.first_name || user.display_name}</span>
                </Link>
                <button onClick={logout} className="rounded-full p-2 text-muted hover:bg-ink/5 hover:text-ink dark:text-cream/60 dark:hover:bg-white/10 dark:hover:text-cream" title="Sign out">
                  <LogOut size={16} />
                </button>
              </div>
            ) : !loading ? (
              <Link href="/login" className="hidden rounded-full px-4 py-2 text-sm font-semibold hover:bg-ink/5 md:inline-flex">
                Sign in
              </Link>
            ) : null}

            <Link
              href="/cart"
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-ink text-cream transition hover:bg-clay"
              aria-label="Cart"
            >
              <ShoppingBag size={17} />
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-clay px-1 text-[10px] font-bold text-white ring-2 ring-cream">
                  {cartCount}
                </span>
              )}
            </Link>

            <ThemeToggle />

            <button
              onClick={() => setOpen((value) => !value)}
              className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-ink/5 md:hidden"
              aria-label="Menu"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        <div className={cn("border-t border-ink/10 md:hidden", open ? "block" : "hidden")}>
          <div className="container-x flex flex-col gap-1 py-4">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-ink/5">
                {item.label}
              </Link>
            ))}
            {user ? (
              <>
                <Link href="/designs" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-ink/5">
                  My designs
                </Link>
                <Link href="/orders" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-ink/5">
                  Orders
                </Link>
                <Link href="/account" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-ink/5">
                  Account
                </Link>
                {isAdmin && (
                  <Link href="/admin" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-medium text-clay hover:bg-ink/5">
                    Admin dashboard
                  </Link>
                )}
                <button
                  onClick={() => {
                    logout();
                    setOpen(false);
                  }}
                  className="rounded-xl px-3 py-2.5 text-left text-sm font-medium text-rose-700 hover:bg-ink/5"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-ink/5">
                  Sign in
                </Link>
                <Link href="/register" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-ink/5">
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
