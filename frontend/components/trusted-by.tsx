"use client";

import { useEffect, useState } from "react";

const BRANDS = [
  "Kadinsky Amsterdam",
  "Buffet van Odette",
  "Twotone",
  "Filling Pieces",
  "Lala Tequila",
  "Mokumono",
  "Yusra Mardini Foundation",
  "T-Rex Sauces",
  "Adidas",
  "Anonymous",
  "El Jefe",
  "Footnote",
];

export function TrustedBy() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return (
    <section className="bg-ink py-16 lg:py-20 overflow-hidden">
      <div className="container-x relative z-10">
        <div className="flex items-center justify-between gap-4 mb-12 lg:mb-16">
          <div>
            <p className="eyebrow text-cream/60">Trusted by</p>
            <h2 className="mt-2 font-display text-3xl sm:text-4xl text-cream">
              Leading brands &amp; organizations
            </h2>
          </div>
        </div>

        <div
          className={`relative overflow-hidden group ${
            reduceMotion ? "static" : "marquee-container"
          }`}
        >
          <div
            className={`flex gap-16 lg:gap-24 animate-marquee ${
              reduceMotion ? "animation-none" : ""
            }`}
          >
            {BRANDS.map((brand) => (
              <div
                key={brand}
                className="flex items-center gap-2 px-6 py-3 rounded-full border border-white/10 bg-white/5 text-white/70 hover:text-white hover:border-white/30 transition-all text-sm font-medium uppercase tracking-wider"
              >
                {brand}
              </div>
            ))}
            {BRANDS.map((brand) => (
              <div
                key={brand + "-2"}
                className="flex items-center gap-2 px-6 py-3 rounded-full border border-white/10 bg-white/5 text-white/70 hover:text-white hover:border-white/30 transition-all text-sm font-medium uppercase tracking-wider"
              >
                {brand}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex items-center justify-center gap-x-8 gap-y-2 px-4 font-mono text-[10px] uppercase tracking-[0.24em] text-cream/70">
          <span>Print on demand</span>
          <span className="text-clay">✦</span>
          <span>Custom apparel</span>
          <span className="text-clay">✦</span>
          <span>Studio quality</span>
          <span className="text-clay">✦</span>
          <span>Worldwide shipping</span>
        </div>
      </div>
    </section>
  );
}
