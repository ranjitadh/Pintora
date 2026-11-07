"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LayoutDashboard, LogOut, Palette, Package, Settings, Sparkles } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Alert, Button, Field, LinkButton, LoadingBlock } from "@/components/ui";
import { formatDate, initials } from "@/lib/utils";

export default function AccountPage() {
  const { user, loading, refreshUser, logout, isAdmin } = useAuth();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    username: "",
    phone: "",
    company: "",
    address: "",
    city: "",
    postal_code: "",
    country: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm({
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      username: user.username || "",
      phone: user.profile?.phone || "",
      company: user.profile?.company || "",
      address: user.profile?.address || "",
      city: user.profile?.city || "",
      postal_code: user.profile?.postal_code || "",
      country: user.profile?.country || "",
    });
  }, [user]);

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await api.patch("/auth/me/", {
        first_name: form.first_name,
        last_name: form.last_name,
        username: form.username,
        profile: {
          phone: form.phone,
          company: form.company,
          address: form.address,
          city: form.city,
          postal_code: form.postal_code,
          country: form.country,
        },
      });
      await refreshUser();
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingBlock label="Opening your account…" />;
  if (!user) {
    return (
      <div className="container-x py-16 text-center">
        <p className="font-display text-3xl">You&apos;re not signed in.</p>
        <LinkButton href="/login?next=/account" className="mt-5">Sign in</LinkButton>
      </div>
    );
  }

  return (
    <div className="container-x py-10 lg:py-14">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-olive font-display text-2xl text-cream">
            {initials(user.display_name || user.email)}
          </div>
          <div>
            <p className="eyebrow">Account</p>
            <h1 className="font-display text-3xl">{user.display_name}</h1>
            <p className="text-xs text-muted">{user.email} · Joined {formatDate(user.date_joined)}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={logout}>
          <LogOut size={14} /> Sign out
        </Button>
      </div>

      <div className="mt-10 grid items-start gap-8 lg:grid-cols-[1fr_300px]">
        <form onSubmit={submit} className="card space-y-5 p-6 sm:p-8">
          <div>
            <h2 className="font-display text-2xl">Profile & shipping details</h2>
            <p className="mt-1 text-xs text-muted">These details prefill checkout and stay private to your account.</p>
          </div>
          {error && <Alert>{error}</Alert>}
          {saved && <Alert tone="success">Profile updated.</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name"><input value={form.first_name} onChange={(event) => update("first_name", event.target.value)} className="field" /></Field>
            <Field label="Last name"><input value={form.last_name} onChange={(event) => update("last_name", event.target.value)} className="field" /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Username"><input value={form.username} onChange={(event) => update("username", event.target.value)} className="field" /></Field>
            <Field label="Email"><input value={user.email} readOnly className="field bg-sand/50 text-muted" /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone"><input value={form.phone} onChange={(event) => update("phone", event.target.value)} className="field" /></Field>
            <Field label="Company"><input value={form.company} onChange={(event) => update("company", event.target.value)} className="field" /></Field>
          </div>
          <Field label="Street address"><input value={form.address} onChange={(event) => update("address", event.target.value)} className="field" /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="City"><input value={form.city} onChange={(event) => update("city", event.target.value)} className="field" /></Field>
            <Field label="Postal code"><input value={form.postal_code} onChange={(event) => update("postal_code", event.target.value)} className="field" /></Field>
            <Field label="Country"><input value={form.country} onChange={(event) => update("country", event.target.value)} className="field" /></Field>
          </div>
          <Button type="submit" loading={saving}>Save changes</Button>
        </form>

        <aside className="space-y-3">
          {[
            { href: "/designs", icon: Palette, title: "Design library", text: "Open or remix saved canvases" },
            { href: "/orders", icon: Package, title: "Orders", text: "Track production and downloads" },
            ...(isAdmin ? [{ href: "/admin", icon: LayoutDashboard, title: "Admin dashboard", text: "Manage the whole studio" }] : []),
          ].map((item) => (
            <Link key={item.href} href={item.href} className="card flex items-center gap-3 p-4 transition hover:border-clay/40">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-clay/10 text-clay"><item.icon size={18} /></div>
              <div>
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="text-[11px] text-muted">{item.text}</p>
              </div>
            </Link>
          ))}
          <div className="rounded-2xl bg-olive-soft p-5 text-xs leading-relaxed text-olive">
            <Sparkles size={16} />
            <p className="mt-2 font-semibold">Studio member</p>
            <p className="mt-1 text-olive/80">Every design save creates a restorable version. Your print files stay attached to your orders.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
