"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeDollarSign, Plus, Printer, Trash2 } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { AdminHeader, TableShell, Td, Th } from "@/components/admin";
import { Alert, Badge, Button, Field, LoadingBlock, Modal } from "@/components/ui";
import type { Paginated, PrintingMethod } from "@/lib/types";
import { money, titleCase } from "@/lib/utils";

const RULE_TYPES = [
  "base_surcharge",
  "per_quantity",
  "per_print_area",
  "per_image",
  "per_clipart",
  "per_character",
  "per_line",
  "per_color",
  "per_design",
  "per_shape",
  "per_variant",
];

interface AdminPrintingMethod extends PrintingMethod {
  is_active: boolean;
}

interface PricingRule {
  id: string;
  product: string | null;
  printing_method: string | null;
  rule_type: string;
  amount: string;
  description: string;
  config: any;
  is_active: boolean;
}

interface ProductOption {
  id: string;
  name: string;
}

const BLANK_RULE = {
  product: "",
  printing_method: "",
  rule_type: "base_surcharge",
  amount: "",
  description: "",
  is_active: true,
};

const BLANK_METHOD = {
  name: "",
  description: "",
  base_fee: "0",
  per_area_fee: "0",
  is_active: true,
  sort_order: "0",
};

export default function AdminPricingPage() {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [methods, setMethods] = useState<AdminPrintingMethod[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [ruleOpen, setRuleOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState(BLANK_RULE);
  const [ruleSaving, setRuleSaving] = useState(false);

  const [methodOpen, setMethodOpen] = useState(false);
  const [methodForm, setMethodForm] = useState(BLANK_METHOD);
  const [methodSaving, setMethodSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ruleData, methodData, productData] = await Promise.all([
        api.get<PricingRule[]>("/admin/pricing-rules/"),
        api.get<AdminPrintingMethod[]>("/admin/printing-methods/"),
        api.get<Paginated<ProductOption>>("/admin/products/?page_size=100"),
      ]);
      setRules(ruleData);
      setMethods(methodData);
      setProducts(productData.results);
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

  const productName = (id: string | null) => products.find((product) => product.id === id)?.name || "All products";
  const methodName = (id: string | null) => methods.find((method) => method.id === id)?.name || "Any method";

  const createRule = async (event: React.FormEvent) => {
    event.preventDefault();
    setRuleSaving(true);
    setError("");
    try {
      await api.post("/admin/pricing-rules/", {
        ...ruleForm,
        product: ruleForm.product || null,
        printing_method: ruleForm.printing_method || null,
        config: {},
      });
      setRuleOpen(false);
      setRuleForm(BLANK_RULE);
      const refreshed = await api.get<PricingRule[]>("/admin/pricing-rules/");
      setRules(refreshed);
      flash("Pricing rule created.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRuleSaving(false);
    }
  };

  const toggleRule = async (rule: PricingRule) => {
    setError("");
    try {
      const updated = await api.patch<PricingRule>(`/admin/pricing-rules/${rule.id}/`, { is_active: !rule.is_active });
      setRules((current) => current.map((item) => (item.id === rule.id ? updated : item)));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const deleteRule = async (rule: PricingRule) => {
    if (!window.confirm("Delete this pricing rule?")) return;
    setError("");
    try {
      await api.delete(`/admin/pricing-rules/${rule.id}/`);
      setRules((current) => current.filter((item) => item.id !== rule.id));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const createMethod = async (event: React.FormEvent) => {
    event.preventDefault();
    setMethodSaving(true);
    setError("");
    try {
      await api.post("/admin/printing-methods/", {
        ...methodForm,
        sort_order: Number(methodForm.sort_order),
      });
      setMethodOpen(false);
      setMethodForm(BLANK_METHOD);
      const refreshed = await api.get<AdminPrintingMethod[]>("/admin/printing-methods/");
      setMethods(refreshed);
      flash("Printing method created.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setMethodSaving(false);
    }
  };

  const toggleMethod = async (method: AdminPrintingMethod) => {
    setError("");
    try {
      const updated = await api.patch<AdminPrintingMethod>(`/admin/printing-methods/${method.id}/`, { is_active: !method.is_active });
      setMethods((current) => current.map((item) => (item.id === method.id ? updated : item)));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const deleteMethod = async (method: AdminPrintingMethod) => {
    if (!window.confirm(`Delete printing method “${method.name}”? It will also detach from products.`)) return;
    setError("");
    try {
      await api.delete(`/admin/printing-methods/${method.id}/`);
      setMethods((current) => current.filter((item) => item.id !== method.id));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (loading) return <LoadingBlock label="Loading pricing…" />;

  return (
    <div className="space-y-7">
      <AdminHeader
        breadcrumbs={[{ label: "Commerce", href: "/admin" }, { label: "Pricing" }]}
        title="Pricing"
        description="Base print fees, surcharges and the rules that quote every design."
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => setMethodOpen(true)}><Printer size={14} /> New method</Button>
            <Button size="sm" onClick={() => setRuleOpen(true)}><Plus size={14} /> New rule</Button>
          </>
        }
      />

      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-2xl">Pricing rules</h2>
          <Badge className="bg-ink/5 text-muted">{rules.length} rules</Badge>
        </div>
        <TableShell>
          {rules.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted">No pricing rules yet.</p>
          ) : (
            <table className="w-full">
              <thead className="border-b border-ink/10 bg-sand/40">
                <tr><Th>Rule</Th><Th>Scope</Th><Th>Method</Th><Th>Amount</Th><Th>Description</Th><Th>Status</Th><Th /></tr>
              </thead>
              <tbody className="divide-y divide-ink/5">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-sand/20">
                    <Td className="font-semibold"><span className="inline-flex items-center gap-1.5"><BadgeDollarSign size={13} className="text-clay" /> {titleCase(rule.rule_type)}</span></Td>
                    <Td className="text-muted">{productName(rule.product)}</Td>
                    <Td className="text-muted">{methodName(rule.printing_method)}</Td>
                    <Td className="font-semibold">{money(rule.amount)}</Td>
                    <Td className="max-w-[220px] truncate text-muted">{rule.description || "—"}</Td>
                    <Td><button onClick={() => toggleRule(rule)}><Badge className={rule.is_active ? "bg-emerald-100 text-emerald-900" : "bg-sand text-muted"}>{rule.is_active ? "Active" : "Off"}</Badge></button></Td>
                    <Td className="text-right"><button onClick={() => deleteRule(rule)} className="rounded-full p-2 text-muted hover:bg-rose-50 hover:text-rose-600"><Trash2 size={14} /></button></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TableShell>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-2xl">Printing methods</h2>
          <Badge className="bg-ink/5 text-muted">{methods.length} methods</Badge>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {methods.map((method) => (
            <div key={method.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-lg">{method.name}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted">/{method.slug}</p>
                </div>
                <button onClick={() => toggleMethod(method)}><Badge className={method.is_active ? "bg-emerald-100 text-emerald-900" : "bg-sand text-muted"}>{method.is_active ? "Active" : "Off"}</Badge></button>
              </div>
              <p className="mt-3 text-xs text-muted">Base fee {money(method.base_fee)} · per area {money(method.per_area_fee)}</p>
              <p className="mt-1 line-clamp-2 text-xs text-muted">{method.description || "No description."}</p>
              <div className="mt-3 flex justify-end">
                <button onClick={() => deleteMethod(method)} className="rounded-full p-2 text-muted hover:bg-rose-50 hover:text-rose-600"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Modal open={ruleOpen} onClose={() => setRuleOpen(false)} title="New pricing rule">
        <form onSubmit={createRule} className="space-y-3">
          <Field label="Rule type">
            <select value={ruleForm.rule_type} onChange={(event) => setRuleForm((current) => ({ ...current, rule_type: event.target.value }))} className="field">
              {RULE_TYPES.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Product (optional)">
              <select value={ruleForm.product} onChange={(event) => setRuleForm((current) => ({ ...current, product: event.target.value }))} className="field">
                <option value="">All products</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
              </select>
            </Field>
            <Field label="Printing method">
              <select value={ruleForm.printing_method} onChange={(event) => setRuleForm((current) => ({ ...current, printing_method: event.target.value }))} className="field">
                <option value="">Any method</option>
                {methods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Amount"><input required type="number" step="0.01" value={ruleForm.amount} onChange={(event) => setRuleForm((current) => ({ ...current, amount: event.target.value }))} className="field" /></Field>
          <Field label="Description"><input value={ruleForm.description} onChange={(event) => setRuleForm((current) => ({ ...current, description: event.target.value }))} className="field" /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ruleForm.is_active} onChange={(event) => setRuleForm((current) => ({ ...current, is_active: event.target.checked }))} /> Active</label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setRuleOpen(false)}>Cancel</Button>
            <Button type="submit" loading={ruleSaving}>Create rule</Button>
          </div>
        </form>
      </Modal>

      <Modal open={methodOpen} onClose={() => setMethodOpen(false)} title="New printing method">
        <form onSubmit={createMethod} className="space-y-3">
          <Field label="Name"><input required value={methodForm.name} onChange={(event) => setMethodForm((current) => ({ ...current, name: event.target.value }))} className="field" /></Field>
          <Field label="Description"><textarea rows={2} value={methodForm.description} onChange={(event) => setMethodForm((current) => ({ ...current, description: event.target.value }))} className="field" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Base fee"><input type="number" step="0.01" value={methodForm.base_fee} onChange={(event) => setMethodForm((current) => ({ ...current, base_fee: event.target.value }))} className="field" /></Field>
            <Field label="Per area fee"><input type="number" step="0.01" value={methodForm.per_area_fee} onChange={(event) => setMethodForm((current) => ({ ...current, per_area_fee: event.target.value }))} className="field" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sort order"><input type="number" value={methodForm.sort_order} onChange={(event) => setMethodForm((current) => ({ ...current, sort_order: event.target.value }))} className="field" /></Field>
            <label className="mt-6 flex items-center gap-2 text-sm"><input type="checkbox" checked={methodForm.is_active} onChange={(event) => setMethodForm((current) => ({ ...current, is_active: event.target.checked }))} /> Active</label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setMethodOpen(false)}>Cancel</Button>
            <Button type="submit" loading={methodSaving}>Create method</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
