"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronDown, Palette, Ruler } from "lucide-react";
import { api, mediaUrl } from "@/lib/api";
import type { Product } from "@/lib/types";
import { cn, money } from "@/lib/utils";
import { FreeShippingNote } from "@/components/free-shipping-note";
import { LoadingBlock, LinkButton } from "@/components/ui";

export function ProductDetail({ slug, initialProduct }: { slug: string; initialProduct: Product | null }) {
  const [product, setProduct] = useState<Product | null>(initialProduct);
  const [loading, setLoading] = useState(!initialProduct);
  const [error, setError] = useState("");
  const [activeImage, setActiveImage] = useState(initialProduct?.image_url || initialProduct?.images[0]?.url || "");
  const [activeStage, setActiveStage] = useState(initialProduct?.stages[0]?.id || "");
  const [variantId, setVariantId] = useState(initialProduct?.variants.find((variant) => variant.is_active)?.id || "");
  const [methodId, setMethodId] = useState(
    initialProduct?.printing_methods.find((method) => method.is_default)?.printing_method.id ||
      initialProduct?.printing_methods[0]?.printing_method.id ||
      ""
  );

  useEffect(() => {
    if (initialProduct) return;
    let alive = true;
    api
      .get<Product>(`/products/${slug}/`)
      .then((data) => {
        if (!alive) return;
        setProduct(data);
        setActiveImage(data.image_url || data.images[0]?.url || "");
        const firstStage = data.stages[0];
        setActiveStage(firstStage?.id || "");
        setVariantId(data.variants.find((variant) => variant.is_active)?.id || "");
        setMethodId(data.printing_methods.find((method) => method.is_default)?.printing_method.id || data.printing_methods[0]?.printing_method.id || "");
      })
      .catch(() => {
        if (alive) setError("We couldn't load this product.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [slug, initialProduct]);

  const colors = useMemo(() => {
    if (!product) return [];
    const map = new Map<string, string>();
    product.variants.filter((variant) => variant.is_active).forEach((variant) => {
      if (variant.color_name && !map.has(variant.color_name)) map.set(variant.color_name, variant.color_hex);
    });
    return Array.from(map.entries());
  }, [product]);

  const [color, setColor] = useState("");
  useEffect(() => {
    if (colors.length && !color) setColor(colors[0][0]);
  }, [colors, color]);

  const sizes = useMemo(() => {
    if (!product) return [];
    return Array.from(new Set(product.variants.filter((variant) => variant.is_active && (!color || variant.color_name === color)).map((variant) => variant.size))).filter(Boolean);
  }, [product, color]);

  const [size, setSize] = useState("");
  useEffect(() => {
    if (sizes.length && !sizes.includes(size)) setSize(sizes[0]);
  }, [sizes, size]);

  useEffect(() => {
    if (!product) return;
    const match = product.variants.find(
      (variant) => variant.is_active && (!color || variant.color_name === color) && (!size || variant.size === size)
    );
    if (match) setVariantId(match.id);
  }, [product, color, size]);

  const selectedVariant = product?.variants.find((variant) => variant.id === variantId);
  const price = Number(product?.base_price || 0) + Number(selectedVariant?.price_delta || 0);
  const stage = product?.stages.find((item) => item.id === activeStage);
  const variantQuery = variantId ? `?variant=${variantId}${methodId ? `&method=${methodId}` : ""}` : methodId ? `?method=${methodId}` : "";

  if (loading) return <LoadingBlock label="Unfolding the product…" />;
  if (error || !product) {
    return (
      <div className="container-x py-20 text-center">
        <p className="font-display text-3xl">{error || "Product not found."}</p>
        <LinkButton href="/shop" className="mt-6" variant="secondary">Back to shop</LinkButton>
      </div>
    );
  }

  const gallery = [product.image_url, ...product.images.map((image) => image.url)].filter(Boolean) as string[];

  return (
    <div className="container-x py-8 lg:py-12">
      <Link href="/shop" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink">
        <ArrowLeft size={14} /> Back to collection
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-14">
        <div>
          <div className="relative aspect-square overflow-hidden rounded-[2rem] bg-sand">
            {activeImage ? (
              <img src={mediaUrl(activeImage)} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center font-display text-5xl text-ink/15">{product.name}</div>
            )}
            <span className="absolute left-5 top-5 rounded-full bg-cream/90 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em]">
              {product.category?.name || "Custom"}
            </span>
          </div>
          {gallery.length > 1 && (
            <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
              {gallery.map((url) => (
                <button
                  key={url}
                  onClick={() => setActiveImage(url)}
                  className={cn(
                    "h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 bg-sand",
                    activeImage === url ? "border-clay" : "border-transparent"
                  )}
                >
                  <img src={mediaUrl(url)} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {product.stages.length > 0 && (
            <div className="mt-6">
              <p className="label">Print stages</p>
              <div className="flex flex-wrap gap-2">
                {product.stages.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveStage(item.id)}
                    className={cn(
                      "rounded-full border px-3.5 py-2 text-xs font-semibold transition",
                      activeStage === item.id ? "border-ink bg-ink text-cream" : "border-ink/15 bg-white hover:border-ink/40"
                    )}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
              {stage?.print_area && (
                <p className="mt-2 text-xs text-muted">
                  Printable area: {Number(stage.print_area.width_mm)} × {Number(stage.print_area.height_mm)} mm ·{" "}
                  {stage.print_area.export_dpi} DPI export
                </p>
              )}
            </div>
          )}
        </div>

        <div className="lg:pt-4">
          <p className="eyebrow">{product.category?.name || "MerchPress studio"}</p>
          <h1 className="mt-2 font-display text-4xl leading-tight sm:text-5xl">{product.name}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">{product.short_description}</p>

          <div className="mt-5 flex items-baseline gap-3">
            <span className="font-display text-3xl">{money(price, product.currency)}</span>
            {product.compare_at_price && Number(product.compare_at_price) > Number(product.base_price) && (
              <span className="text-sm text-muted line-through">{money(product.compare_at_price, product.currency)}</span>
            )}
            <span className="text-xs text-muted">before print options</span>
          </div>

          {colors.length > 0 && (
            <div className="mt-7">
              <div className="flex items-center justify-between">
                <span className="label mb-0 flex items-center gap-1.5"><Palette size={13} /> Colour</span>
                <span className="text-xs text-muted">{color}</span>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2.5">
                {colors.map(([name, hex]) => (
                  <button
                    key={name}
                    onClick={() => setColor(name)}
                    title={name}
                    className={cn(
                      "relative h-9 w-9 rounded-full border border-ink/15 transition",
                      color === name && "ring-2 ring-ink ring-offset-2 ring-offset-cream"
                    )}
                    style={{ backgroundColor: hex || "#ccc" }}
                  >
                    {color === name && <Check size={14} className="mx-auto text-white mix-blend-difference" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {sizes.length > 0 && (
            <div className="mt-6">
              <span className="label flex items-center gap-1.5"><Ruler size={13} /> Size</span>
              <div className="flex flex-wrap gap-2">
                {sizes.map((item) => (
                  <button
                    key={item}
                    onClick={() => setSize(item)}
                    className={cn(
                      "min-w-[52px] rounded-xl border px-3 py-2 text-sm font-semibold transition",
                      size === item ? "border-ink bg-ink text-cream" : "border-ink/15 bg-white hover:border-ink/40"
                    )}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}

          {product.printing_methods.length > 0 && (
            <div className="mt-6">
              <span className="label">Print method</span>
              <div className="space-y-2">
                {product.printing_methods.map((link) => (
                  <button
                    key={link.id}
                    onClick={() => setMethodId(link.printing_method.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition",
                      methodId === link.printing_method.id ? "border-ink bg-white" : "border-ink/10 hover:border-ink/30"
                    )}
                  >
                    <span>
                      <span className="block text-sm font-semibold">{link.printing_method.name}</span>
                      <span className="block text-xs text-muted">{link.printing_method.description}</span>
                    </span>
                    <span className="text-xs font-semibold">
                      {Number(link.printing_method.base_fee) > 0 ? `+${money(link.printing_method.base_fee)}` : "Included"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 rounded-2xl bg-sand/60 p-5">
            <div className="flex items-start gap-3">
              <div>
                <p className="text-sm font-semibold">This is a customizable product.</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Add your own text, artwork and clipart in the live studio. Every stage is print-ready at 300 DPI.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <LinkButton href={`/editor/${product.slug}${variantQuery}`} size="lg" className="w-full">
              Customize this product
            </LinkButton>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 text-xs text-muted">
            <FreeShippingNote withIcon />
            <div className="flex items-center gap-2"><Check size={15} /> Studio quality guarantee</div>
          </div>

          <details className="group mt-8 border-t border-ink/10 pt-4">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
              Product details <ChevronDown size={16} className="transition group-open:rotate-180" />
            </summary>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">{product.description}</p>
            {product.stages.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-muted">
                {product.stages.map((item) => (
                  <li key={item.id}>
                    • {item.name} — {item.print_area ? `${Number(item.print_area.width_mm)} × ${Number(item.print_area.height_mm)} mm` : "print area pending"}
                  </li>
                ))}
              </ul>
            )}
          </details>
          {product.quantity_discounts?.length > 0 && (
            <details className="group mt-3 border-t border-ink/10 pt-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
                Quantity discounts <ChevronDown size={16} className="transition group-open:rotate-180" />
              </summary>
              <ul className="mt-3 space-y-1 text-xs text-muted">
                {product.quantity_discounts.map((discount) => (
                  <li key={discount.min_qty}>• Buy {discount.min_qty}+ — save {Number(discount.percent)}%</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
