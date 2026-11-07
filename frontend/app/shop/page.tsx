"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";
import { api } from "@/lib/api";
import type { Category, Paginated, ProductListItem } from "@/lib/types";
import { ProductCard } from "@/components/product-card";
import { LoadingBlock } from "@/components/ui";
import { cn } from "@/lib/utils";

function ShopContent() {
  const params = useSearchParams();
  const initialCategory = params.get("category") || "";
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState(initialCategory);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Category[]>("/categories/").then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      const query = new URLSearchParams({ sort });
      if (category) query.set("category", category);
      if (search.trim()) query.set("search", search.trim());
      api
        .get<Paginated<ProductListItem>>(`/products/?${query}`)
        .then((data) => {
          setProducts(data.results);
          setCount(data.count);
        })
        .catch(() => {
          setProducts([]);
          setCount(0);
        })
        .finally(() => setLoading(false));
    }, 220);
    return () => clearTimeout(timer);
  }, [category, search, sort]);

  return (
    <div className="container-x py-12 lg:py-16">
      <div className="max-w-2xl">
        <p className="eyebrow">The collection</p>
        <h1 className="mt-2 display-title">Find your canvas.</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
          Premium blanks chosen for print. Pick a product, then make it entirely yours in the studio.
        </p>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[220px_1fr]">
        <aside>
          <div className="sticky top-24 space-y-7">
            <div>
              <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Search</h2>
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search products"
                  className="field pl-9"
                />
              </div>
            </div>
            <div>
              <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Category</h2>
              <div className="flex flex-wrap gap-1.5 lg:flex-col lg:items-start">
                <button
                  onClick={() => setCategory("")}
                  className={cn(
                    "rounded-full px-3 py-2 text-left text-sm transition",
                    !category ? "bg-ink text-cream" : "text-ink/70 hover:bg-ink/5"
                  )}
                >
                  All products <span className="ml-1 text-[10px] opacity-60">{count}</span>
                </button>
                {categories.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setCategory(item.slug)}
                    className={cn(
                      "rounded-full px-3 py-2 text-left text-sm transition",
                      category === item.slug ? "bg-ink text-cream" : "text-ink/70 hover:bg-ink/5"
                    )}
                  >
                    {item.name} <span className="ml-1 text-[10px] opacity-60">{item.product_count}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-2xl bg-olive-soft p-4 text-sm">
              <p className="font-semibold text-olive">Not sure where to start?</p>
              <p className="mt-1 text-xs leading-relaxed text-olive/80">
                Browse our curated templates and customize one in a couple of clicks.
              </p>
              <a href="/templates" className="mt-3 inline-block text-xs font-semibold text-olive underline">
                Explore templates
              </a>
            </div>
          </div>
        </aside>

        <div>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-4">
            <p className="text-sm text-muted">
              {loading ? "Curating…" : `${count} product${count === 1 ? "" : "s"}`}
            </p>
            <label className="flex items-center gap-2 text-xs text-muted">
              <SlidersHorizontal size={14} />
              <select value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-lg border border-ink/15 bg-white px-3 py-2 text-xs outline-none">
                <option value="newest">Newest</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
                <option value="name">Name A–Z</option>
              </select>
            </label>
          </div>

          {loading ? (
            <LoadingBlock label="Loading the collection…" />
          ) : products.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-ink/20 px-6 py-20 text-center">
              <p className="font-display text-2xl">Nothing here yet.</p>
              <p className="mt-2 text-sm text-muted">Try a different category or clear your search.</p>
              <button
                onClick={() => {
                  setSearch("");
                  setCategory("");
                }}
                className="mt-4 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid gap-x-5 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <ShopContent />
    </Suspense>
  );
}
