"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Download,
  Loader2,
  PenTool,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { api, errorMessage, mediaUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Design, GeneratedFile, Paginated } from "@/lib/types";
import { formatDate, titleCase } from "@/lib/utils";
import { Alert, Badge, EmptyState, LinkButton, LoadingBlock, Modal } from "@/components/ui";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 12;

const DESIGN_STATUS_TONE: Record<string, string> = {
  draft: "bg-amber-50 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
  saved: "bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200",
  ordered: "bg-emerald-50 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
  completed: "bg-emerald-50 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
  cancelled: "bg-rose-50 text-rose-900 dark:bg-rose-900/30 dark:text-rose-200",
};

const SORT_OPTIONS: { value: string; label: string; ordering: string }[] = [
  { value: "newest", label: "Newest first", ordering: "-updated_at" },
  { value: "oldest", label: "Oldest first", ordering: "updated_at" },
  { value: "name_asc", label: "Name A–Z", ordering: "name" },
  { value: "name_desc", label: "Name Z–A", ordering: "-name" },
];

interface DesignsContentProps {
  initialSearch: string;
  initialSort: string;
  initialPage: number;
}

export function DesignsContent({
  initialSearch,
  initialSort,
  initialPage,
}: DesignsContentProps) {
  const { user, loading: authLoading } = useAuth();
  const [designs, setDesigns] = useState<Design[]>([]);
  const [count, setCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(initialPage);
  const [search, setSearch] = useState(initialSearch);
  const [sort, setSort] = useState(initialSort);
  const [ordering, setOrdering] = useState(
    SORT_OPTIONS.find((s) => s.value === initialSort)?.ordering || "-updated_at"
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Design | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportError, setExportError] = useState("");

  // Sync UI state to the shareable URL.
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (sort !== "newest") params.set("sort", sort);
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}`
    );
  }, [search, sort, page]);

  const loadDesigns = useCallback(
    async (pageNum: number) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          page: String(pageNum),
          page_size: String(PAGE_SIZE),
          ordering,
        });
        if (search.trim()) params.set("search", search.trim());
        const data = await api.get<Paginated<Design>>(
          `/designs/?${params.toString()}`
        );
        setDesigns(data.results);
        setCount(data.count);
        setTotalPages(data.total_pages);
        setPage(pageNum);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [search, ordering]
  );

  // Load when user, auth state, search, sort, or page changes.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    loadDesigns(1);
  }, [user, authLoading, search, sort, page, loadDesigns]);

  const duplicate = async (design: Design) => {
    setBusy(design.id);
    setError("");
    try {
      await api.post(`/designs/${design.id}/duplicate/`);
      loadDesigns(page);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const requestDelete = (design: Design) => {
    setError("");
    setDeleteTarget(design);
  };

  const cancelDelete = () => {
    setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(deleteTarget.id);
    setError("");
    try {
      await api.delete(`/designs/${deleteTarget.id}/`);
      setDesigns((current) => current.filter((item) => item.id !== deleteTarget.id));
      setCount((c) => Math.max(c - 1, 0));
      // Clamp page if we emptied the last page.
      if (page > 1 && page > totalPages) {
        setPage(totalPages || 1);
        loadDesigns(totalPages || 1);
      } else {
        loadDesigns(page);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
      setDeleteTarget(null);
    }
  };

  const download = async (design: Design) => {
    setExporting(design.id);
    setExportError("");
    try {
      const file = await api.post<GeneratedFile>("/exports/create/", {
        design: design.id,
        file_type: "png",
        dpi: 150,
      });

      let completed = false;
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const updated = await api.get<GeneratedFile>(`/exports/${file.id}/`);
        if (updated.status === "completed") {
          completed = true;
          if (updated.url) window.open(mediaUrl(updated.url), "_blank");
          break;
        }
        if (updated.status === "failed") {
          setExportError(updated.error || "Export failed.");
          break;
        }
      }
      if (!completed) {
        setExportError("Export is taking longer than expected. Try again.");
      }
    } catch (err) {
      setExportError(errorMessage(err));
    } finally {
      setExporting(null);
    }
  };

  const isBusy = (id: string) => busy === id || exporting === id;

  if (authLoading || (user && loading)) {
    return <LoadingBlock label="Opening your design library…" />;
  }

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

  const visibleCount = loading ? count : designs.length;

  return (
    <div className="container-x py-10 lg:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Design library</p>
          <h1 className="mt-2 display-title">Your ideas, on file.</h1>
          <p className="mt-3 text-sm text-muted">
            Open, duplicate, download or delete any saved canvas.
          </p>
        </div>
        <LinkButton href="/shop">
          <Plus size={15} /> New design
        </LinkButton>
      </div>

      {/* Search + filter bar */}
      <div className="mt-6 lg:mt-8 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="relative w-full max-w-lg">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search by name"
            aria-label="Search designs"
            className="field pl-9"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:bg-ink/10 hover:text-ink"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="designs-sort" className="sr-only">
            Sort designs
          </label>
          <select
            id="designs-sort"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm outline-none dark:border-white/20 dark:bg-white/10 dark:text-cream"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <LinkButton
            href="/shop"
            variant="outline"
            size="sm"
            className="ml-2"
          >
            New design
          </LinkButton>
        </div>
      </div>

      {error && <div className="mt-5"><Alert>{error}</Alert></div>}

      {designs.length === 0 && !loading ? (
        <div className="mt-10">
          <EmptyState
            icon={<PenTool />}
            title={search ? "No designs match" : "Nothing saved yet"}
            description={
              search
                ? "Try a different search, or start from a blank canvas in the shop."
                : "Start with a product or a template and your design will appear here."
            }
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setPage(1);
                    }}
                    className="rounded-full border border-ink/20 px-5 py-2.5 text-sm font-semibold transition hover:border-ink hover:bg-ink/5"
                  >
                    Clear search
                  </button>
                )}
                <LinkButton href="/shop">Start designing</LinkButton>
              </div>
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-8 flex items-center justify-between gap-3">
            <p className="text-sm text-muted" aria-live="polite">
              {visibleCount} design{visibleCount === 1 ? "" : "s"}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-3 text-sm text-muted">
                <button
                  type="button"
                  disabled={page === 1 || loading}
                  onClick={() => setPage(page - 1)}
                  className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed hover:border-ink"
                >
                  <ArrowLeft size={14} /> Prev
                </button>
                <span>Page {page} of {totalPages}</span>
                <button
                  type="button"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage(page + 1)}
                  className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed hover:border-ink"
                >
                  Next <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>

          <div
            id="design-grid"
            className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            aria-busy={loading}
          >
            {loading ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-10 xl:grid-cols-4" aria-hidden>
                {Array.from({ length: PAGE_SIZE }).map((_, index) => (
                  <DesignSkeleton key={index} />
                ))}
              </div>
            ) : (
              designs.map((design) => (
                <DesignCard
                  key={design.id}
                  design={design}
                  isBusy={isBusy(design.id)}
                  onDuplicate={() => duplicate(design)}
                  onRequestDelete={() => requestDelete(design)}
                  onDownload={() => download(design)}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* Delete confirmation modal */}
      <Modal
        open={deleteTarget !== null}
        onClose={cancelDelete}
        title="Delete design"
        wide={false}
      >
        <p className="mb-4 text-sm">
          Are you sure you want to delete “{deleteTarget?.name}”? This can&rsquo;t be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={cancelDelete}
            className="rounded-full px-4 py-2 text-sm font-semibold text-muted hover:bg-ink/5 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmDelete}
            disabled={busy === deleteTarget?.id}
            className="rounded-full px-4 py-2 text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60 transition"
          >
            {busy === deleteTarget?.id ? <Loader2 size={14} className="animate-spin" /> : "Delete"}
          </button>
        </div>
      </Modal>

      {/* Export error alert */}
      {exportError && (
        <div className="mt-5">
          <Alert tone="error">{exportError}</Alert>
        </div>
      )}
    </div>
  );
}

function DesignSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl bg-white shadow-card sm:rounded-3xl">
      <div className="aspect-square bg-sand" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-3/4 rounded bg-sand" />
        <div className="h-3 w-1/2 rounded bg-sand" />
        <div className="h-3 w-full rounded bg-sand" />
        <div className="h-3 w-1/3 rounded bg-sand" />
      </div>
    </div>
  );
}

interface DesignCardProps {
  design: Design;
  isBusy: boolean;
  onDuplicate: () => void;
  onRequestDelete: () => void;
  onDownload: () => void;
}

function DesignCard({ design, isBusy, onDuplicate, onRequestDelete, onDownload }: DesignCardProps) {
  const statusToneClass = DESIGN_STATUS_TONE[design.status] || "bg-sand text-ink";

  return (
    <div className="card overflow-hidden flex flex-col h-full">
      <div className="relative aspect-square overflow-hidden bg-sand">
        {design.preview_url ? (
          <img
            src={mediaUrl(design.preview_url)}
            alt={`${design.name} preview`}
            width={600}
            height={600}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain object-position-center"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-sand/50">
            <PenTool size={34} className="text-ink/15" />
          </div>
        )}
        <Badge className={`absolute left-3 top-3 ${statusToneClass}`}>
          {titleCase(design.status)}
        </Badge>
        {isBusy && (
          <div className="absolute inset-0 bg-ink/60 flex items-center justify-center">
            <Loader2 size={16} className="animate-spin text-cream" />
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col h-full">
        <h3 className="truncate font-display text-lg leading-tight">{design.name}</h3>
        <p className="mt-1 text-[11px] text-muted line-clamp-1">
          {design.product_name} · {design.stage_name || "Stage"} · v{design.version}
        </p>
        <p className="mt-0.5 text-[10px] text-muted">
          Updated {formatDate(design.updated_at)}
        </p>
        <div className="mt-auto pt-4 border-t border-ink/10">
          <LinkButton
            href={`/editor/${design.product_slug}?design=${design.id}`}
            variant="primary"
            size="sm"
            className="w-full sm:w-auto justify-center"
          >
            <PenTool size={14} className="mr-1.5" />
            Edit
          </LinkButton>
          <div className="mt-2 sm:mt-0 flex flex-wrap sm:flex-nowrap items-center gap-1.5">
            <button
              type="button"
              onClick={onDuplicate}
              disabled={isBusy}
              title="Duplicate"
              aria-label="Duplicate design"
              className={cn(
                "rounded-full border border-ink/15 px-2.5 py-1.5 text-xs font-medium transition",
                isBusy
                  ? "opacity-60 cursor-not-allowed"
                  : "text-muted hover:border-ink hover:text-ink disabled:opacity-40"
              )}
            >
              <Copy size={13} />
              <span className="ml-1.5 hidden sm:inline">Duplicate</span>
            </button>
            <button
              type="button"
              onClick={onDownload}
              disabled={isBusy}
              title="Download PNG"
              aria-label="Download design"
              className={cn(
                "rounded-full border border-ink/15 px-2.5 py-1.5 text-xs font-medium transition",
                isBusy
                  ? "opacity-60 cursor-not-allowed"
                  : "text-muted hover:border-ink hover:text-ink disabled:opacity-40"
              )}
            >
              <Download size={13} />
              <span className="ml-1.5 hidden sm:inline">Download</span>
            </button>
            <button
              type="button"
              onClick={onRequestDelete}
              disabled={isBusy}
              title="Delete"
              aria-label="Delete design"
              className={cn(
                "rounded-full border border-ink/15 px-2.5 py-1.5 text-xs font-medium transition",
                isBusy
                  ? "opacity-60 cursor-not-allowed"
                  : "text-muted hover:border-rose-500 hover:text-rose-600 disabled:opacity-40"
              )}
            >
              <Trash2 size={13} />
              <span className="ml-1.5 hidden sm:inline">Delete</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
