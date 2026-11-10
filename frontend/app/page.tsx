"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  Layers,
  PackageCheck,
  PenTool,
  Printer,
  Truck,
  Upload,
} from "lucide-react";
import { api, mediaUrl } from "@/lib/api";
import type { Category, Paginated, ProductListItem, Template } from "@/lib/types";
import { money } from "@/lib/utils";
import { ProductCard } from "@/components/product-card";
import { LinkButton } from "@/components/ui";
import { ProductShowcase } from "@/components/showcase/product-showcase";

export default function HomePage() {
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

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
    Promise.all([
      api.get<Paginated<ProductListItem>>("/products/?featured=1&page_size=4"),
      api.get<Category[]>("/categories/"),
      api.get<Template[]>("/templates/"),
    ])
      .then(([productData, categoryData, templateData]) => {
        setProducts(productData.results);
        setCategories(categoryData);
        setTemplates(templateData.slice(0, 4));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  return (
    <div>
      <section className="home-hero" aria-labelledby="home-story-title">
        {reduceMotion ? (
          <Image
            src="/studio/shop-studio-poster.jpg"
            alt=""
            aria-hidden
            fill
            priority
            sizes="100vw"
            className="home-hero-bg"
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
              className="home-hero-bg"
            />
            <video
              className="home-hero-bg"
              src="/studio/home-studio.mp4"
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
        <div className="home-hero-scrim" />
        <div className="home-hero-texture" />

        <div className="container-x home-hero-inner">
          <div className="flex flex-col lg:flex-row items-start lg:justify-between gap-6 lg:items-end">
            <div className="max-w-2xl">
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-cream/70">The studio</p>
              <h1 id="home-story-title" className="mt-3 font-display text-5xl leading-[0.98] sm:text-6xl lg:text-7xl">
                Wear your
                <span className="block italic text-[#f0a088] sm:text-2xl">imagination.</span>
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-relaxed text-cream/80 sm:text-base">
                Bring your ideas to life on premium blanks. Design in the browser with real print dimensions, see every detail, and we’ll handle the ink.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-2">
                <LinkButton href="/shop" size="sm" variant="outlineLight">
                  Shop design <ArrowRight size={14} />
                </LinkButton>
                <LinkButton href="/templates" size="sm" variant="outlineLight">
                  Browse templates <ArrowRight size={14} />
                </LinkButton>
              </div>
            </div>
            <div className="mt-8 lg:mt-0 grid gap-4 border-t border-cream/15 pt-6 lg:border-t-0 lg:pt-0">
              {[
                { value: "300 DPI", label: "production files" },
                { value: "8+", label: "print surfaces" },
                { value: "2–4 days", label: "studio turnaround" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="font-display text-xl text-cream">{item.value}</div>
                  <div className="text-[11px] uppercase tracking-wide text-cream/60">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

        <ProductShowcase />

        <div className="overflow-hidden border-y border-ink/10 bg-ink py-3 text-cream">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 px-4 font-mono text-[10px] uppercase tracking-[0.24em] text-cream/70">
            <span>Tees</span><span className="text-clay">✦</span>
            <span>Hoodies</span><span className="text-clay">✦</span>
            <span>Mugs</span><span className="text-clay">✦</span>
            <span>Totes</span><span className="text-clay">✦</span>
            <span>Phone cases</span><span className="text-clay">✦</span>
            <span>Posters</span>
          </div>
        </div>

        <section className="container-x py-16 lg:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">The collection</p>
              <h2 className="mt-2 font-display text-3xl sm:text-4xl">Pick your canvas.</h2>
            </div>
            <Link href="/shop" className="link-underline text-sm font-semibold">
              Shop all products <ArrowRight className="ml-1 inline" size={14} />
            </Link>
          </div>

          <div className="mt-8 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
            {loaded && products.length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-ink/20 p-10 text-center text-sm text-muted">
                Products are loading from the studio. Make sure the backend and demo data are running.
              </div>
            )}
          </div>
        </section>

        <section className="bg-sand/50 py-16 lg:py-24" id="how-it-works">
          <div className="container-x">
            <div className="max-w-2xl">
              <p className="eyebrow">How it works</p>
              <h2 className="mt-2 font-display text-3xl sm:text-4xl">A design studio that ships.</h2>
              <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
                No design software, no separations, no guesswork. Our editor speaks print — millimetres, DPI, printable areas — while you just make something you love.
              </p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {[
                {
                  icon: PenTool,
                  step: "01",
                  title: "Design in the browser",
                  text: "Add text, upload art, layer clipart and switch colours across every print stage with live pricing.",
                },
                {
                  icon: Printer,
                  step: "02",
                  title: "We render it for real",
                  text: "Your canvas becomes a 300 DPI production file with the exact print area, bleed and safe zone.",
                },
                {
                  icon: Truck,
                  step: "03",
                  title: "Printed & on its way",
                  text: "Our studio prints, checks and packs your piece. You get tracking from press to doorstep.",
                },
              ].map((item) => (
                <div key={item.step} className="card relative p-7">
                  <span className="absolute right-6 top-6 font-mono text-xs text-ink/25">{item.step}</span>
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-clay/10 text-clay">
                    <item.icon size={20} />
                  </div>
                  <h3 className="mt-5 font-display text-xl">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="container-x py-16 lg:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="eyebrow">Built for makers</p>
              <h2 className="mt-2 font-display text-3xl sm:text-4xl">Everything a print shop needs. Nothing it doesn&apos;t.</h2>
              <div className="mt-7 space-y-5">
                {[
                  { icon: Layers, title: "Multi-stage designs", text: "Front, back, sleeves or wrap-around — each surface is its own canvas." },
                  { icon: Check, title: "Server-verified pricing", text: "Pricing rules, quantity discounts and variant deltas are always calculated by the studio." },
                  { icon: Upload, title: "Real asset pipeline", text: "PNG, JPG and sanitized SVG uploads with size, dimension and format checks." },
                  { icon: PackageCheck, title: "Production-ready exports", text: "PNG, SVG and PDF at print DPI, with warnings for anything the renderer skips." },
                ].map((item) => (
                  <div key={item.title} className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-olive-soft text-olive">
                      <item.icon size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">{item.title}</h3>
                      <p className="mt-1 text-sm text-muted">{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8">
                <LinkButton href="/shop" variant="secondary">
                  Try the editor <ArrowRight size={15} />
                </LinkButton>
              </div>
            </div>

            <div className="relative">
              <div className="rounded-[2rem] bg-ink p-6 text-cream shadow-card sm:p-8">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-cream/60">Printora studio</span>
                  <span className="flex items-center gap-1.5 text-[10px] text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Saved
                  </span>
                </div>
                <div className="editor-grid-bg mt-5 flex aspect-square items-center justify-center rounded-xl bg-cream/95 p-8">
                  <div className="relative w-full max-w-[260px]">
                    <img src={products[0] ? mediaUrl(products[0].image_url) : ""} alt="" className="w-full opacity-90" />
                    <div className="absolute inset-x-1/4 top-1/4 flex h-1/2 items-center justify-center rounded border-2 border-dashed border-clay/60 bg-clay/5">
                      <span className="rounded-full bg-clay px-3 py-1 text-[9px] font-bold uppercase tracking-wide text-white">
                        Live print area
                      </span>
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                    {["300 DPI", "CMYK-ready", "6 stages"].map((item) => (
                      <div key={item} className="rounded-xl bg-white/5 py-3 text-[10px] text-cream/80">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="absolute -right-3 -top-4 rounded-full bg-clay px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg">
                  No design skills needed
                </div>
              </div>
            </div>
          </div>
        </section>
    </div>
  );
}