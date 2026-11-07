import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { mediaUrl } from "@/lib/api";
import type { ProductListItem } from "@/lib/types";
import { money } from "@/lib/utils";

export function ProductCard({ product }: { product: ProductListItem }) {
  return (
    <Link href={`/products/${product.slug}`} className="group block">
      <div className="relative aspect-square overflow-hidden rounded-3xl bg-sand">
        {product.image_url ? (
          <img
            src={mediaUrl(product.image_url)}
            alt={product.name}
            className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full items-center justify-center font-display text-3xl text-ink/20">{product.name}</div>
        )}
        {product.is_featured && (
          <span className="absolute left-4 top-4 rounded-full bg-cream/90 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink">
            Studio pick
          </span>
        )}
        <span className="absolute bottom-4 right-4 flex h-10 w-10 translate-y-2 items-center justify-center rounded-full bg-ink text-cream opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100">
          <ArrowUpRight size={17} />
        </span>
      </div>
      <div className="mt-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl leading-tight group-hover:text-clay">{product.name}</h3>
          <p className="mt-1 line-clamp-1 text-xs text-muted">{product.short_description || "Fully customizable"}</p>
        </div>
        <div className="text-right text-sm font-semibold">
          {Number(product.compare_at_price) > Number(product.min_price) && (
            <span className="mr-1.5 text-xs font-normal text-muted line-through">{money(product.compare_at_price)}</span>
          )}
          <span>from {money(product.min_price)}</span>
        </div>
      </div>
    </Link>
  );
}
