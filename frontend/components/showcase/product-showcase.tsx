"use client";

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

const FEATURES = [
  {
    step: "01",
    title: "Beyond flat artwork.",
    text: "See the difference between a flat overlay and a preview with surface detail.",
  },
  {
    step: "02",
    title: "A feel for the material.",
    text: "Bring fabric texture, curves and shadows into the picture.",
  },
  {
    step: "03",
    title: "Explore different products.",
    text: "Explore how artwork looks on T-shirts, mugs, bags, phone cases and cards.",
  },
];

export function ProductShowcase() {
  const [activeProduct, setActiveProduct] = useState(0);
  const [selectedColor, setSelectedColor] = useState(COLORS[0].hex);

  return (
    <section data-testid="showcase" className="relative overflow-hidden bg-ink py-20 lg:py-32 text-cream">
      <div className="absolute -inset-1 bg-clay/10 blur-[120px] pointer-events-none" />
      <div className="absolute -inset-1/2 top-1/2 h-full w-[200%] bg-clay/10 blur-[100px] rotate-12 pointer-events-none" />

      <div className="container-x relative">
        {/* Section header */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-clay/70">
            Product preview
          </p>
          <h2 className="mt-4 font-display text-3xl leading-tight text-cream sm:text-4xl lg:text-5xl">
            Your design. <span className="text-clay italic">Part of the product.</span>
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-cream/70 sm:text-base">
            See how artwork looks on the product, with surface detail, light and shadow
            bringing the preview to life.
          </p>
        </div>

        {/* Product + colour controls */}
        <div className="mt-10 flex flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-clay/60">
              Colour
            </span>
            <div className="flex gap-2">
              {COLORS.map((color) => (
                <button
                  key={color.name}
                  onClick={() => setSelectedColor(color.hex)}
                  className={cn(
                    "h-8 w-8 rounded-full border transition-all duration-200",
                    selectedColor === color.hex
                      ? "border-clay ring-2 ring-clay ring-offset-2 ring-offset-ink"
                      : "border-white/15 hover:border-white/50"
                  )}
                  style={{ backgroundColor: color.hex }}
                  aria-label={color.name}
                />
              ))}
            </div>
          </div>

          <div className="flex max-w-full gap-2 overflow-x-auto scrollbar-hide px-1 pb-2">
            {PRODUCTS.map((product, index) => (
              <button
                key={product.key}
                onClick={() => setActiveProduct(index)}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition duration-200",
                  activeProduct === index
                    ? "border-clay bg-clay text-white"
                    : "border-white/15 text-cream/50 hover:border-white/40 hover:text-cream/80"
                )}
              >
                {product.label}
              </button>
            ))}
          </div>
        </div>

        {/* Centered portrait comparison slider */}
        <div className="mx-auto mt-8 w-full max-w-[400px]">
          <BeforeAfterSlider
            beforeSrc={BEFORE_SRC}
            afterSrc={AFTER_SRC}
            beforeLabel="Flat artwork"
            afterLabel="With surface"
            className="h-[560px] w-full sm:h-[620px]"
          />
          <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-wider text-cream/40">
            Drag the divider to compare
          </p>
        </div>

        {/* Numbered features like Lumise */}
        <div className="mx-auto mt-16 grid max-w-4xl gap-8 sm:grid-cols-3 sm:gap-10">
          {FEATURES.map((feature) => (
            <div key={feature.step} className="text-center sm:text-left">
              <span className="font-mono text-[11px] text-clay/70">{feature.step}</span>
              <h3 className="mt-2 font-display text-lg text-cream">{feature.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-cream/60">{feature.text}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-14 flex justify-center">
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 rounded-full bg-clay px-7 py-3 text-sm font-semibold text-white transition hover:bg-clay-dark hover:shadow-lg hover:shadow-clay/20"
          >
            Try the demo <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
