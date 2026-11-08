"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, mediaUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ProductListItem } from "@/lib/types";
import {
  ArrowRight,
  Check,
  Layers,
  PackageCheck,
  Printer,
  ShoppingBag,
  Sparkles,
  Truck,
} from "lucide-react";
import { BeforeAfterSlider } from "./before-after-slider";
import { ColorPicker } from "./color-picker";
import { ImageTint } from "./color-picker";
import { SHOWCASE_CATEGORIES, SHOWCASE_COLORS, SHOWCASE_SLIDES, ShowcaseCategory, ShowcaseSlide } from "./data";

const FEATURE_ICONS: any[] = [Check, Layers, Sparkles, ArrowRight, PackageCheck, Printer, ShoppingBag, Truck];

export function ProductShowcase() {
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [mounted, setMounted] = useState(true);
  const isInitialMount = useRef(true);
  const [selectedColor, setSelectedColor] = useState<string>(() => {
    const key = SHOWCASE_CATEGORIES[0]?.key;
    return SHOWCASE_COLORS[key]?.[0]?.hex || "";
  });

  useEffect(() => {
    let cancelled = false;
    api.get<{ results: ProductListItem[] }>("/products/?page_size=50")
      .then((data) => {
        if (cancelled) return;
        setProducts(data.results);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setMounted(false);
    const timer = setTimeout(() => setMounted(true), 250);
    return () => clearTimeout(timer);
  }, [activeSlideIndex]);

  const selectCategory = useCallback((index: number) => {
    setActiveCategoryIndex(index);
    setActiveSlideIndex(SHOWCASE_CATEGORIES[index].slideIndex);
  }, []);

  const currentCategory = SHOWCASE_CATEGORIES[activeCategoryIndex];
  const currentSlide = SHOWCASE_SLIDES[activeSlideIndex];

  useEffect(() => {
    const colors = SHOWCASE_COLORS[currentCategory.key];
    if (colors.length) setSelectedColor(colors[0].hex);
  }, [currentCategory.key]);

  const product = products.find((item) => item.slug === currentCategory.productSlug);
  const beforeSrc = product?.image_url ? mediaUrl(product.image_url) : mediaUrl(currentCategory.flatPath);
  const afterSrc = mediaUrl(currentCategory.mockupPath);

  return (
    <section data-testid="showcase" className="relative overflow-hidden bg-ink py-20 lg:py-32 text-cream">
      <div className="absolute -inset-1 bg-clay/10 blur-[120px] pointer-events-none" />
      <div className="absolute -inset-1/2 top-1/2 h-full w-[200%] bg-clay/10 blur-[100px] rotate-12 pointer-events-none" />

      <div className="container-x relative">
        <div className="grid gap-12 lg:grid-cols-[1fr_280px] lg:gap-16">
          <PreviewColumn
            currentCategory={currentCategory}
            categories={SHOWCASE_CATEGORIES}
            activeCategoryIndex={activeCategoryIndex}
            selectCategory={selectCategory}
            beforeSrc={beforeSrc}
            afterSrc={afterSrc}
            colors={SHOWCASE_COLORS[currentCategory.key]}
            selectedColor={selectedColor}
            setSelectedColor={setSelectedColor}
          />
          <ContentColumn currentSlide={currentSlide} mounted={mounted} />
          <VerticalNav
            slides={SHOWCASE_SLIDES}
            activeIndex={activeSlideIndex}
            onSelect={setActiveSlideIndex}
            className="flex gap-2 self-start"
          />
        </div>
      </div>
    </section>
  );
}

function PreviewColumn({
  currentCategory,
  categories,
  activeCategoryIndex,
  selectCategory,
  beforeSrc,
  afterSrc,
  colors,
  selectedColor,
  setSelectedColor,
}: {
  currentCategory: ShowcaseCategory;
  categories: ShowcaseCategory[];
  activeCategoryIndex: number;
  selectCategory: (index: number) => void;
  beforeSrc: string;
  afterSrc: string;
  colors: { name: string; hex: string }[];
  selectedColor: string;
  setSelectedColor: (hex: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-clay/60">
        Product preview &middot; {currentCategory.label}
      </p>

      <ColorPicker colors={colors} value={selectedColor} onChange={setSelectedColor} label="Colour" />

      <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-2">
        {categories.map((category, index) => (
          <button
            key={category.key}
            onClick={() => selectCategory(index)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition duration-200",
              activeCategoryIndex === index
                ? "border-clay bg-clay/10 text-clay"
                : "border-white/20 text-cream/60 hover:border-white/50 hover:bg-white/10"
            )}
          >
            {category.label}
          </button>
        ))}
      </div>

      <div className="relative flex-1">
        <div className="relative h-[520px] w-full">
          <BeforeAfterSlider
            beforeSrc={beforeSrc}
            afterSrc={afterSrc}
            beforeLabel="Flat artwork"
            afterLabel="With surface"
            className="h-[520px] w-full"
          />
          <ImageTint hex={selectedColor} />
        </div>
        <p className="mt-2 text-[11px] text-muted text-center">
          Drag the divider to compare flat artwork with the finished mockup.
        </p>
      </div>
    </div>
  );
}

function ContentColumn({ currentSlide, mounted }: { currentSlide: ShowcaseSlide; mounted: boolean }) {
  if (!mounted) return null;

  return (
    <div key={currentSlide.index} className="transition-opacity duration-500 space-y-6">
      <span className="inline-flex items-center gap-2 rounded-full border border-clay/30 bg-clay/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-clay">
        <Sparkles size={12} /> {currentSlide.badge}
      </span>
      <h2 className="font-display text-3xl sm:text-4xl leading-tight">
        {currentSlide.heading.text}{" "}
        <span className="text-clay italic">{currentSlide.heading.highlight}</span>
      </h2>
      <p className="text-sm leading-relaxed text-cream/80 sm:text-base">{currentSlide.description}</p>

      <div className="mt-4 space-y-3">
        {currentSlide.features.map((feature, index) => {
          const Icon = FEATURE_ICONS[index % FEATURE_ICONS.length];
          return (
            <div key={feature} className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-clay/10 text-clay">
                <Icon size={16} />
              </div>
              <p className="text-sm leading-relaxed text-cream/90">{feature}</p>
            </div>
          );
        })}
      </div>

      <Link
        href={currentSlide.ctaHref}
        className="inline-flex items-center gap-2 rounded-full border border-clay bg-clay px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-clay-dark hover:shadow hover:shadow-clay/30"
      >
        {currentSlide.ctaLabel} <ArrowRight size={16} />
      </Link>
    </div>
  );
}

function VerticalNav({
  slides,
  activeIndex,
  onSelect,
  className,
}: {
  slides: ShowcaseSlide[];
  activeIndex: number;
  onSelect: (index: number) => void;
  className?: string;
}) {
  return (
    <div
      className={cn("flex gap-2 self-start", className)}
      role="navigation"
      aria-label="Showcase slides"
    >
      {slides.map((slide) => (
        <button
          key={slide.index}
          onClick={() => onSelect(slide.index)}
          className={cn(
            "relative h-2.5 w-2.5 rounded-full transition duration-300 focus:outline-none",
            activeIndex === slide.index
              ? "bg-clay shadow-[0_0_0_4px_rgba(217,93,57,0.35)]"
              : "bg-white/20 hover:bg-white/40"
          )}
          aria-label={`Go to slide ${slide.index + 1}`}
          aria-pressed={activeIndex === slide.index}
        />
      ))}
    </div>
  );
}