"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Search, X } from "lucide-react";
import { api, mediaUrl } from "@/lib/api";
import type { Template } from "@/lib/types";
import { LinkButton } from "@/components/ui";
import { cn, money, titleCase } from "@/lib/utils";

const ALL = "All";

interface TemplatesContentProps {
  initialTemplates: Template[];
  initialCategory: string;
  initialSearch: string;
  initialLoaded: boolean;
}

function normalizeCategory(value: string, templates: Template[]) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === ALL.toLowerCase()) return ALL;
  return (
    templates.find((template) => template.category.toLowerCase() === trimmed.toLowerCase())?.category ||
    trimmed
  );
}

function editorHref(template: Template) {
  return template.product_slug
    ? `/editor/${template.product_slug}?template=${template.id}`
    : "/shop";
}

function productLabel(template: Template) {
  if (template.product_name) return template.product_name;
  if (template.product_slug) return titleCase(template.product_slug);
  return "Pick a canvas";
}

function templatePrice(template: Template) {
  return Number(template.price) > 0 ? money(template.price) : "Free";
}

function TemplateCard({ template }: { template: Template }) {
  return (
    <Link
      href={editorHref(template)}
      data-template-card
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 sm:rounded-3xl"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-sand p-2.5 sm:p-3">
        {template.preview_url ? (
          <img
            src={mediaUrl(template.preview_url)}
            alt={`${template.name} template preview for ${productLabel(template)}`}
            width={720}
            height={900}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain transition duration-500 motion-safe:group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-ink/20">
            <span className="font-display text-lg">{template.name}</span>
          </div>
        )}
        <span className="absolute left-2.5 top-2.5 rounded-full bg-cream/90 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-ink sm:left-3 sm:top-3 sm:px-2.5 sm:text-[10px]">
          {template.category}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-3 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-base leading-tight transition group-hover:text-clay sm:text-xl">
            {template.name}
          </h3>
          <span className="shrink-0 text-[10px] font-semibold text-clay sm:text-xs">
            {templatePrice(template)}
          </span>
        </div>
        <p className="mt-1.5 hidden line-clamp-2 text-xs leading-relaxed text-muted sm:block">
          {template.description}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-ink/10 pt-2.5 sm:pt-3">
          <span className="hidden truncate text-[10px] uppercase tracking-[0.12em] text-muted sm:inline">
            {productLabel(template)}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-clay sm:text-xs">
            Use
            <ArrowUpRight
              size={12}
              className="transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            />
          </span>
        </div>
      </div>
    </Link>
  );
}

