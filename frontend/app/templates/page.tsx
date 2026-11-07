"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { api, mediaUrl } from "@/lib/api";
import type { Template } from "@/lib/types";
import { LoadingBlock, EmptyState } from "@/components/ui";
import { cn, money } from "@/lib/utils";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Template[]>("/templates/")
      .then(setTemplates)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(templates.map((template) => template.category)))],
    [templates]
  );
  const visible = templates.filter(
    (template) =>
      (category === "All" || template.category === category) &&
      (!search.trim() || template.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="container-x py-12 lg:py-16">
      <div className="grid items-end gap-8 lg:grid-cols-[1fr_auto]">
        <div className="max-w-2xl">
          <p className="eyebrow">The template library</p>
          <h1 className="mt-2 display-title">Start with a spark.</h1>
          <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
            Artist-made starting points for every canvas. Pick one, then remix the colours, type and layout in the
            studio — it&apos;s yours from the first click.
          </p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search templates" className="field pl-9" />
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        {categories.map((item) => (
          <button
            key={item}
            onClick={() => setCategory(item)}
            className={cn(
              "rounded-full border px-4 py-2 text-xs font-semibold transition",
              category === item ? "border-ink bg-ink text-cream" : "border-ink/15 bg-white hover:border-ink"
            )}
          >
            {item}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingBlock label="Collecting inspiration…" />
      ) : visible.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            icon={<Sparkles />}
            title="No templates found"
            description="Try another category or start from a blank canvas in the shop."
            action={<Link href="/shop" className="text-sm font-semibold text-clay underline">Browse products</Link>}
          />
        </div>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((template) => (
            <div key={template.id} className="group overflow-hidden rounded-3xl bg-white shadow-card">
              <div className="relative aspect-[4/5] overflow-hidden bg-sand">
                {template.preview_url ? (
                  <img src={mediaUrl(template.preview_url)} alt={template.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                ) : (
                  <div className="flex h-full items-center justify-center text-ink/20"><Sparkles size={40} /></div>
                )}
                <span className="absolute left-4 top-4 rounded-full bg-cream/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide">
                  {template.category}
                </span>
                {template.product_slug && (
                  <Link
                    href={`/editor/${template.product_slug}?template=${template.id}`}
                    className="absolute inset-x-4 bottom-4 translate-y-2 rounded-full bg-ink py-3 text-center text-xs font-semibold text-cream opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100"
                  >
                    Customize this template
                  </Link>
                )}
              </div>
              <div className="flex items-center justify-between gap-3 p-5">
                <div>
                  <h3 className="font-display text-xl">{template.name}</h3>
                  <p className="mt-1 line-clamp-1 text-xs text-muted">{template.description}</p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-clay">
                  {Number(template.price) > 0 ? money(template.price) : "Free"}
                </span>
              </div>
              {template.product_slug && (
                <div className="border-t border-ink/5 px-5 py-3 text-[11px] text-muted">
                  Designed for {template.product_slug.replace(/-/g, " ")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
