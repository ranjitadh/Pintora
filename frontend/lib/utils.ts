import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function money(value: string | number | null | undefined, currency = "USD") {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatDate(value: string | null | undefined, withTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(date);
}

export function titleCase(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const ORDER_STATUSES = [
  "pending",
  "paid",
  "processing",
  "ready_for_production",
  "printing",
  "completed",
  "cancelled",
];

export const PAYMENT_STATUSES = ["unpaid", "demo", "paid", "refunded"];

export const statusTone: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900",
  paid: "bg-blue-100 text-blue-900",
  processing: "bg-indigo-100 text-indigo-900",
  ready_for_production: "bg-violet-100 text-violet-900",
  printing: "bg-fuchsia-100 text-fuchsia-900",
  completed: "bg-emerald-100 text-emerald-900",
  cancelled: "bg-rose-100 text-rose-900",
  unpaid: "bg-amber-100 text-amber-900",
  demo: "bg-olive-soft text-olive",
  refunded: "bg-rose-100 text-rose-900",
};

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