export function TemplatesContent({
  initialTemplates,
  initialCategory,
  initialSearch,
  initialLoaded,
}: TemplatesContentProps) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [category, setCategory] = useState(() =>
    normalizeCategory(initialCategory, initialTemplates)
  );
  const [loading, setLoading] = useState(!initialLoaded);
  const [searching, setSearching] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const requested = useRef(initialLoaded);
  const searchTimeout = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    setLoading(true);
    api
      .get<Template[]>("/templates/")
      .then((data) => {
        setTemplates(data);
        setLoadError(false);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  // Debounce search input so we don't re-filter on every keystroke.
  useEffect(() => {
    if (searchTimeout.current) window.clearTimeout(searchTimeout.current);
    setSearching(true);
    searchTimeout.current = window.setTimeout(() => {
      setDebouncedSearch(search);
      setSearching(false);
    }, 300);
    return () => {
      if (searchTimeout.current) window.clearTimeout(searchTimeout.current);
    };
  }, [search]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (category && category !== ALL) params.set("category", category);
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [category, debouncedSearch]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const template of templates) {
      counts[template.category] = (counts[template.category] || 0) + 1;
    }
    return counts;
  }, [templates]);

  const categories = useMemo(
    () => Object.keys(categoryCounts).sort((a, b) => a.localeCompare(b)),
    [categoryCounts]
  );

  const activeCategory =
    category.toLowerCase() === ALL.toLowerCase()
      ? ALL
      : categories.find((item) => item.toLowerCase() === category.toLowerCase()) || category;

  const visible = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    return templates.filter((template) => {
      const matchesCategory =
        category.toLowerCase() === ALL.toLowerCase() ||
        template.category.toLowerCase() === category.toLowerCase();
      if (!matchesCategory) return false;
      if (!query) return true;
      return [
        template.name,
        template.category,
        template.description,
        template.product_name || "",
        template.product_slug || "",
        ...(template.tags || []),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [category, debouncedSearch, templates]);

  const filtersActive = Boolean(search.trim()) || category.toLowerCase() !== ALL.toLowerCase();
  const canvasCount = useMemo(
    () => new Set(templates.map((template) => template.product_slug).filter(Boolean)).size,
    [templates]
  );
  const spotlight = useMemo(
    () =>
      templates.find((template) => template.slug === "mono-grid" && template.product_slug) ||
      templates.find((template) => template.product_slug) ||
      null,
    [templates]
  );

  const clearFilters = () => {
    setSearch("");
    setCategory(ALL);
  };

  const resultText = loading
    ? "Curating…"
    : searching
      ? "Searching…"
      : `${visible.length} template${visible.length === 1 ? "" : "s"}`;

  return (
    <div className="pb-12 lg:pb-16">
      <section
        className="relative overflow-hidden border-b border-ink/10 bg-sand/30"
        aria-labelledby="templates-title"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 top-8 h-64 w-64 rounded-full bg-clay/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-olive/10 blur-3xl"
        />

        <div className="container-x relative py-12 lg:py-16">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center">
            <div>
              <p className="eyebrow">The template library</p>
              <h1 id="templates-title" className="mt-3 display-title">
                Start with a <span className="italic text-clay">spark.</span>
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
                Artist-made starting points for every canvas. Pick a layout, then remix the
                colours, type and layout in the studio — it&apos;s yours from the first click.
              </p>

              <div className="mt-7 max-w-md">
                <label htmlFor="template-search" className="sr-only">
                  Search templates
                </label>
                <div className="relative">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
                  />
                  <input
                    id="template-search"
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by name, style or canvas"
                    className="field pl-10 pr-10"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted transition hover:bg-ink/10 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50"
                      aria-label="Clear template search"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-7 grid max-w-md grid-cols-3 gap-4 border-t border-ink/10 pt-5">
                <div>
                  <p className="font-display text-xl">{loading && !templates.length ? "—" : templates.length}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted">
                    layouts
                  </p>
                </div>
                <div>
                  <p className="font-display text-xl">{loading && !templates.length ? "—" : canvasCount}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted">
                    canvases
                  </p>
                </div>
                <div>
                  <p className="font-display text-xl">Free</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted">
                    to customize
                  </p>
                </div>
              </div>
            </div>

            {spotlight && (
              <div className="relative hidden lg:block">
                <div
                  aria-hidden
                  className="absolute inset-x-8 bottom-2 top-8 -rotate-3 rounded-[2rem] bg-olive/15"
                />
                <div
                  aria-hidden
                  className="absolute inset-x-4 bottom-5 top-4 rotate-2 rounded-[2rem] bg-clay/10"
                />
                <Link
                  href={editorHref(spotlight)}
                  className="group relative block overflow-hidden rounded-[2rem] border border-ink/10 bg-white p-3 shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50"
                >
                  <div className="relative aspect-[5/6] overflow-hidden rounded-[1.5rem] bg-sand">
                    {spotlight.preview_url ? (
                      <img
                        src={mediaUrl(spotlight.preview_url)}
                        alt={`${spotlight.name} template preview for ${productLabel(spotlight)}`}
                        width={720}
                        height={900}
                        loading="eager"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-ink/20">
                      </div>
                    )}
                    <span className="absolute left-3 top-3 rounded-full bg-cream/90 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-ink">
                      Featured layout
                    </span>
                  </div>
                  <div className="flex items-end justify-between gap-4 px-2 pb-1 pt-4">
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
                        Spotlight
                      </p>
                      <p className="mt-1 font-display text-2xl leading-tight transition group-hover:text-clay">
                        {spotlight.name}
                      </p>
                      <p className="mt-1 text-xs text-muted">{productLabel(spotlight)}</p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-clay">
                      Open <ArrowUpRight size={14} />
                    </span>
                  </div>
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      <section
        id="library"
        className="container-x mt-10 scroll-mt-24 lg:mt-12"
        aria-labelledby="library-title"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Browse the library</p>
            <h2 id="library-title" className="mt-2 font-display text-2xl sm:text-3xl">
              Find your starting point.
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted" aria-live="polite">
              {resultText}
            </p>
            {filtersActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-semibold text-clay underline underline-offset-4 transition hover:text-clay-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        <div
          className="mt-5 flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Filter templates by category"
        >
          <button
            type="button"
            onClick={() => setCategory(ALL)}
            aria-pressed={activeCategory === ALL}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50",
              activeCategory === ALL
                ? "border-ink bg-ink text-cream"
                : "border-ink/15 bg-white text-ink/70 hover:border-ink hover:text-ink"
            )}
          >
            All <span className="text-[10px] opacity-60">{templates.length}</span>
          </button>
          {categories.map((item) => {
            const active = activeCategory === item;
            return (
              <button
                type="button"
                key={item}
                onClick={() => setCategory(item)}
                aria-pressed={active}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50",
                  active
                    ? "border-ink bg-ink text-cream"
                    : "border-ink/15 bg-white text-ink/70 hover:border-ink hover:text-ink"
                )}
              >
                {item} <span className="text-[10px] opacity-60">{categoryCounts[item]}</span>
              </button>
            );
          })}
        </div>

        <div id="template-grid" className="mt-6" aria-busy={loading}>
          {loading ? (
            <div
              className="grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-5 lg:grid-cols-3"
              aria-hidden
            >
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="animate-pulse overflow-hidden rounded-2xl bg-white shadow-card sm:rounded-3xl">
                  <div className="aspect-[4/5] bg-sand" />
                  <div className="space-y-2 p-3 sm:p-5">
                    <div className="h-5 w-2/3 rounded bg-sand" />
                    <div className="h-3 w-full rounded bg-sand" />
                    <div className="h-3 w-1/3 rounded bg-sand" />
                  </div>
                </div>
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-ink/20 bg-white px-5 py-16 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-clay/10 text-clay">
              </span>
              <h3 className="mt-4 font-display text-2xl">
                {loadError
                  ? "The library is taking a moment."
                  : filtersActive
                    ? "No templates match."
                    : "No templates yet."}
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted">
                {loadError
                  ? "We couldn't load the templates. Refresh the page or browse the shop to start from a blank canvas."
                  : filtersActive
                    ? "Try a different category or search, or start from a blank canvas in the shop."
                    : "Our artists are preparing new starting points. In the meantime, start from a blank canvas in the shop."}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {filtersActive && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="rounded-full border border-ink/20 px-5 py-2.5 text-sm font-semibold transition hover:border-ink hover:bg-ink/5"
                  >
                    Clear filters
                  </button>
                )}
                <Link
                  href="/shop"
                  className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream transition hover:bg-clay"
                >
                  Browse products
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-5 lg:grid-cols-3">
              {visible.map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          )}
        </div>

        <div className="mt-14 lg:mt-20">
          <div className="grid gap-5 rounded-[2rem] border border-ink/10 bg-white p-6 shadow-card sm:grid-cols-3 sm:p-8">
            {[
              {
                title: "Choose a layout",
                description: "Start with a composition made by an artist, not a blank page.",
              },
              {
                title: "Make it yours",
                description: "Swap colours, type, artwork and placement in the live studio.",
              },
              {
                title: "We print & ship",
                description: "Your finished design goes to production in 2–4 days.",
              },
            ].map((step, index) => (
              <div key={step.title} className="border-t border-ink/15 pt-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-clay">
                  0{index + 1}
                </p>
                <h3 className="mt-2 font-display text-xl">{step.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">{step.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col items-start justify-between gap-5 rounded-[2rem] bg-ink px-6 py-8 text-cream sm:flex-row sm:items-center sm:px-8">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cream/60">
                Nothing quite fits?
              </p>
              <h2 className="mt-2 font-display text-3xl">Start from a blank canvas.</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-cream/70">
                Pick any product in the shop and build your layout from scratch in the studio.
              </p>
            </div>
            <LinkButton href="/shop" variant="cream" size="sm">
              Browse products <ArrowRight size={14} />
            </LinkButton>
          </div>
        </div>
      </section>
    </div>
  );
}
