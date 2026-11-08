"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ImagePlus, Layers, Plus, Printer, Star, Trash2 } from "lucide-react";
import { api, errorMessage, mediaUrl, request } from "@/lib/api";
import { AdminHeader, AdminTabs, TableShell, Td, Th } from "@/components/admin";
import { Alert, Badge, Button, Field, LinkButton, LoadingBlock, Modal } from "@/components/ui";
import type { Category, PrintArea, PrintingMethod, ProductImage } from "@/lib/types";
import { formatDate, money } from "@/lib/utils";

type Tab = "details" | "gallery" | "stages" | "variants" | "printing";

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
  quantity_discounts: { min_qty: number; percent: string }[];
  metadata: any;
  stage_count: number;
  created_at: string;
  updated_at: string;
}

interface AdminStage {
  id: string;
  product: string;
  name: string;
  slug: string;
  mockup_url: string | null;
  mockup_width: number;
  mockup_height: number;
  print_area: PrintArea | null;
  sort_order: number;
  is_active: boolean;
}

interface AdminVariant {
  id: string;
  product: string;
  name: string;
  sku: string;
  color_name: string;
  color_hex: string;
  size: string;
  price_delta: string;
  stock_quantity: number;
  is_active: boolean;
  sort_order: number;
}

interface AdminPrintingMethod extends PrintingMethod {
  is_active: boolean;
}

interface PrintingLink {
  id: string;
  printing_method: PrintingMethod;
  price_adjustment: string;
  is_default: boolean;
}

const BLANK_AREA = {
  name_area: "Print area",
  width_mm: "210",
  height_mm: "297",
  mockup_x: "250",
  mockup_y: "200",
  mockup_width: "500",
  mockup_height: "600",
  safe_area_mm: "3",
  bleed_mm: "0",
  editor_dpi: "150",
  export_dpi: "300",
  min_dpi: "150",
  grid_mm: "10",
  shape: "rectangle",
};

const BLANK_STAGE = {
  ...BLANK_AREA,
  name: "Front",
  stage_mockup_width: "1000",
  stage_mockup_height: "1000",
  sort_order: "0",
  is_active: true,
};

const BLANK_VARIANT = {
  name: "",
  sku: "",
  color_name: "",
  color_hex: "#1f1f1f",
  size: "",
  price_delta: "0",
  stock_quantity: "1000",
  is_active: true,
  sort_order: "0",
};

const BLANK_BASIC = {
  name: "",
  category: "",
  short_description: "",
  description: "",
  base_price: "",
  compare_at_price: "",
  currency: "USD",
  is_active: true,
  is_featured: false,
  quantity_discounts: "[]",
};

