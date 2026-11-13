import { notFound } from "next/navigation";
import type { Product } from "@/lib/types";
import { ProductDetail } from "./product-detail";

const BACKEND_ORIGIN = (
  process.env.BACKEND_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_BACKEND_ORIGIN ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

async function fetchProduct(slug: string): Promise<Product | null | undefined> {
  try {
    const response = await fetch(`${BACKEND_ORIGIN}/api/products/${encodeURIComponent(slug)}/`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (response.status === 404) return null;
    if (!response.ok) return undefined;
    return (await response.json()) as Product;
  } catch {
    return undefined;
  }
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = await fetchProduct(params.slug);
  if (product === null) notFound();
  return <ProductDetail key={params.slug} slug={params.slug} initialProduct={product ?? null} />;
}
