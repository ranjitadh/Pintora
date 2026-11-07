"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export function AdminHeader({
  eyebrow = "Studio admin",
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-1 font-display text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
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
