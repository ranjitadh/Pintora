"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
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

const COLORS = [
  { name: "Ink Black", hex: "#211b16" },
  { name: "Cream", hex: "#fbf7ef" },
  { name: "Clay", hex: "#d95d39" },
  { name: "Navy", hex: "#062334" },
  { name: "Olive", hex: "#65714c" },
];

export function ProductShowcase() {
  const [activeProduct, setActiveProduct] = useState(0);
  const [selectedColor, setSelectedColor] = useState(COLORS[0].hex);

  return (
    <section data-testid="showcase" className="relative overflow-hidden bg-ink py-20 lg:py-32 text-cream">
      <div className="absolute -inset-1 bg-clay/10 blur-[120px] pointer-events-none" />
      <div className="absolute -inset-1/2 top-1/2 h-full w-[200%] bg-clay/10 blur-[100px] rotate-12 pointer-events-none" />

      <div className="container-x relative">
        <div className="flex flex-col items-center gap-12 lg:flex-row lg:gap-24 lg:items-start lg:justify-between">
          {/* Preview Column */}
          <div className="flex flex-col items-center gap-6 lg:items-start">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-clay/60">
              Product preview &middot; {PRODUCTS[activeProduct]?.label}
            </p>

            <div className="flex items-center gap-3 lg:flex-row lg:w-full">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-clay/60 shrink-0">Colour</span>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide lg:overflow-visible lg:w-full">
                {COLORS.map((color) => (
                  <button
                    key={color.name}
                    onClick={() => setSelectedColor(color.hex)}
                    className={cn(
                      "shrink-0 h-9 w-9 rounded-full border transition-colors duration-200",
                      selectedColor === color.hex
                        ? "border-clay ring-2 ring-clay ring-offset-2 ring-offset-ink"
                        : "border-white/10 hover:border-white/50"
                    )}
                    style={{ backgroundColor: color.hex }}
                    aria-label={color.name}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-4 lg:overflow-visible lg:w-full lg:justify-center">
              {PRODUCTS.map((product, index) => (
                <button
                  key={product.key}
                  onClick={() => setActiveProduct(index)}
                  className={cn(
                    "shrink-0 rounded-full border px-5 py-2 text-xs font-semibold uppercase tracking-wide transition duration-200",
                    activeProduct === index
                      ? "border-clay bg-clay/10 text-clay"
                      : "border-white/20 text-cream/60 hover:border-white/50 hover:bg-white/10"
                  )}
                >
                  {product.label}
                </button>
              ))}
            </div>

            <div className="relative w-full max-w-[340px]">
              <div className="relative h-[820px] w-full aspect-[3/4]">
                <BeforeAfterSlider
                  beforeSrc={BEFORE_SRC}
                  afterSrc={AFTER_SRC}
                  beforeLabel="Flat artwork"
                  afterLabel="With surface"
                  className="h-full w-full"
                />
                <p className="mt-3 text-[11px] text-muted text-center">
                  Drag the divider vertically to compare flat artwork with the finished mockup.
                </p>
              </div>
            </div>
          </div>

          {/* Content Column */}
          <div className="space-y-6 max-w-[380px]">
            <span className="inline-flex items-center gap-2 rounded-full border border-clay/30 bg-clay/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-clay">
              PRODUCT PREVIEW
            </span>
            <h2 className="font-display text-3xl sm:text-4xl leading-tight text-cream">
              Your design. <span className="text-clay italic">Part of the product.</span>
            </h2>
            <p className="text-sm leading-relaxed text-cream/80 sm:text-base">
              See how artwork looks on the product, with surface detail, light and shadow
              bringing the preview to life.
            </p>

            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-clay/10 text-clay">
                  <span className="text-[10px]">•</span>
                </div>
                <p className="text-sm leading-relaxed text-cream/90">Beyond flat artwork.</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-clay/10 text-clay">
                  <span className="text-[10px]">•</span>
                </div>
                <p className="text-sm leading-relaxed text-cream/90">A feel for the material.</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-clay/10 text-clay">
                  <span className="text-[10px]">•</span>
                </div>
                <p className="text-sm leading-relaxed text-cream/90">Explore different products.</p>
              </div>
            </div>

            <Link
              href="/shop"
              className="inline-flex items-center gap-2 rounded-full border border-clay bg-clay px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-clay-dark hover:shadow hover:shadow-clay/30"
            >
              Try the demo <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
