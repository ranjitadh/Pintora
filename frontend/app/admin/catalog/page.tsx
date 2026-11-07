"use client";

import { useCallback, useEffect, useState } from "react";
import { ImagePlus, Plus, Shapes, Trash2, Type } from "lucide-react";
import { api, errorMessage, mediaUrl } from "@/lib/api";
import { AdminHeader, AdminTabs } from "@/components/admin";
import { Alert, Badge, Button, Field, LoadingBlock, Modal } from "@/components/ui";
import type { Paginated } from "@/lib/types";
import { formatDate, money, titleCase } from "@/lib/utils";

type Tab = "templates" | "cliparts" | "fonts";

interface AdminTemplate {
  id: string;
  name: string;
  slug: string;
  category: string;
  tags: string[];
  description: string;
  product: string | null;
  preview_url: string | null;
  canvas_json: any;
  price: string;
  is_active: boolean;
  visibility: string;
  created_at: string;
}

interface AdminClipart {
  id: string;
  name: string;
  category: string;
  tags: string[];
  image_url: string;
  price: string;
  is_active: boolean;
  sort_order: number;
}

interface AdminFont {
  id: string;
  name: string;
  family: string;
  url: string | null;
  weight: string;
  style: string;
  is_active: boolean;
  sort_order: number;
}

interface ProductOption {
  id: string;
  name: string;
}

const DEFAULT_CANVAS = JSON.stringify(
  {
    version: "5.3.0",
    width: 800,
    height: 800,
    objects: [
      {
        type: "textbox",
        version: "5.3.0",
        originX: "center",
        originY: "center",
        left: 400,
        top: 400,
        width: 520,
        text: "Your headline",
        fontSize: 72,
        fontFamily: "Inter",
        fontWeight: "bold",
        fill: "#1f1f1f",
        textAlign: "center",
        scaleX: 1,
        scaleY: 1,
        angle: 0,
        opacity: 1,
      },
    ],
  },
  null,
  2
);

const BLANK_TEMPLATE = {
  name: "",
  category: "General",
  description: "",
  product: "",
  price: "0",
  visibility: "public",
  is_active: true,
  tags: "",
  canvas_json: DEFAULT_CANVAS,
};

const BLANK_CLIPART = { name: "", category: "General", tags: "", price: "0", is_active: true, sort_order: "0" };
const BLANK_FONT = { name: "", family: "", weight: "400", style: "normal", is_active: true, sort_order: "0" };

function parseTags(value: string) {
  return value.split(",").map((tag) => tag.trim()).filter(Boolean);
}