export default function AdminProductDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [product, setProduct] = useState<AdminProduct | null>(null);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [stages, setStages] = useState<AdminStage[]>([]);
  const [variants, setVariants] = useState<AdminVariant[]>([]);
  const [links, setLinks] = useState<PrintingLink[]>([]);
  const [methods, setMethods] = useState<AdminPrintingMethod[]>([]);
  const [tab, setTab] = useState<Tab>("details");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [basic, setBasic] = useState(BLANK_BASIC);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [galleryBusy, setGalleryBusy] = useState(false);

  const [stageOpen, setStageOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<AdminStage | null>(null);
  const [stageForm, setStageForm] = useState(BLANK_STAGE);
  const [stageFile, setStageFile] = useState<File | null>(null);
  const [stageSaving, setStageSaving] = useState(false);

  const [variantOpen, setVariantOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<AdminVariant | null>(null);
  const [variantForm, setVariantForm] = useState(BLANK_VARIANT);
  const [variantSaving, setVariantSaving] = useState(false);

  const [methodChoice, setMethodChoice] = useState("");
  const [methodAdjustment, setMethodAdjustment] = useState("0");
  const [methodDefault, setMethodDefault] = useState(false);
  const [methodBusy, setMethodBusy] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [productData, categoryData, imageData, stageData, variantData, linkData, methodData] = await Promise.all([
        api.get<AdminProduct>(`/admin/products/${id}/`),
        api.get<AdminCategory[]>("/admin/categories/"),
        api.get<ProductImage[]>(`/admin/products/${id}/images/`),
        api.get<AdminStage[]>(`/admin/products/${id}/stages/`),
        api.get<AdminVariant[]>(`/admin/variants/?product=${id}`),
        api.get<PrintingLink[]>(`/admin/products/${id}/printing-methods/`),
        api.get<AdminPrintingMethod[]>("/admin/printing-methods/"),
      ]);
      setProduct(productData);
      setCategories(categoryData);
      setImages(imageData);
      setStages(stageData);
      setVariants(variantData);
      setLinks(linkData);
      setMethods(methodData);
      setBasic({
        name: productData.name,
        category: productData.category || "",
        short_description: productData.short_description || "",
        description: productData.description || "",
        base_price: productData.base_price,
        compare_at_price: productData.compare_at_price || "",
        currency: productData.currency,
        is_active: productData.is_active,
        is_featured: productData.is_featured,
        quantity_discounts: JSON.stringify(productData.quantity_discounts || [], null, 2),
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  };

  const saveBasic = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      let discounts: any = [];
      if (basic.quantity_discounts.trim()) {
        try {
          discounts = JSON.parse(basic.quantity_discounts);
        } catch {
          throw new Error("Quantity discounts must be valid JSON.");
        }
      }
      const updated = await api.patch<AdminProduct>(`/admin/products/${id}/`, {
        ...basic,
        category: basic.category || null,
        compare_at_price: basic.compare_at_price || null,
        quantity_discounts: discounts,
      });
      setProduct(updated);
      flash("Product details saved.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = async () => {
    if (!imageFile) return;
    setGalleryBusy(true);
    setError("");
    try {
      const data = new FormData();
      data.append("image", imageFile);
      data.append("alt", product?.name || "");
      data.append("sort_order", String(images.length));
      await api.upload(`/admin/products/${id}/images/`, data);
      setImageFile(null);
      const refreshed = await api.get<ProductImage[]>(`/admin/products/${id}/images/`);
      setImages(refreshed);
      flash("Gallery image uploaded.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setGalleryBusy(false);
    }
  };

  const setCover = async (image: ProductImage) => {
    setGalleryBusy(true);
    setError("");
    try {
      await api.post(`/admin/products/${id}/set-cover/`, { image_id: image.id });
      const refreshed = await api.get<AdminProduct>(`/admin/products/${id}/`);
      setProduct(refreshed);
      flash("Cover image updated.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setGalleryBusy(false);
    }
  };

  const deleteImage = async (image: ProductImage) => {
    if (!window.confirm("Remove this gallery image?")) return;
    setGalleryBusy(true);
    setError("");
    try {
      await api.delete(`/admin/products/${id}/images/${image.id}/`);
      setImages((current) => current.filter((item) => item.id !== image.id));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setGalleryBusy(false);
    }
  };

  const openNewStage = () => {
    setEditingStage(null);
    setStageForm(BLANK_STAGE);
    setStageFile(null);
    setStageOpen(true);
  };

  const openEditStage = (stage: AdminStage) => {
    setEditingStage(stage);
    setStageForm({
      name: stage.name,
      stage_mockup_width: String(stage.mockup_width),
      stage_mockup_height: String(stage.mockup_height),
      sort_order: String(stage.sort_order),
      is_active: stage.is_active,
      name_area: stage.print_area?.name || "Print area",
      width_mm: stage.print_area?.width_mm || "210",
      height_mm: stage.print_area?.height_mm || "297",
      mockup_x: String(stage.print_area?.mockup_x ?? 250),
      mockup_y: String(stage.print_area?.mockup_y ?? 200),
      mockup_width: String(stage.print_area?.mockup_width ?? 500),
      mockup_height: String(stage.print_area?.mockup_height ?? 600),
      safe_area_mm: stage.print_area?.safe_area_mm || "3",
      bleed_mm: stage.print_area?.bleed_mm || "0",
      editor_dpi: String(stage.print_area?.editor_dpi ?? 150),
      export_dpi: String(stage.print_area?.export_dpi ?? 300),
      min_dpi: String(stage.print_area?.min_dpi ?? 150),
      grid_mm: String(stage.print_area?.grid_mm ?? 10),
      shape: stage.print_area?.shape || "rectangle",
    });
    setStageFile(null);
    setStageOpen(true);
  };

  const saveStage = async (event: React.FormEvent) => {
    event.preventDefault();
    setStageSaving(true);
    setError("");
    try {
      const area = {
        name: stageForm.name_area || "Print area",
        width_mm: stageForm.width_mm,
        height_mm: stageForm.height_mm,
        mockup_x: Number(stageForm.mockup_x),
        mockup_y: Number(stageForm.mockup_y),
        mockup_width: Number(stageForm.mockup_width),
        mockup_height: Number(stageForm.mockup_height),
        safe_area_mm: stageForm.safe_area_mm,
        bleed_mm: stageForm.bleed_mm,
        editor_dpi: Number(stageForm.editor_dpi),
        export_dpi: Number(stageForm.export_dpi),
        min_dpi: Number(stageForm.min_dpi),
        grid_mm: Number(stageForm.grid_mm),
        shape: stageForm.shape,
      };
      const data = new FormData();
      data.append("name", stageForm.name);
      data.append("mockup_width", stageForm.stage_mockup_width);
      data.append("mockup_height", stageForm.stage_mockup_height);
      data.append("sort_order", stageForm.sort_order);
      data.append("is_active", String(stageForm.is_active));
      data.append("print_area_data", JSON.stringify(area));
      if (stageFile) data.append("mockup_image", stageFile);
      await request({
        path: editingStage ? `/admin/stages/${editingStage.id}/` : `/admin/products/${id}/stages/`,
        method: editingStage ? "PATCH" : "POST",
        form: data,
      });
      setStageOpen(false);
      const [stageData, productData] = await Promise.all([
        api.get<AdminStage[]>(`/admin/products/${id}/stages/`),
        api.get<AdminProduct>(`/admin/products/${id}/`),
      ]);
      setStages(stageData);
      setProduct(productData);
      flash(editingStage ? "Stage updated." : "Stage created.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setStageSaving(false);
    }
  };

  const deleteStage = async (stage: AdminStage) => {
    if (!window.confirm(`Delete stage “${stage.name}” and its print area?`)) return;
    setError("");
    try {
      await api.delete(`/admin/stages/${stage.id}/`);
      setStages((current) => current.filter((item) => item.id !== stage.id));
      flash("Stage deleted.");
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const openNewVariant = () => {
    setEditingVariant(null);
    setVariantForm(BLANK_VARIANT);
    setVariantOpen(true);
  };

  const openEditVariant = (variant: AdminVariant) => {
    setEditingVariant(variant);
    setVariantForm({
      name: variant.name,
      sku: variant.sku,
      color_name: variant.color_name,
      color_hex: variant.color_hex || "#1f1f1f",
      size: variant.size,
      price_delta: variant.price_delta,
      stock_quantity: String(variant.stock_quantity),
      is_active: variant.is_active,
      sort_order: String(variant.sort_order),
    });
    setVariantOpen(true);
  };

  const saveVariant = async (event: React.FormEvent) => {
    event.preventDefault();
    setVariantSaving(true);
    setError("");
    try {
      const payload = {
        ...variantForm,
        product: id,
        stock_quantity: Number(variantForm.stock_quantity),
        sort_order: Number(variantForm.sort_order),
      };
      if (editingVariant) {
        await api.patch(`/admin/variants/${editingVariant.id}/`, payload);
      } else {
        await api.post("/admin/variants/", payload);
      }
      setVariantOpen(false);
      const refreshed = await api.get<AdminVariant[]>(`/admin/variants/?product=${id}`);
      setVariants(refreshed);
      flash(editingVariant ? "Variant updated." : "Variant added.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setVariantSaving(false);
    }
  };

  const deleteVariant = async (variant: AdminVariant) => {
    if (!window.confirm(`Delete variant “${variant.name}”?`)) return;
    setError("");
    try {
      await api.delete(`/admin/variants/${variant.id}/`);
      setVariants((current) => current.filter((item) => item.id !== variant.id));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const addMethod = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!methodChoice) return;
    setMethodBusy(true);
    setError("");
    try {
      await api.post(`/admin/products/${id}/printing-methods/`, {
        printing_method: methodChoice,
        price_adjustment: methodAdjustment,
        is_default: methodDefault,
      });
      setMethodChoice("");
      setMethodAdjustment("0");
      setMethodDefault(false);
      const refreshed = await api.get<PrintingLink[]>(`/admin/products/${id}/printing-methods/`);
      setLinks(refreshed);
      flash("Printing method attached.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setMethodBusy(false);
    }
  };

  const removeMethod = async (link: PrintingLink) => {
    if (!window.confirm(`Remove ${link.printing_method.name} from this product?`)) return;
    setError("");
    try {
      await api.delete(`/admin/products/${id}/printing-methods/${link.id}/`);
      setLinks((current) => current.filter((item) => item.id !== link.id));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const deleteProduct = async () => {
    if (!window.confirm(`Delete “${product?.name}”? This removes stages, variants and cannot be undone.`)) return;
    try {
      await api.delete(`/admin/products/${id}/`);
      router.push("/admin/products");
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (loading) return <LoadingBlock label="Opening the product…" />;
  if (!product) return <Alert>{error || "Product not found."}</Alert>;

  const availableMethods = methods.filter(
    (method) => !links.some((link) => link.printing_method.id === method.id)
  );

  return (
    <div className="space-y-7">
      <Link href="/admin/products" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink">
        <ArrowLeft size={14} /> All products
      </Link>

      <AdminHeader
        breadcrumbs={[{ label: "Commerce", href: "/admin" }, { label: "Products", href: "/admin/products" }, { label: product.name }]}
        title={product.name}
        description={`ID: ${product.id} · /${product.slug} · updated ${formatDate(product.updated_at)}`}
        actions={
          <>
            <LinkButton href={`/products/${product.slug}`} size="sm" variant="outline" target="_blank">View in shop</LinkButton>
            <Button size="sm" variant="danger" onClick={deleteProduct}><Trash2 size={14} /> Delete</Button>
          </>
        }
      />

      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <AdminTabs<Tab>
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "details", label: "Details" },
          { id: "gallery", label: "Gallery", count: images.length },
          { id: "stages", label: "Stages", count: stages.length },
          { id: "variants", label: "Variants", count: variants.length },
          { id: "printing", label: "Printing", count: links.length },
        ]}
      />

      {tab === "details" && (
        <form onSubmit={saveBasic} className="card space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name"><input required value={basic.name} onChange={(event) => setBasic((current) => ({ ...current, name: event.target.value }))} className="field" /></Field>
            <Field label="Category">
              <select value={basic.category} onChange={(event) => setBasic((current) => ({ ...current, category: event.target.value }))} className="field">
                <option value="">Uncategorised</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Base price"><input required type="number" step="0.01" min="0" value={basic.base_price} onChange={(event) => setBasic((current) => ({ ...current, base_price: event.target.value }))} className="field" /></Field>
            <Field label="Compare at"><input type="number" step="0.01" min="0" value={basic.compare_at_price} onChange={(event) => setBasic((current) => ({ ...current, compare_at_price: event.target.value }))} className="field" /></Field>
            <Field label="Currency"><input value={basic.currency} maxLength={3} onChange={(event) => setBasic((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} className="field" /></Field>
          </div>
          <Field label="Short description"><input value={basic.short_description} onChange={(event) => setBasic((current) => ({ ...current, short_description: event.target.value }))} className="field" /></Field>
          <Field label="Description"><textarea rows={5} value={basic.description} onChange={(event) => setBasic((current) => ({ ...current, description: event.target.value }))} className="field" /></Field>
          <Field label="Quantity discounts (JSON)" hint='Example: [{"min_qty": 5, "percent": "5.00"}]'>
            <textarea rows={4} value={basic.quantity_discounts} onChange={(event) => setBasic((current) => ({ ...current, quantity_discounts: event.target.value }))} className="field font-mono text-xs" />
          </Field>
          <div className="flex gap-5 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={basic.is_active} onChange={(event) => setBasic((current) => ({ ...current, is_active: event.target.checked }))} /> Active</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={basic.is_featured} onChange={(event) => setBasic((current) => ({ ...current, is_featured: event.target.checked }))} /> Featured</label>
          </div>
          <div className="flex justify-end"><Button type="submit" loading={saving}>Save details</Button></div>
        </form>
      )}

      {tab === "gallery" && (
        <div className="space-y-4">
          <div className="card flex flex-wrap items-end gap-3 p-5">
            <div className="flex-1">
              <Field label="Add an image"><input type="file" accept="image/*" onChange={(event) => setImageFile(event.target.files?.[0] || null)} className="field" /></Field>
            </div>
            <Button onClick={uploadImage} loading={galleryBusy} disabled={!imageFile}><ImagePlus size={15} /> Upload</Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {images.length === 0 && <p className="text-sm text-muted">No gallery images yet.</p>}
            {images.map((image) => (
              <div key={image.id} className="card overflow-hidden">
                <div className="relative aspect-square bg-sand">
                  <img src={mediaUrl(image.url)} alt={image.alt} className="h-full w-full object-cover" />
                </div>
                <div className="flex items-center justify-between gap-2 p-3">
                  <span className="truncate text-[11px] text-muted">{image.alt || "Untitled"}</span>
                  <div className="flex gap-1">
                    <button onClick={() => setCover(image)} disabled={galleryBusy} className="rounded-full p-2 text-muted hover:bg-sand hover:text-clay" title="Set as cover"><Star size={14} /></button>
                    <button onClick={() => deleteImage(image)} disabled={galleryBusy} className="rounded-full p-2 text-muted hover:bg-rose-50 hover:text-rose-600" title="Delete"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted">The current storefront cover is shown below. Set any gallery image as cover.</p>
          <div className="h-40 w-40 overflow-hidden rounded-2xl bg-sand">
            {product.image_url ? <img src={mediaUrl(product.image_url)} alt="Cover" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-muted">No cover</div>}
          </div>
        </div>
      )}

      {tab === "stages" && (
        <div className="space-y-4">
          <div className="flex justify-end"><Button onClick={openNewStage}><Plus size={14} /> New stage</Button></div>
          <div className="grid gap-4 lg:grid-cols-2">
            {stages.length === 0 && <p className="text-sm text-muted">No print stages yet. Customers can&apos;t design without one.</p>}
            {stages.map((stage, index) => (
              <div key={stage.id} className="card overflow-hidden">
                <div className="flex gap-4 p-4">
                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-sand">
                    {stage.mockup_url ? <img src={mediaUrl(stage.mockup_url)} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Layers size={20} className="text-muted" /></div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-display text-lg">{stage.name}</p>
                        <p className="text-[10px] text-muted">Stage {index + 1} · sort {stage.sort_order}</p>
                      </div>
                      <Badge className={stage.is_active ? "bg-emerald-100 text-emerald-900" : "bg-sand text-muted"}>{stage.is_active ? "Active" : "Hidden"}</Badge>
                    </div>
                    {stage.print_area && (
                      <p className="mt-2 text-xs text-muted">
                        {stage.print_area.width_mm} × {stage.print_area.height_mm} mm · {stage.print_area.export_dpi} DPI export · {stage.print_area.shape}
                      </p>
                    )}
                    <div className="mt-2 flex gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => openEditStage(stage)}>Edit</Button>
                      <button onClick={() => deleteStage(stage)} className="rounded-full p-2 text-muted hover:bg-rose-50 hover:text-rose-600"><Trash2 size={13} /></button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "variants" && (
        <div className="space-y-4">
          <div className="flex justify-end"><Button onClick={openNewVariant}><Plus size={14} /> New variant</Button></div>
          <TableShell>
            {variants.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted">No variants yet.</p>
            ) : (
              <table className="w-full">
                <thead className="border-b border-ink/10 bg-sand/40">
                  <tr><Th>Variant</Th><Th>SKU</Th><Th>Colour</Th><Th>Size</Th><Th>Price delta</Th><Th>Stock</Th><Th>Status</Th><Th /></tr>
                </thead>
                <tbody className="divide-y divide-ink/5">
                  {variants.map((variant) => (
                    <tr key={variant.id}>
                      <Td className="font-semibold">{variant.name}</Td>
                      <Td className="text-muted">{variant.sku || "—"}</Td>
                      <Td>
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                          <span className="h-3 w-3 rounded-full border border-ink/10" style={{ background: variant.color_hex }} />
                          {variant.color_name || "—"}
                        </span>
                      </Td>
                      <Td className="text-muted">{variant.size || "—"}</Td>
                      <Td>{money(variant.price_delta)}</Td>
                      <Td className="text-muted">{variant.stock_quantity}</Td>
                      <Td><Badge className={variant.is_active ? "bg-emerald-100 text-emerald-900" : "bg-sand text-muted"}>{variant.is_active ? "Active" : "Off"}</Badge></Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEditVariant(variant)}>Edit</Button>
                          <button onClick={() => deleteVariant(variant)} className="rounded-full p-2 text-muted hover:bg-rose-50 hover:text-rose-600"><Trash2 size={13} /></button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TableShell>
        </div>
      )}

      {tab === "printing" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <h2 className="font-display text-2xl">Attached methods</h2>
            {links.length === 0 && <p className="text-sm text-muted">No printing method attached. The product cannot be quoted.</p>}
            {links.map((link) => (
              <div key={link.id} className="card flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-clay/10 text-clay"><Printer size={16} /></span>
                  <div>
                    <p className="text-sm font-semibold">{link.printing_method.name} {link.is_default && <Badge className="ml-1 bg-amber-100 text-amber-900">Default</Badge>}</p>
                    <p className="text-[10px] text-muted">Base {money(link.printing_method.base_fee)} · per area {money(link.printing_method.per_area_fee)} · adjustment {money(link.price_adjustment)}</p>
                  </div>
                </div>
                <button onClick={() => removeMethod(link)} className="rounded-full p-2 text-muted hover:bg-rose-50 hover:text-rose-600"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>

          <form onSubmit={addMethod} className="card h-fit space-y-3 p-5">
            <h2 className="font-display text-xl">Attach a method</h2>
            <Field label="Printing method">
              <select value={methodChoice} onChange={(event) => setMethodChoice(event.target.value)} className="field">
                <option value="">Select…</option>
                {availableMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
              </select>
            </Field>
            <Field label="Price adjustment"><input type="number" step="0.01" value={methodAdjustment} onChange={(event) => setMethodAdjustment(event.target.value)} className="field" /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={methodDefault} onChange={(event) => setMethodDefault(event.target.checked)} /> Make default method</label>
            <Button type="submit" loading={methodBusy} disabled={!methodChoice}>Attach method</Button>
            {availableMethods.length === 0 && <p className="text-xs text-muted">All available methods are already attached.</p>}
          </form>
        </div>
      )}

      <Modal open={stageOpen} onClose={() => setStageOpen(false)} title={editingStage ? `Edit stage · ${editingStage.name}` : "New print stage"} wide>
        <form onSubmit={saveStage} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Stage name"><input required value={stageForm.name} onChange={(event) => setStageForm((current) => ({ ...current, name: event.target.value }))} className="field" /></Field>
            <Field label="Mockup width"><input type="number" value={stageForm.stage_mockup_width} onChange={(event) => setStageForm((current) => ({ ...current, stage_mockup_width: event.target.value }))} className="field" /></Field>
            <Field label="Mockup height"><input type="number" value={stageForm.stage_mockup_height} onChange={(event) => setStageForm((current) => ({ ...current, stage_mockup_height: event.target.value }))} className="field" /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mockup image"><input type="file" accept="image/*" onChange={(event) => setStageFile(event.target.files?.[0] || null)} className="field" /></Field>
            <Field label="Sort order"><input type="number" value={stageForm.sort_order} onChange={(event) => setStageForm((current) => ({ ...current, sort_order: event.target.value }))} className="field" /></Field>
          </div>

          <div className="rounded-xl border border-ink/10 bg-sand/30 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Print area</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Area name"><input value={stageForm.name_area} onChange={(event) => setStageForm((current) => ({ ...current, name_area: event.target.value }))} className="field" /></Field>
              <Field label="Width (mm)"><input required type="number" step="0.01" value={stageForm.width_mm} onChange={(event) => setStageForm((current) => ({ ...current, width_mm: event.target.value }))} className="field" /></Field>
              <Field label="Height (mm)"><input required type="number" step="0.01" value={stageForm.height_mm} onChange={(event) => setStageForm((current) => ({ ...current, height_mm: event.target.value }))} className="field" /></Field>
              <Field label="Mockup X"><input type="number" value={stageForm.mockup_x} onChange={(event) => setStageForm((current) => ({ ...current, mockup_x: event.target.value }))} className="field" /></Field>
              <Field label="Mockup Y"><input type="number" value={stageForm.mockup_y} onChange={(event) => setStageForm((current) => ({ ...current, mockup_y: event.target.value }))} className="field" /></Field>
              <Field label="Area width (mockup px)"><input type="number" value={stageForm.mockup_width} onChange={(event) => setStageForm((current) => ({ ...current, mockup_width: event.target.value }))} className="field" /></Field>
              <Field label="Area height (mockup px)"><input type="number" value={stageForm.mockup_height} onChange={(event) => setStageForm((current) => ({ ...current, mockup_height: event.target.value }))} className="field" /></Field>
              <Field label="Safe area (mm)"><input type="number" step="0.01" value={stageForm.safe_area_mm} onChange={(event) => setStageForm((current) => ({ ...current, safe_area_mm: event.target.value }))} className="field" /></Field>
              <Field label="Bleed (mm)"><input type="number" step="0.01" value={stageForm.bleed_mm} onChange={(event) => setStageForm((current) => ({ ...current, bleed_mm: event.target.value }))} className="field" /></Field>
              <Field label="Editor DPI"><input type="number" value={stageForm.editor_dpi} onChange={(event) => setStageForm((current) => ({ ...current, editor_dpi: event.target.value }))} className="field" /></Field>
              <Field label="Export DPI"><input type="number" value={stageForm.export_dpi} onChange={(event) => setStageForm((current) => ({ ...current, export_dpi: event.target.value }))} className="field" /></Field>
              <Field label="Minimum DPI"><input type="number" value={stageForm.min_dpi} onChange={(event) => setStageForm((current) => ({ ...current, min_dpi: event.target.value }))} className="field" /></Field>
              <Field label="Grid (mm)"><input type="number" value={stageForm.grid_mm} onChange={(event) => setStageForm((current) => ({ ...current, grid_mm: event.target.value }))} className="field" /></Field>
              <Field label="Shape">
                <select value={stageForm.shape} onChange={(event) => setStageForm((current) => ({ ...current, shape: event.target.value }))} className="field">
                  <option value="rectangle">Rectangle</option>
                  <option value="cylinder">Cylinder / wrap</option>
                </select>
              </Field>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={stageForm.is_active} onChange={(event) => setStageForm((current) => ({ ...current, is_active: event.target.checked }))} /> Active stage</label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setStageOpen(false)}>Cancel</Button>
            <Button type="submit" loading={stageSaving}>{editingStage ? "Save stage" : "Create stage"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={variantOpen} onClose={() => setVariantOpen(false)} title={editingVariant ? "Edit variant" : "New variant"}>
        <form onSubmit={saveVariant} className="space-y-3">
          <Field label="Name"><input required value={variantForm.name} onChange={(event) => setVariantForm((current) => ({ ...current, name: event.target.value }))} className="field" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="SKU"><input value={variantForm.sku} onChange={(event) => setVariantForm((current) => ({ ...current, sku: event.target.value }))} className="field" /></Field>
            <Field label="Size"><input value={variantForm.size} onChange={(event) => setVariantForm((current) => ({ ...current, size: event.target.value }))} className="field" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Colour name"><input value={variantForm.color_name} onChange={(event) => setVariantForm((current) => ({ ...current, color_name: event.target.value }))} className="field" /></Field>
            <Field label="Colour hex"><input type="color" value={variantForm.color_hex} onChange={(event) => setVariantForm((current) => ({ ...current, color_hex: event.target.value }))} className="field h-[42px]" /></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Price delta"><input type="number" step="0.01" value={variantForm.price_delta} onChange={(event) => setVariantForm((current) => ({ ...current, price_delta: event.target.value }))} className="field" /></Field>
            <Field label="Stock"><input type="number" value={variantForm.stock_quantity} onChange={(event) => setVariantForm((current) => ({ ...current, stock_quantity: event.target.value }))} className="field" /></Field>
            <Field label="Sort"><input type="number" value={variantForm.sort_order} onChange={(event) => setVariantForm((current) => ({ ...current, sort_order: event.target.value }))} className="field" /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={variantForm.is_active} onChange={(event) => setVariantForm((current) => ({ ...current, is_active: event.target.checked }))} /> Active</label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setVariantOpen(false)}>Cancel</Button>
            <Button type="submit" loading={variantSaving}>{editingVariant ? "Save variant" : "Add variant"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
