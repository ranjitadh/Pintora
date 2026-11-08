"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, Search } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { AdminHeader, TableShell, Td, Th } from "@/components/admin";
import { Alert, Badge, Button, Field, LoadingBlock, Modal } from "@/components/ui";
import type { Paginated } from "@/lib/types";
import { formatDate, initials } from "@/lib/utils";

interface AdminCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  date_joined: string;
  design_count: number;
  order_count: number;
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<AdminCustomer | null>(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", is_active: true });
  const [saving, setSaving] = useState(false);

  const loadCustomers = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), page_size: "20" });
    if (query) params.set("search", query);
    api
      .get<Paginated<AdminCustomer>>(`/auth/admin/customers/?${params.toString()}`)
      .then((data) => {
        setCustomers(data.results);
        setCount(data.count);
        setTotalPages(data.total_pages);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [page, query]);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const openCustomer = (customer: AdminCustomer) => {
    setSelected(customer);
    setForm({ first_name: customer.first_name, last_name: customer.last_name, is_active: customer.is_active });
  };

  const saveCustomer = async () => {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const updated = await api.patch<AdminCustomer>(`/auth/admin/customers/${selected.id}/`, form);
      setSelected(null);
      setCustomers((current) => current.map((customer) => (customer.id === updated.id ? { ...customer, ...updated } : customer)));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    setQuery(search.trim());
  };

  return (
    <div className="space-y-7">
      <AdminHeader
        breadcrumbs={[{ label: "Commerce", href: "/admin" }, { label: "Customers" }]}
        title="Customers"
        description="People with a Printora account, their designs and order history."
        actions={<Badge className="bg-ink/5 text-muted">{count} customers</Badge>}
      />
      {error && <Alert>{error}</Alert>}

      <form onSubmit={submitSearch} className="flex w-full gap-2 sm:max-w-md">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by email…" className="field pl-9" />
        </div>
        <Button type="submit" size="sm" variant="secondary">Search</Button>
      </form>

      {loading ? (
        <LoadingBlock label="Loading customers…" />
      ) : (
        <TableShell>
          {customers.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-muted">No customers match this view.</p>
          ) : (
            <table className="w-full">
              <thead className="border-b border-ink/10 bg-sand/40">
                <tr><Th>Customer</Th><Th>Joined</Th><Th>Designs</Th><Th>Orders</Th><Th>Status</Th><Th /></tr>
              </thead>
              <tbody className="divide-y divide-ink/5">
                {customers.map((customer) => {
                  const name = [customer.first_name, customer.last_name].filter(Boolean).join(" ") || customer.email;
                  return (
                    <tr key={customer.id} className="hover:bg-sand/20">
                      <Td>
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-olive text-xs font-semibold text-cream">{initials(name)}</span>
                          <div>
                            <p className="font-semibold">{name}</p>
                            <p className="text-[10px] text-muted">{customer.email}</p>
                          </div>
                        </div>
                      </Td>
                      <Td className="text-muted">{formatDate(customer.date_joined)}</Td>
                      <Td>{customer.design_count}</Td>
                      <Td>{customer.order_count}</Td>
                      <Td><Badge className={customer.is_active ? "bg-emerald-100 text-emerald-900" : "bg-sand text-muted"}>{customer.is_active ? "Active" : "Disabled"}</Badge></Td>
                      <Td className="text-right"><Button size="sm" variant="ghost" onClick={() => openCustomer(customer)}>Manage</Button></Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </TableShell>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button>
          </div>
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Customer profile">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-sand/40 p-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-olive text-sm font-semibold text-cream">
                {initials(`${selected.first_name} ${selected.last_name}` || selected.email)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{selected.email}</p>
                <p className="text-[11px] text-muted"><Mail size={10} className="mr-1 inline" /> Joined {formatDate(selected.date_joined)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-ink/10 p-3 text-center"><p className="font-display text-2xl">{selected.design_count}</p><p className="text-[10px] uppercase tracking-wide text-muted">Designs</p></div>
              <div className="rounded-xl border border-ink/10 p-3 text-center"><p className="font-display text-2xl">{selected.order_count}</p><p className="text-[10px] uppercase tracking-wide text-muted">Orders</p></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name"><input value={form.first_name} onChange={(event) => setForm((current) => ({ ...current, first_name: event.target.value }))} className="field" /></Field>
              <Field label="Last name"><input value={form.last_name} onChange={(event) => setForm((current) => ({ ...current, last_name: event.target.value }))} className="field" /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} /> Account active</label>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSelected(null)}>Cancel</Button>
              <Button onClick={saveCustomer} loading={saving}>Save customer</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
