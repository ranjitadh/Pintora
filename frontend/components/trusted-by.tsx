"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Brand = {
  name: string;
  src: string;
};

const BRANDS: Brand[] = [
  { name: "Kadinsky Amsterdam", src: "https://merchpress.nl/assets/logo-kadinsky-DUnm1RcX.png" },
  { name: "Buffet van Odette", src: "https://merchpress.nl/assets/logo-buffet-van-odette-4fZOLRV0.png" },
  { name: "Twotone", src: "https://merchpress.nl/assets/logo-twotone-CzvbzktM.png" },
  { name: "Filling Pieces", src: "https://merchpress.nl/assets/logo-filling-pieces-DPmyNQ_N.png" },
  { name: "Lala Tequila", src: "https://merchpress.nl/assets/logo-lala-tequila-qpA2nK8G.jpg" },
  { name: "Mokumono", src: "https://merchpress.nl/assets/logo-mokumono-DcEPI53v.png" },
  { name: "Yusra Mardini Foundation", src: "https://merchpress.nl/assets/logo-yusra-mardini-BLJUUmSW.png" },
  { name: "T-Rex Sauces", src: "https://merchpress.nl/assets/logo-trex-sauces-D_R171yL.png" },
  { name: "Adidas", src: "https://merchpress.nl/assets/logo-adidas-DrF5LHIK.png" },
  { name: "Anonymous", src: "https://merchpress.nl/assets/logo-anonymous-BRM_iyTm.avif" },
  { name: "El Jefe", src: "https://merchpress.nl/assets/logo-el-jefe-BCLjOxeb.png" },
  { name: "Footnote", src: "https://merchpress.nl/assets/logo-footnote-C1Ru6dzQ.png" },
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
                key={brand.name}
                className="flex items-center justify-center px-8 py-4 rounded-full border border-white/10 bg-white/5"
              >
                <Image
                  src={brand.src}
                  alt={brand.name}
                  width={120}
                  height={40}
                  className="h-10 w-auto object-contain grayscale hover:grayscale-0 transition-all duration-300"
                  priority={false}
                />
              </div>
            ))}
            {BRANDS.map((brand) => (
              <div
                key={brand.name + "-2"}
                className="flex items-center justify-center px-8 py-4 rounded-full border border-white/10 bg-white/5"
              >
                <Image
                  src={brand.src}
                  alt={brand.name}
                  width={120}
                  height={40}
                  className="h-10 w-auto object-contain grayscale hover:grayscale-0 transition-all duration-300"
                  priority={false}
                />
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
