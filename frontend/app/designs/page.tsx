"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Copy, Download, PenTool, Plus, Trash2 } from "lucide-react";
import { api, errorMessage, mediaUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Design, GeneratedFile, Paginated } from "@/lib/types";
import { formatDate, statusTone, titleCase } from "@/lib/utils";
import { Alert, Badge, Button, EmptyState, LinkButton, LoadingBlock } from "@/components/ui";

export default function DesignsPage() {
  const { user, loading: authLoading } = useAuth();
  const [designs, setDesigns] = useState<Design[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const loadDesigns = () => {
    api
      .get<Paginated<Design>>("/designs/")
      .then((data) => setDesigns(data.results))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    loadDesigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const duplicate = async (design: Design) => {
    setBusy(design.id);
    setError("");
    try {
      await api.post(`/designs/${design.id}/duplicate/`);
      loadDesigns();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy("");
    }
  };

  const remove = async (design: Design) => {
    if (!window.confirm(`Delete “${design.name}”? This can't be undone.`)) return;
    setBusy(design.id);
    setError("");
    try {
      await api.delete(`/designs/${design.id}/`);
      setDesigns((current) => current.filter((item) => item.id !== design.id));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy("");
    }
  };

  const download = async (design: Design) => {
    setBusy(design.id);
    setError("");
    try {
      const file = await api.post<GeneratedFile>("/exports/create/", { design: design.id, file_type: "png", dpi: 150 });
      if (file.url) window.open(mediaUrl(file.url), "_blank");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy("");
    }
  };

  if (authLoading || (user && loading)) return <LoadingBlock label="Opening your design library…" />;

  if (!user) {
    return (
      <div className="container-x py-16">
        <EmptyState
          icon={<PenTool />}
          title="Sign in to see your designs"
          description="Every canvas you save is versioned and kept in your studio."
          action={<LinkButton href="/login?next=/designs">Sign in</LinkButton>}
        />
      </div>
    );
  }

  return (
    <div className="container-x py-10 lg:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Design library</p>
          <h1 className="mt-2 display-title">Your ideas, on file.</h1>
          <p className="mt-3 text-sm text-muted">Open, duplicate, download or delete any saved canvas.</p>
        </div>
        <LinkButton href="/shop">
          <Plus size={15} /> New design
        </LinkButton>
      </div>

      {error && <div className="mt-5"><Alert>{error}</Alert></div>}

      {designs.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<PenTool />}
            title="Nothing saved yet"
            description="Start with a product or a template and your design will appear here."
            action={<LinkButton href="/shop">Start designing</LinkButton>}
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {designs.map((design) => (
            <div key={design.id} className="card overflow-hidden">
              <div className="relative aspect-square bg-sand">
                {design.preview_url ? (
                  <img src={mediaUrl(design.preview_url)} alt={design.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted">No preview</div>
                )}
                <Badge className={`absolute left-3 top-3 ${statusTone[design.status] || "bg-sand"}`}>
                  {titleCase(design.status)}
                </Badge>
              </div>
              <div className="p-4">
                <h3 className="truncate font-display text-lg">{design.name}</h3>
                <p className="mt-1 text-[11px] text-muted">
                  {design.product_name} · {design.stage_name || "Stage"} · v{design.version}
                </p>
                <p className="mt-0.5 text-[10px] text-muted">Updated {formatDate(design.updated_at)}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {design.product_slug && (
                    <LinkButton href={`/editor/${design.product_slug}?design=${design.id}`} size="sm" variant="secondary" className="flex-1">
                      Edit
                    </LinkButton>
                  )}
                  <button onClick={() => duplicate(design)} disabled={busy === design.id} className="rounded-full border border-ink/15 p-2 text-muted hover:border-ink hover:text-ink disabled:opacity-40" title="Duplicate">
                    <Copy size={14} />
                  </button>
                  <button onClick={() => download(design)} disabled={busy === design.id} className="rounded-full border border-ink/15 p-2 text-muted hover:border-ink hover:text-ink disabled:opacity-40" title="Download PNG">
                    <Download size={14} />
                  </button>
                  <button onClick={() => remove(design)} disabled={busy === design.id} className="rounded-full border border-ink/15 p-2 text-muted hover:border-rose-500 hover:text-rose-600 disabled:opacity-40" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
