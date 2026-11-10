"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowRight, Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { api } from "@/lib/api";
import type { Category, Paginated, ProductListItem } from "@/lib/types";
import { ProductCard } from "@/components/product-card";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 24;

interface ShopContentProps {
  initialProducts: ProductListItem[];
  initialCount: number;
  initialTotalPages: number;
  initialCategories: Category[];
  initialCategory: string;
  initialSearch: string;
  initialSort: string;
  initialLoaded: boolean;
}

function catalogQuery(category: string, search: string, sort: string, page: number) {
  const query = new URLSearchParams({ sort, page: String(page), page_size: String(PAGE_SIZE) });
  if (category) query.set("category", category);
  if (search.trim()) query.set("search", search.trim());
  return query.toString();
}

export function ShopContent({
  initialProducts,
  initialCount,
  initialTotalPages,
  initialCategories,
  initialCategory,
  initialSearch,
  initialSort,
  initialLoaded,
}: ShopContentProps) {
  const [products, setProducts] = useState(initialProducts);
  const [categories, setCategories] = useState(initialCategories);
  const [category, setCategory] = useState(initialCategory);
  const [search, setSearch] = useState(initialSearch);
  const [sort, setSort] = useState(initialSort);
  const [count, setCount] = useState(initialCount);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [loading, setLoading] = useState(!initialLoaded);
  const [loadingMore, setLoadingMore] = useState(false);

  const filtersChanged = useRef(false);
  const bootstrapped = useRef(initialLoaded);
  const categoriesRequested = useRef(initialCategories.length > 0);
  const requestId = useRef(0);

  const [reduceMotion, setReduceMotion] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setReduceMotion(media.matches);
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (categoriesRequested.current) return;
    categoriesRequested.current = true;
    api.get<Category[]>("/categories/").then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (search.trim()) params.set("search", search.trim());
    if (sort !== "newest") params.set("sort", sort);
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [category, search, sort]);

  useEffect(() => {
    if (!filtersChanged.current && bootstrapped.current) return;
    filtersChanged.current = false;
    bootstrapped.current = true;
    const id = ++requestId.current;
    setLoadingMore(false);
    const timer = window.setTimeout(() => {
      setLoading(true);
      api
        .get<Paginated<ProductListItem>>(`/products/?${catalogQuery(category, search, sort, 1)}`)
        .then((data) => {
          if (id !== requestId.current) return;
          setProducts(data.results);
          setCount(data.count);
          setPage(1);
          setTotalPages(data.total_pages);
        })
        .catch(() => {
          if (id !== requestId.current) return;
          setProducts([]);
          setCount(0);
          setPage(1);
          setTotalPages(0);
        })
        .finally(() => {
          if (id === requestId.current) setLoading(false);
        });
    }, 240);
    return () => window.clearTimeout(timer);
  }, [category, search, sort]);

  const markFiltersChanged = () => {
    filtersChanged.current = true;
  };

  const clearFilters = () => {
    markFiltersChanged();
    setSearch("");
    setCategory("");
  };

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || page >= totalPages) return;
    const id = ++requestId.current;
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const data = await api.get<Paginated<ProductListItem>>(
        `/products/?${catalogQuery(category, search, sort, nextPage)}`
      );
      if (id !== requestId.current) return;
      setProducts((current) => [...current, ...data.results]);
      setCount(data.count);
      setPage(data.page);
      setTotalPages(data.total_pages);
    } catch {
      // Keep the current page visible; the button can be retried.
    } finally {
      setLoadingMore(false);
    }
  }, [category, loading, loadingMore, page, search, sort, totalPages]);

  return (
    <div className="pb-12 lg:pb-16">
      <section className="shop-hero" aria-labelledby="studio-story-title">
        {reduceMotion ? (
          <Image
            src="/studio/shop-studio-poster.jpg"
            alt=""
            aria-hidden
            fill
            priority
            sizes="100vw"
            className="shop-hero-bg"
          />
        ) : (
          <>
            <Image
              src="/studio/shop-studio-poster.jpg"
              alt=""
              aria-hidden
              fill
              priority
              sizes="100vw"
              className="shop-hero-bg"
            />
            <video
              ref={videoRef}
              className="shop-hero-bg"
              src="/studio/shop-studio.mp4"
              poster="/studio/shop-studio-poster.jpg"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-hidden
              tabIndex={-1}
            />
          </>
        )}
        <div className="shop-hero-scrim" />
        <div className="shop-hero-texture" />

        <div className="container-x shop-hero-inner">
          <div className="flex items-start justify-between gap-6">
            <div className="max-w-2xl">
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-cream/70">The collection</p>
              <h1 id="studio-story-title" className="mt-3 font-display text-5xl leading-[0.98] sm:text-6xl lg:text-7xl">
                Find your canvas.
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-relaxed text-cream/80 sm:text-base">
                Premium blanks chosen for print. Pick a product, then make it entirely yours in the studio.
              </p>
              <p className="mt-4 font-display text-xl italic text-[#f0a088] sm:text-2xl">
                Made by hand. Printed for you.
              </p>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_16rem] sm:items-end">
            <div className="max-w-xl">
              <div className="grid grid-cols-3 gap-4 border-t border-cream/15 pt-5">
                <div>
                  <p className="font-display text-xl">300 DPI</p>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-cream/65">print-ready</p>
                </div>
                <div>
                  <p className="font-display text-xl">8+</p>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-cream/65">surfaces</p>
                </div>
                <div>
                  <p className="font-display text-xl">2–4 days</p>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-cream/65">turnaround</p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
                <a href="#collection" className="group inline-flex items-center gap-2 text-sm font-semibold text-cream">
                  Shop the collection
                  <ArrowRight size={15} className="transition group-hover:translate-x-1" />
                </a>
                <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-cream/70">
                  <span className="h-1.5 w-1.5 rounded-full bg-clay shadow-[0_0_12px_rgba(217,93,57,0.9)]" />
                  Inside the studio · 06s loop
                </span>
              </div>
            </div>

            <figure className="shop-hero-card">
              <Image
                src="/studio/shop-studio.jpg"
                alt="An artist hand-painting lettering onto a T-shirt in the studio"
                fill
                priority
                sizes="(min-width: 640px) 16rem, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/10 to-transparent" />
              <figcaption className="absolute inset-x-0 bottom-0 p-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-cream/70">The studio edit</p>
                <p className="mt-1 text-xs font-medium text-cream">Hand-painted in small batches</p>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      <div className="container-x mt-12 lg:mt-16">
        <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
          <aside>
            <div className="shop-filter-panel space-y-5 lg:sticky lg:top-24 lg:space-y-7">
              <div>
                <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Search</h2>
                <div className="relative">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    value={search}
                    onChange={(event) => {
                      markFiltersChanged();
                      setSearch(event.target.value);
                    }}
                    placeholder="Search products"
                    aria-label="Search products"
                    type="search"
                    className="field pl-9"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => {
                        markFiltersChanged();
                        setSearch("");
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:bg-ink/10 hover:text-ink"
                      aria-label="Clear search"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div>
                <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Category</h2>
                <div className="flex flex-wrap gap-1.5 lg:flex-col lg:items-start">
                  <button
                    type="button"
                    onClick={() => {
                      markFiltersChanged();
                      setCategory("");
                    }}
                    aria-pressed={!category}
                    className={cn(
                      "rounded-full px-3 py-2 text-left text-sm transition",
                      !category ? "bg-ink text-cream" : "text-ink/70 hover:bg-ink/5"
                    )}
                  >
                    All products
                  </button>
                  {categories.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => {
                        markFiltersChanged();
                        setCategory(item.slug);
                      }}
                      aria-pressed={category === item.slug}
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
              <div className="hidden rounded-2xl bg-olive-soft p-4 text-sm lg:block">
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

          <div id="collection" className="scroll-mt-28" aria-busy={loading}>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-4">
              <p className="text-sm text-muted" aria-live="polite">
                {loading ? "Curating…" : `${count} product${count === 1 ? "" : "s"}`}
              </p>
              <label htmlFor="shop-sort" className="flex items-center gap-2 text-xs text-muted">
                <SlidersHorizontal size={14} />
                <span className="sr-only">Sort products</span>
                <select
                  id="shop-sort"
                  value={sort}
                  onChange={(event) => {
                    markFiltersChanged();
                    setSort(event.target.value);
                  }}
                  className="rounded-lg border border-ink/15 bg-white px-3 py-2 text-xs outline-none"
                >
                  <option value="newest">Newest</option>
                  <option value="price_asc">Price: low to high</option>
                  <option value="price_desc">Price: high to low</option>
                  <option value="name">Name A–Z</option>
                </select>
              </label>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-5 sm:gap-y-10 xl:grid-cols-3" aria-hidden>
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="animate-pulse">
                    <div className="aspect-square rounded-3xl bg-sand" />
                    <div className="mt-4 h-5 w-2/3 rounded bg-sand" />
                    <div className="mt-2 h-3 w-1/2 rounded bg-sand" />
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-ink/20 px-6 py-20 text-center">
                <p className="font-display text-2xl">Nothing here yet.</p>
                <p className="mt-2 text-sm text-muted">Try a different category or clear your search.</p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-4 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-5 sm:gap-y-10 xl:grid-cols-3">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
                {page < totalPages && (
                  <div className="mt-12 flex justify-center">
                    <button
                      type="button"
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="inline-flex items-center gap-2 rounded-full border border-ink/20 px-6 py-3 text-sm font-semibold transition hover:border-ink hover:bg-ink/5 disabled:cursor-wait disabled:opacity-60"
                    >
                      {loadingMore && <Loader2 size={15} className="animate-spin" />}
                      {loadingMore ? "Loading more…" : "Show more pieces"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