export default function AdminCatalogPage() {
  const [tab, setTab] = useState<Tab>("templates");
  const [templates, setTemplates] = useState<AdminTemplate[]>([]);
  const [cliparts, setCliparts] = useState<AdminClipart[]>([]);
  const [fonts, setFonts] = useState<AdminFont[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateForm, setTemplateForm] = useState(BLANK_TEMPLATE);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templateSaving, setTemplateSaving] = useState(false);

  const [clipartOpen, setClipartOpen] = useState(false);
  const [clipartForm, setClipartForm] = useState(BLANK_CLIPART);
  const [clipartFile, setClipartFile] = useState<File | null>(null);
  const [clipartSaving, setClipartSaving] = useState(false);

  const [fontOpen, setFontOpen] = useState(false);
  const [fontForm, setFontForm] = useState(BLANK_FONT);
  const [fontFile, setFontFile] = useState<File | null>(null);
  const [fontSaving, setFontSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [templateData, clipartData, fontData, productData] = await Promise.all([
        api.get<AdminTemplate[]>("/admin/templates/"),
        api.get<AdminClipart[]>("/admin/cliparts/"),
        api.get<AdminFont[]>("/admin/fonts/"),
        api.get<Paginated<ProductOption>>("/admin/products/?page_size=100"),
      ]);
      setTemplates(templateData);
      setCliparts(clipartData);
      setFonts(fontData);
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

  const createTemplate = async (event: React.FormEvent) => {
    event.preventDefault();
    setTemplateSaving(true);
    setError("");
    try {
      let canvas: any;
      try {
        canvas = JSON.parse(templateForm.canvas_json);
      } catch {
        throw new Error("Canvas JSON is not valid JSON.");
      }
      const data = new FormData();
      data.append("name", templateForm.name);
      data.append("category", templateForm.category);
      data.append("description", templateForm.description);
      data.append("price", templateForm.price);
      data.append("visibility", templateForm.visibility);
      data.append("is_active", String(templateForm.is_active));
      data.append("tags", JSON.stringify(parseTags(templateForm.tags)));
      data.append("canvas_json", JSON.stringify(canvas));
      if (templateForm.product) data.append("product", templateForm.product);
      if (templateFile) data.append("preview_image", templateFile);
      await api.upload("/admin/templates/", data);
      setTemplateOpen(false);
      setTemplateForm(BLANK_TEMPLATE);
      setTemplateFile(null);
      const refreshed = await api.get<AdminTemplate[]>("/admin/templates/");
      setTemplates(refreshed);
      flash("Template created.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setTemplateSaving(false);
    }
  };

  const createClipart = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!clipartFile) {
      setError("Choose a clipart image to upload.");
      return;
    }
    setClipartSaving(true);
    setError("");
    try {
      const data = new FormData();
      data.append("name", clipartForm.name);
      data.append("category", clipartForm.category);
      data.append("price", clipartForm.price);
      data.append("is_active", String(clipartForm.is_active));
      data.append("sort_order", clipartForm.sort_order);
      data.append("tags", JSON.stringify(parseTags(clipartForm.tags)));
      data.append("image", clipartFile);
      await api.upload("/admin/cliparts/", data);
      setClipartOpen(false);
      setClipartForm(BLANK_CLIPART);
      setClipartFile(null);
      const refreshed = await api.get<AdminClipart[]>("/admin/cliparts/");
      setCliparts(refreshed);
      flash("Clipart added.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setClipartSaving(false);
    }
  };

  const createFont = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!fontFile) {
      setError("Choose a TTF, OTF, WOFF or WOFF2 font file.");
      return;
    }
    setFontSaving(true);
    setError("");
    try {
      const data = new FormData();
      data.append("name", fontForm.name);
      data.append("family", fontForm.family || fontForm.name);
      data.append("weight", fontForm.weight);
      data.append("style", fontForm.style);
      data.append("is_active", String(fontForm.is_active));
      data.append("sort_order", fontForm.sort_order);
      data.append("file", fontFile);
      await api.upload("/admin/fonts/", data);
      setFontOpen(false);
      setFontForm(BLANK_FONT);
      setFontFile(null);
      const refreshed = await api.get<AdminFont[]>("/admin/fonts/");
      setFonts(refreshed);
      flash("Font uploaded.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setFontSaving(false);
    }
  };

  const toggleItem = async (kind: Tab, id: string, current: boolean) => {
    setError("");
    try {
      await api.patch(`/admin/${kind}/${id}/`, { is_active: !current });
      const refreshed = await api.get<any[]>(`/admin/${kind}/`);
      if (kind === "templates") setTemplates(refreshed);
      if (kind === "cliparts") setCliparts(refreshed);
      if (kind === "fonts") setFonts(refreshed);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const deleteItem = async (kind: Tab, id: string, name: string) => {
    if (!window.confirm(`Delete “${name}”?`)) return;
    setError("");
    try {
      await api.delete(`/admin/${kind}/${id}/`);
      if (kind === "templates") setTemplates((current) => current.filter((item) => item.id !== id));
      if (kind === "cliparts") setCliparts((current) => current.filter((item) => item.id !== id));
      if (kind === "fonts") setFonts((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (loading) return <LoadingBlock label="Loading the design library…" />;

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Catalog"
        description="Design templates, clipart and fonts available inside the editor."
        actions={
          tab === "templates" ? <Button size="sm" onClick={() => setTemplateOpen(true)}><Plus size={14} /> New template</Button>
            : tab === "cliparts" ? <Button size="sm" onClick={() => setClipartOpen(true)}><Plus size={14} /> New clipart</Button>
            : <Button size="sm" onClick={() => setFontOpen(true)}><Plus size={14} /> New font</Button>
        }
      />

      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <AdminTabs<Tab>
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "templates", label: "Templates", count: templates.length },
          { id: "cliparts", label: "Clipart", count: cliparts.length },
          { id: "fonts", label: "Fonts", count: fonts.length },
        ]}
      />

      {tab === "templates" && (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {templates.length === 0 && <p className="text-sm text-muted">No templates yet.</p>}
          {templates.map((template) => (
            <div key={template.id} className="card overflow-hidden">
              <div className="relative aspect-[4/3] bg-sand">
                {template.preview_url ? <img src={mediaUrl(template.preview_url)} alt={template.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Shapes size={24} className="text-muted" /></div>}
                <div className="absolute left-2 top-2 flex gap-1">
                  <Badge className={template.is_active ? "bg-emerald-100 text-emerald-900" : "bg-sand text-muted"}>{template.is_active ? "Active" : "Off"}</Badge>
                  <Badge className="bg-white/80 text-ink">{titleCase(template.visibility)}</Badge>
                </div>
              </div>
              <div className="p-4">
                <p className="font-display text-lg">{template.name}</p>
                <p className="text-[10px] text-muted">{template.category} · {template.tags.join(", ") || "no tags"} · {formatDate(template.created_at)}</p>
                <p className="mt-1 text-xs font-semibold">{money(template.price)}</p>
                <div className="mt-3 flex items-center justify-between">
                  <Button size="sm" variant="ghost" onClick={() => toggleItem("templates", template.id, template.is_active)}>{template.is_active ? "Disable" : "Enable"}</Button>
                  <button onClick={() => deleteItem("templates", template.id, template.name)} className="rounded-full p-2 text-muted hover:bg-rose-50 hover:text-rose-600"><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "cliparts" && (
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {cliparts.length === 0 && <p className="text-sm text-muted">No clipart yet.</p>}
          {cliparts.map((clipart) => (
            <div key={clipart.id} className="card overflow-hidden">
              <div className="aspect-square bg-white p-3">
                <img src={mediaUrl(clipart.image_url)} alt={clipart.name} className="h-full w-full object-contain" />
              </div>
              <div className="p-3">
                <p className="truncate text-xs font-semibold">{clipart.name}</p>
                <p className="text-[10px] text-muted">{clipart.category} · {money(clipart.price)}</p>
                <div className="mt-2 flex items-center justify-between">
                  <button onClick={() => toggleItem("cliparts", clipart.id, clipart.is_active)}><Badge className={clipart.is_active ? "bg-emerald-100 text-emerald-900" : "bg-sand text-muted"}>{clipart.is_active ? "Active" : "Off"}</Badge></button>
                  <button onClick={() => deleteItem("cliparts", clipart.id, clipart.name)} className="rounded-full p-1.5 text-muted hover:bg-rose-50 hover:text-rose-600"><Trash2 size={12} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "fonts" && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {fonts.length === 0 && <p className="text-sm text-muted">No custom fonts yet.</p>}
          {fonts.map((font) => (
            <div key={font.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-xl">{font.name}</p>
                  <p className="text-[10px] text-muted">{font.family} · {font.weight} · {font.style}</p>
                </div>
                <button onClick={() => toggleItem("fonts", font.id, font.is_active)}><Badge className={font.is_active ? "bg-emerald-100 text-emerald-900" : "bg-sand text-muted"}>{font.is_active ? "Active" : "Off"}</Badge></button>
              </div>
              <p className="mt-4 text-2xl" style={{ fontFamily: font.family }}>Aa Bb Cc 123</p>
              <div className="mt-3 flex justify-end">
                <button onClick={() => deleteItem("fonts", font.id, font.name)} className="rounded-full p-2 text-muted hover:bg-rose-50 hover:text-rose-600"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={templateOpen} onClose={() => setTemplateOpen(false)} title="New template" wide>
        <form onSubmit={createTemplate} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name"><input required value={templateForm.name} onChange={(event) => setTemplateForm((current) => ({ ...current, name: event.target.value }))} className="field" /></Field>
            <Field label="Category"><input value={templateForm.category} onChange={(event) => setTemplateForm((current) => ({ ...current, category: event.target.value }))} className="field" /></Field>
          </div>
          <Field label="Description"><input value={templateForm.description} onChange={(event) => setTemplateForm((current) => ({ ...current, description: event.target.value }))} className="field" /></Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Product (optional)">
              <select value={templateForm.product} onChange={(event) => setTemplateForm((current) => ({ ...current, product: event.target.value }))} className="field">
                <option value="">Any product</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
              </select>
            </Field>
            <Field label="Price"><input type="number" step="0.01" value={templateForm.price} onChange={(event) => setTemplateForm((current) => ({ ...current, price: event.target.value }))} className="field" /></Field>
            <Field label="Visibility">
              <select value={templateForm.visibility} onChange={(event) => setTemplateForm((current) => ({ ...current, visibility: event.target.value }))} className="field">
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </Field>
          </div>
          <Field label="Tags" hint="Comma separated"><input value={templateForm.tags} onChange={(event) => setTemplateForm((current) => ({ ...current, tags: event.target.value }))} className="field" /></Field>
          <Field label="Canvas JSON" hint="Fabric.js canvas with width, height and objects.">
            <textarea rows={8} value={templateForm.canvas_json} onChange={(event) => setTemplateForm((current) => ({ ...current, canvas_json: event.target.value }))} className="field font-mono text-xs" />
          </Field>
          <Field label="Preview image (optional, auto-generated if empty)"><input type="file" accept="image/*" onChange={(event) => setTemplateFile(event.target.files?.[0] || null)} className="field" /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={templateForm.is_active} onChange={(event) => setTemplateForm((current) => ({ ...current, is_active: event.target.checked }))} /> Active</label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setTemplateOpen(false)}>Cancel</Button>
            <Button type="submit" loading={templateSaving}><Type size={14} /> Create template</Button>
          </div>
        </form>
      </Modal>

      <Modal open={clipartOpen} onClose={() => setClipartOpen(false)} title="New clipart">
        <form onSubmit={createClipart} className="space-y-3">
          <Field label="Name"><input required value={clipartForm.name} onChange={(event) => setClipartForm((current) => ({ ...current, name: event.target.value }))} className="field" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category"><input value={clipartForm.category} onChange={(event) => setClipartForm((current) => ({ ...current, category: event.target.value }))} className="field" /></Field>
            <Field label="Price"><input type="number" step="0.01" value={clipartForm.price} onChange={(event) => setClipartForm((current) => ({ ...current, price: event.target.value }))} className="field" /></Field>
          </div>
          <Field label="Tags" hint="Comma separated"><input value={clipartForm.tags} onChange={(event) => setClipartForm((current) => ({ ...current, tags: event.target.value }))} className="field" /></Field>
          <Field label="Image"><input required type="file" accept="image/*" onChange={(event) => setClipartFile(event.target.files?.[0] || null)} className="field" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sort order"><input type="number" value={clipartForm.sort_order} onChange={(event) => setClipartForm((current) => ({ ...current, sort_order: event.target.value }))} className="field" /></Field>
            <label className="mt-6 flex items-center gap-2 text-sm"><input type="checkbox" checked={clipartForm.is_active} onChange={(event) => setClipartForm((current) => ({ ...current, is_active: event.target.checked }))} /> Active</label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setClipartOpen(false)}>Cancel</Button>
            <Button type="submit" loading={clipartSaving}><ImagePlus size={14} /> Upload clipart</Button>
          </div>
        </form>
      </Modal>

      <Modal open={fontOpen} onClose={() => setFontOpen(false)} title="Upload font">
        <form onSubmit={createFont} className="space-y-3">
          <Field label="Name"><input required value={fontForm.name} onChange={(event) => setFontForm((current) => ({ ...current, name: event.target.value }))} className="field" /></Field>
          <Field label="CSS family"><input value={fontForm.family} onChange={(event) => setFontForm((current) => ({ ...current, family: event.target.value }))} className="field" placeholder="Defaults to name" /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Weight"><input value={fontForm.weight} onChange={(event) => setFontForm((current) => ({ ...current, weight: event.target.value }))} className="field" /></Field>
            <Field label="Style"><input value={fontForm.style} onChange={(event) => setFontForm((current) => ({ ...current, style: event.target.value }))} className="field" /></Field>
            <Field label="Sort"><input type="number" value={fontForm.sort_order} onChange={(event) => setFontForm((current) => ({ ...current, sort_order: event.target.value }))} className="field" /></Field>
          </div>
          <Field label="Font file" hint="TTF, OTF, WOFF or WOFF2"><input required type="file" accept=".ttf,.otf,.woff,.woff2" onChange={(event) => setFontFile(event.target.files?.[0] || null)} className="field" /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={fontForm.is_active} onChange={(event) => setFontForm((current) => ({ ...current, is_active: event.target.checked }))} /> Active</label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setFontOpen(false)}>Cancel</Button>
            <Button type="submit" loading={fontSaving}><Type size={14} /> Upload font</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
