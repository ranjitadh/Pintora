"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, LayoutGrid, Waves } from "lucide-react";
import { useState } from "react";
import { BeforeAfterSlider } from "./before-after-slider";
import { cn } from "@/lib/utils";

const BEFORE_SRC = "/studio/img.png";
const AFTER_SRC = "/studio/real.png";

const PRODUCTS = [
  { key: "tshirt", label: "T-shirt" },
  { key: "hoodie", label: "Hoodie" },
  { key: "mug", label: "Mug" },
  { key: "bag", label: "Bag" },
  { key: "tote", label: "Tote" },
  { key: "phone-case", label: "Phone case" },
  { key: "poster", label: "Poster" },
  { key: "card", label: "Card" },
  { key: "sticker", label: "Sticker" },
  { key: "cap", label: "Cap" },
  { key: "tank-top", label: "Tank top" },
  { key: "pillow", label: "Pillow" },
  { key: "apron", label: "Apron" },
  { key: "blanket", label: "Blanket" },
  { key: "phone-grip", label: "Phone grip" },
  { key: "coaster", label: "Coaster" },
  { key: "keychain", label: "Keychain" },
  { key: "tumbler", label: "Tumbler" },
  { key: "jacket", label: "Jacket" },
  { key: "shorts", label: "Shorts" },
];

const FEATURES = [
  {
    icon: BookOpen,
    title: "Beyond flat artwork.",
    text: "See the difference between a flat overlay and a preview with surface detail.",
  },
  {
    icon: Waves,
    title: "A feel for the material.",
    text: "Bring fabric texture, curves and shadows into the picture.",
  },
  {
    icon: LayoutGrid,
    title: "Explore different products.",
    text: "Explore how artwork looks on T-shirts, mugs, bags, phone cases and cards.",
  },
];

export function ProductShowcase() {
  const [activeProduct, setActiveProduct] = useState(0);

  return (
    <section data-testid="showcase" className="relative overflow-hidden bg-ink py-20 lg:py-28 text-cream">
      <div className="absolute -inset-1 bg-clay/10 blur-[120px] pointer-events-none" />
      <div className="absolute -inset-1/2 top-1/2 h-full w-[200%] bg-clay/10 blur-[100px] rotate-12 pointer-events-none" />

      <div className="container-x relative">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-16">
          {/* Comparison card */}
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] shadow-[0_30px_80px_-40px_rgba(0,0,0,0.8)]">
            {/* Card header */}
            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-3.5">
              <span className="flex shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-cream/60">
                <span className="h-1.5 w-1.5 rounded-full bg-clay" />
                A closer look
              </span>

              <div className="flex min-w-0 items-center gap-1 overflow-x-auto scrollbar-hide">
                {PRODUCTS.map((product, index) => (
                  <button
                    key={product.key}
                    onClick={() => setActiveProduct(index)}
                    className={cn(
                      "shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition duration-200",
                      activeProduct === index
                        ? "border-clay bg-clay/15 text-clay"
                        : "border-transparent text-cream/50 hover:bg-white/5 hover:text-cream/80"
                    )}
                  >
                    {product.label}
                  </button>
                ))}
              </div>

              <span className="hidden shrink-0 font-mono text-[10px] tracking-wide text-cream/35 xl:block">
                Same design. A different feel.
              </span>
            </div>

            {/* Comparison area */}
            <div className="relative aspect-[0.92] w-full">
              <BeforeAfterSlider
                beforeSrc={BEFORE_SRC}
                afterSrc={AFTER_SRC}
                beforeLabel="Flat artwork"
                afterLabel="With surface"
                className="h-full w-full"
              />
            </div>
          </div>

          {/* Content */}
          <div className="max-w-md lg:ml-auto">
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-cream/50">
              <span className="h-1.5 w-1.5 rounded-full bg-clay" />
              Product preview
            </p>

            <h2 className="mt-5 font-display text-4xl leading-[1.08] text-cream sm:text-5xl">
              Your design.
              <br />
              <span className="text-clay italic">Part of the product.</span>
            </h2>

            <p className="mt-5 text-sm leading-relaxed text-cream/60 sm:text-base">
              See how artwork looks on the product, with surface detail, light and shadow
              bringing the preview to life.
            </p>

            <ul className="mt-8 space-y-5">
              {FEATURES.map((feature) => (
                <li key={feature.title} className="flex items-start gap-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-cream/70">
                    <feature.icon size={16} strokeWidth={1.75} />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-cream">{feature.title}</h3>
                    <p className="mt-0.5 text-xs leading-relaxed text-cream/50">{feature.text}</p>
                  </div>
                </li>
              ))}
            </ul>

            <Link
              href="/shop"
              className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.03] px-6 py-2.5 text-sm font-semibold text-cream transition hover:border-white/40 hover:bg-white/10"
            >
              Try the demo <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
