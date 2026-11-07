"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ImagePlus, Layers, Pencil, Plus, Search, Tags, Trash2 } from "lucide-react";
import { api, errorMessage, mediaUrl } from "@/lib/api";
import { AdminHeader, TableShell, Td, Th } from "@/components/admin";
import { Alert, Badge, Button, Field, LoadingBlock, Modal } from "@/components/ui";
import type { Category, Paginated } from "@/lib/types";
import { formatDate, money, titleCase } from "@/lib/utils";

interface AdminCategory extends Category {
  is_active: boolean;
}

interface AdminProduct {
  id: string;
  category: string | null;
  name: string;
  slug: string;
  short_description: string;
  description: string;
  base_price: string;
  compare_at_price: string | null;
  currency: string;
  image_url: string | null;
  is_active: boolean;
  is_featured: boolean;
  stage_count: number;
  created_at: string;
  updated_at: string;
}

const EMPTY_PRODUCT = {
  name: "",
  category: "",
  base_price: "",
  compare_at_price: "",
  short_description: "",
  description: "",
  currency: "USD",
  is_active: true,
  is_featured: false,
};

export default function AdminProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [saving, setSaving] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "", sort_order: "0", is_active: true });
  const [categoryImage, setCategoryImage] = useState<File | null>(null);
  const [categorySaving, setCategorySaving] = useState(false);

  const loadCategories = useCallback(() => {
    api.get<AdminCategory[]>("/admin/categories/").then(setCategories).catch(() => {});
  }, []);

  const loadProducts = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), page_size: "12" });
    if (query) params.set("search", query);
    api
      .get<Paginated<AdminProduct>>(`/admin/products/?${params.toString()}`)
      .then((data) => {
        setProducts(data.results);
        setCount(data.count);
        setTotalPages(data.total_pages);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [page, query]);

  useEffect(() => { loadCategories(); }, [loadCategories]);
  useEffect(() => { loadProducts(); }, [loadProducts]);

  const categoryName = (id: string | null) => categories.find((category) => category.id === id)?.name || "Uncategorised";

  const createProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const product = await api.post<AdminProduct>("/admin/products/", {
        ...form,
        category: form.category || null,
        compare_at_price: form.compare_at_price || null,
      });
      setCreateOpen(false);
      setForm(EMPTY_PRODUCT);
      router.push(`/admin/products/${product.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const removeProduct = async (product: AdminProduct) => {
    if (!window.confirm(`Delete “${product.name}” and all of its stages? This can't be undone.`)) return;
    setError("");
    try {
      await api.delete(`/admin/products/${product.id}/`);
      loadProducts();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const createCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    setCategorySaving(true);
    setError("");
    try {
      const data = new FormData();
      data.append("name", categoryForm.name);
      data.append("description", categoryForm.description);
      data.append("sort_order", categoryForm.sort_order);
      data.append("is_active", String(categoryForm.is_active));
      if (categoryImage) data.append("image", categoryImage);
      await api.upload("/admin/categories/", data);
      setCategoryForm({ name: "", description: "", sort_order: "0", is_active: true });
      setCategoryImage(null);
      loadCategories();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCategorySaving(false);
    }
  };

  const toggleCategory = async (category: AdminCategory) => {
    setError("");
    try {
      await api.patch(`/admin/categories/${category.id}/`, { is_active: !category.is_active });
      loadCategories();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const removeCategory = async (category: AdminCategory) => {
    if (!window.confirm(`Delete category “${category.name}”? Products will become uncategorised.`)) return;
    setError("");
    try {
      await api.delete(`/admin/categories/${category.id}/`);
      loadCategories();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    setQuery(search.trim());
  };

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Products"
        description="The catalogue, canvases, stages and print configuration."
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => setCategoryOpen(true)}><Tags size={14} /> Categories</Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}><Plus size={14} /> New product</Button>
          </>
        }
      />

      {error && <Alert>{error}</Alert>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <form onSubmit={submitSearch} className="flex w-full gap-2 sm:max-w-md">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products…" className="field pl-9" />
          </div>
          <Button type="submit" size="sm" variant="secondary">Search</Button>
        </form>
        <Badge className="bg-ink/5 text-muted">{count} products</Badge>
      </div>

      {loading ? (
        <LoadingBlock label="Loading the catalogue…" />
      ) : (
        <TableShell>
          {products.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-muted">No products yet. Create your first canvas.</p>
          ) : (
            <table className="w-full">
              <thead className="border-b border-ink/10 bg-sand/40">
                <tr>
                  <Th>Product</Th>
                  <Th>Category</Th>
                  <Th>Base price</Th>
                  <Th>Stages</Th>
                  <Th>Status</Th>
                  <Th>Created</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/5">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-sand/20">
                    <Td>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-sand">
                          {product.image_url ? <img src={mediaUrl(product.image_url)} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><ImagePlus size={14} className="text-muted" /></div>}
                        </div>
                        <div>
                          <Link href={`/admin/products/${product.id}`} className="font-semibold hover:text-clay">{product.name}</Link>
                          <p className="text-[10px] text-muted">/{product.slug}</p>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-muted">{categoryName(product.category)}</Td>
                    <Td>{money(product.base_price)}</Td>
                    <Td><span className="inline-flex items-center gap-1 text-muted"><Layers size={12} /> {product.stage_count}</span></Td>
                    <Td>
                      <div className="flex gap-1">
                        <Badge className={product.is_active ? "bg-emerald-100 text-emerald-900" : "bg-sand text-muted"}>{product.is_active ? "Active" : "Draft"}</Badge>
                        {product.is_featured && <Badge className="bg-amber-100 text-amber-900">Featured</Badge>}
                      </div>
                    </Td>
                    <Td className="text-muted">{formatDate(product.created_at)}</Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        <Link href={`/admin/products/${product.id}`} className="rounded-full p-2 text-muted hover:bg-sand hover:text-ink" title="Edit"><Pencil size={14} /></Link>
                        <button onClick={() => removeProduct(product)} className="rounded-full p-2 text-muted hover:bg-rose-50 hover:text-rose-600" title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </Td>
                  </tr>
                ))}
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

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New product" wide>
        <form onSubmit={createProduct} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name"><input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="field" /></Field>
            <Field label="Category">
              <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className="field">
                <option value="">Uncategorised</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Base price"><input required type="number" step="0.01" min="0" value={form.base_price} onChange={(event) => setForm((current) => ({ ...current, base_price: event.target.value }))} className="field" /></Field>
            <Field label="Compare at"><input type="number" step="0.01" min="0" value={form.compare_at_price} onChange={(event) => setForm((current) => ({ ...current, compare_at_price: event.target.value }))} className="field" /></Field>
            <Field label="Currency"><input value={form.currency} maxLength={3} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} className="field" /></Field>
          </div>
          <Field label="Short description"><input value={form.short_description} onChange={(event) => setForm((current) => ({ ...current, short_description: event.target.value }))} className="field" /></Field>
          <Field label="Description"><textarea rows={4} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="field" /></Field>
          <div className="flex gap-5 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} /> Active</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_featured} onChange={(event) => setForm((current) => ({ ...current, is_featured: event.target.checked }))} /> Featured</label>
          </div>
          <p className="text-xs text-muted">After saving, add gallery images, print stages and variants on the product page.</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Create product</Button>
          </div>
        </form>
      </Modal>

      <Modal open={categoryOpen} onClose={() => setCategoryOpen(false)} title="Categories" wide>
        <div className="space-y-4">
          <div className="space-y-2">
            {categories.length === 0 && <p className="text-sm text-muted">No categories yet.</p>}
            {categories.map((category) => (
              <div key={category.id} className="flex items-center justify-between rounded-xl border border-ink/10 bg-white px-3 py-2">
                <div>
                  <p className="text-sm font-semibold">{category.name}</p>
                  <p className="text-[10px] text-muted">{category.product_count} products · sort {category.sort_order}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => toggleCategory(category)}>Toggle</Button>
                  <button onClick={() => removeCategory(category)} className="rounded-full p-2 text-muted hover:bg-rose-50 hover:text-rose-600"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={createCategory} className="space-y-3 border-t border-ink/10 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Add category</p>
            <div className="grid gap-3 sm:grid-cols-[1fr_100px]">
              <Field label="Name"><input required value={categoryForm.name} onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))} className="field" /></Field>
              <Field label="Sort"><input type="number" value={categoryForm.sort_order} onChange={(event) => setCategoryForm((current) => ({ ...current, sort_order: event.target.value }))} className="field" /></Field>
            </div>
            <Field label="Description"><input value={categoryForm.description} onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))} className="field" /></Field>
            <Field label="Image"><input type="file" accept="image/*" onChange={(event) => setCategoryImage(event.target.files?.[0] || null)} className="field" /></Field>
            <Button type="submit" size="sm" loading={categorySaving}>Add category</Button>
          </form>
        </div>
      </Modal>
    </div>
  );
}
