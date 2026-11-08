"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Save, ShoppingBag, Webhook } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { AdminHeader, TableShell, Td, Th } from "@/components/admin";
import { Alert, Badge, Button, Field, LoadingBlock } from "@/components/ui";
import type { Paginated, StoreConfig } from "@/lib/types";
import { formatDate } from "@/lib/utils";

interface ShopifyStatus {
  credentials_configured: boolean;
  store_domain: string;
  api_version: string;
  webhook_secret_configured: boolean;
  enabled: boolean;
  demo_mode: boolean;
  webhook_url: string;
}

interface WebhookEvent {
  id: string;
  topic: string;
  external_id: string;
  verified: boolean;
  processed: boolean;
  error: string;
  created_at: string;
}

const BLANK = {
  store_name: "",
  currency: "USD",
  tax_rate: "0",
  shipping_fee: "0",
  free_shipping_threshold: "",
  demo_mode: true,
  shopify_domain: "",
  shopify_enabled: false,
  announcement: "",
  settings: "{}",
};

export default function AdminSettingsPage() {
  const [form, setForm] = useState(BLANK);
  const [status, setStatus] = useState<ShopifyStatus | null>(null);
  const [webhooks, setWebhooks] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [syncResult, setSyncResult] = useState<any>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [config, shopifyStatus, hookData] = await Promise.all([
        api.get<StoreConfig>("/admin/store/config/"),
        api.get<ShopifyStatus>("/admin/shopify/status/"),
        api.get<Paginated<WebhookEvent>>("/admin/webhooks/?page_size=10"),
      ]);
      setForm({
        store_name: config.store_name,
        currency: config.currency,
        tax_rate: config.tax_rate,
        shipping_fee: config.shipping_fee,
        free_shipping_threshold: config.free_shipping_threshold || "",
        demo_mode: config.demo_mode,
        shopify_domain: config.shopify_domain || "",
        shopify_enabled: config.shopify_enabled,
        announcement: config.announcement || "",
        settings: JSON.stringify(config.settings || {}, null, 2),
      });
      setStatus(shopifyStatus);
      setWebhooks(hookData.results);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  };

  const saveConfig = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      let settings: any = {};
      if (form.settings.trim()) {
        try {
          settings = JSON.parse(form.settings);
        } catch {
          throw new Error("Advanced settings must be valid JSON.");
        }
      }
      await api.patch("/admin/store/config/", {
        ...form,
        free_shipping_threshold: form.free_shipping_threshold || null,
        settings,
      });
      flash("Store configuration saved.");
      const refreshed = await api.get<ShopifyStatus>("/admin/shopify/status/");
      setStatus(refreshed);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const runSync = async (importProducts: boolean) => {
    if (importProducts && !window.confirm("Import Shopify products into the local catalogue?")) return;
    setSyncing(importProducts ? "import" : "preview");
    setError("");
    setSyncResult(null);
    try {
      const result = await api.post("/admin/shopify/sync/", { limit: 25, import: importProducts });
      setSyncResult(result);
      flash(importProducts ? "Shopify import finished." : "Shopify connection responded.");
      if (importProducts) {
        const hookData = await api.get<Paginated<WebhookEvent>>("/admin/webhooks/?page_size=10");
        setWebhooks(hookData.results);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSyncing("");
    }
  };

  const refreshWebhooks = async () => {
    setError("");
    try {
      const hookData = await api.get<Paginated<WebhookEvent>>("/admin/webhooks/?page_size=10");
      setWebhooks(hookData.results);
      flash("Webhook log refreshed.");
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (loading) return <LoadingBlock label="Loading store settings…" />;

  return (
    <div className="space-y-7">
      <AdminHeader
        breadcrumbs={[{ label: "System", href: "/admin" }, { label: "Settings" }]}
        title="Settings"
        description="Store economics, demo behaviour and the Shopify bridge."
      />

      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <form onSubmit={saveConfig} className="card space-y-5 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Store name"><input required value={form.store_name} onChange={(event) => setForm((current) => ({ ...current, store_name: event.target.value }))} className="field" /></Field>
          <Field label="Currency"><input value={form.currency} maxLength={3} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} className="field" /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Tax rate (%)"><input type="number" step="0.01" value={form.tax_rate} onChange={(event) => setForm((current) => ({ ...current, tax_rate: event.target.value }))} className="field" /></Field>
          <Field label="Shipping fee"><input type="number" step="0.01" value={form.shipping_fee} onChange={(event) => setForm((current) => ({ ...current, shipping_fee: event.target.value }))} className="field" /></Field>
          <Field label="Free shipping over"><input type="number" step="0.01" value={form.free_shipping_threshold} onChange={(event) => setForm((current) => ({ ...current, free_shipping_threshold: event.target.value }))} className="field" /></Field>
        </div>
        <Field label="Announcement bar"><input value={form.announcement} onChange={(event) => setForm((current) => ({ ...current, announcement: event.target.value }))} className="field" /></Field>
        <div className="flex flex-wrap gap-5 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.demo_mode} onChange={(event) => setForm((current) => ({ ...current, demo_mode: event.target.checked }))} /> Demo payments</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.shopify_enabled} onChange={(event) => setForm((current) => ({ ...current, shopify_enabled: event.target.checked }))} /> Shopify enabled</label>
        </div>
        <Field label="Shopify domain"><input value={form.shopify_domain} onChange={(event) => setForm((current) => ({ ...current, shopify_domain: event.target.value }))} className="field" placeholder="your-store.myshopify.com" /></Field>
        <Field label="Advanced settings (JSON)" hint="Free-form JSON stored with the store configuration.">
          <textarea rows={5} value={form.settings} onChange={(event) => setForm((current) => ({ ...current, settings: event.target.value }))} className="field font-mono text-xs" />
        </Field>
        <div className="flex justify-end"><Button type="submit" loading={saving}><Save size={15} /> Save configuration</Button></div>
      </form>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card space-y-4 p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">Shopify bridge</h2>
            <ShoppingBag size={18} className="text-clay" />
          </div>
          {status && (
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between rounded-lg bg-sand/50 px-3 py-2"><span>Credentials</span><Badge className={status.credentials_configured ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}>{status.credentials_configured ? "Configured" : "Demo only"}</Badge></div>
              <div className="flex items-center justify-between rounded-lg bg-sand/50 px-3 py-2"><span>Store domain</span><span className="font-mono text-[11px]">{status.store_domain || "—"}</span></div>
              <div className="flex items-center justify-between rounded-lg bg-sand/50 px-3 py-2"><span>Webhook secret</span><Badge className={status.webhook_secret_configured ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}>{status.webhook_secret_configured ? "Set" : "Missing"}</Badge></div>
              <div className="flex items-center justify-between rounded-lg bg-sand/50 px-3 py-2"><span>API version</span><span className="font-mono text-[11px]">{status.api_version}</span></div>
              <div className="rounded-lg bg-sand/50 px-3 py-2">
                <p>Webhook URL</p>
                <p className="mt-1 break-all font-mono text-[10px] text-muted">{status.webhook_url}</p>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" loading={syncing === "preview"} onClick={() => runSync(false)} disabled={!!syncing}>Test connection</Button>
            <Button size="sm" loading={syncing === "import"} onClick={() => runSync(true)} disabled={!!syncing}>Import products</Button>
          </div>
          {!status?.credentials_configured && <p className="text-[11px] text-muted">Add Shopify credentials to the backend environment to enable live sync. The local demo store works without them.</p>}
          {syncResult && (
            <pre className="max-h-44 overflow-auto rounded-xl bg-ink p-3 text-[10px] leading-relaxed text-cream">{JSON.stringify(syncResult, null, 2).slice(0, 2500)}</pre>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">Webhook log</h2>
            <Button size="sm" variant="outline" onClick={refreshWebhooks}><RefreshCw size={13} /> Refresh</Button>
          </div>
          <TableShell>
            {webhooks.length === 0 ? (
              <p className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted"><Webhook size={16} /> No webhook events yet.</p>
            ) : (
              <table className="w-full">
                <thead className="border-b border-ink/10 bg-sand/40">
                  <tr><Th>Topic</Th><Th>Verified</Th><Th>Processed</Th><Th>Received</Th></tr>
                </thead>
                <tbody className="divide-y divide-ink/5">
                  {webhooks.map((event) => (
                    <tr key={event.id}>
                      <Td>
                        <p className="font-semibold">{event.topic}</p>
                        {event.error && <p className="max-w-[180px] truncate text-[10px] text-rose-600">{event.error}</p>}
                      </Td>
                      <Td><Badge className={event.verified ? "bg-emerald-100 text-emerald-900" : "bg-sand text-muted"}>{event.verified ? "Yes" : "No"}</Badge></Td>
                      <Td><Badge className={event.processed ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}>{event.processed ? "Yes" : "Pending"}</Badge></Td>
                      <Td className="text-muted">{formatDate(event.created_at, true)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TableShell>
        </section>
      </div>
    </div>
  );
}
