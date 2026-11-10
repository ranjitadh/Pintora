import type { Metadata } from "next";
import type { Category, Paginated, ProductListItem } from "@/lib/types";
import { ShopContent } from "./shop-content";

const PAGE_SIZE = 24;
const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.SITE_URL ||
  "http://localhost:3000"
).replace(/\/$/, "");
const BACKEND_ORIGIN = (
  process.env.BACKEND_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_BACKEND_ORIGIN ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

const SORT_OPTIONS = new Set(["newest", "price_asc", "price_desc", "name"]);

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Shop custom-printed apparel, decor & gifts",
  description:
    "Browse premium blanks chosen for print — apparel, totes, drinkware and home goods. Personalize any piece in the Printora studio and we print it in small batches.",
  alternates: { canonical: "/shop" },
  openGraph: {
    title: "Shop custom-printed apparel, decor & gifts · Printora",
    description:
      "Premium blanks chosen for print, finished by hand in small batches. Design your piece in the Printora studio.",
    url: "/shop",
    type: "website",
    images: [
      {
        url: "/studio/shop-studio.jpg",
        width: 1800,
        height: 1199,
        alt: "An artist hand-painting lettering onto a T-shirt in the Printora studio",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Shop custom-printed apparel, decor & gifts · Printora",
    description: "Premium blanks chosen for print, finished by hand in small batches.",
    images: ["/studio/shop-studio.jpg"],
  },
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

async function fetchCatalog<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${BACKEND_ORIGIN}${path}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 30 },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const category = firstValue(searchParams?.category).trim();
  const search = firstValue(searchParams?.search).trim();
  const requestedSort = firstValue(searchParams?.sort);
  const sort = SORT_OPTIONS.has(requestedSort) ? requestedSort : "newest";

  const query = new URLSearchParams({ sort, page: "1", page_size: String(PAGE_SIZE) });
  if (category) query.set("category", category);
  if (search) query.set("search", search);

  const [productsData, categoriesData] = await Promise.all([
    fetchCatalog<Paginated<ProductListItem>>(`/api/products/?${query.toString()}`),
    fetchCatalog<Category[]>("/api/categories/"),
  ]);

  const initialProducts = productsData?.results ?? [];
  const initialCount = productsData?.count ?? 0;
  const initialTotalPages = productsData?.total_pages ?? 0;

  const itemList =
    initialProducts.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Printora shop",
          url: `${SITE_URL}/shop`,
          numberOfItems: initialProducts.length,
          itemListElement: initialProducts.map((product, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: product.name,
            url: `${SITE_URL}/products/${product.slug}`,
          })),
        }
      : null;
  const jsonLd = itemList ? JSON.stringify(itemList).replace(/</g, "\\u003c") : "";

  return (
    <>
      <ShopContent
        initialProducts={initialProducts}
        initialCount={initialCount}
        initialTotalPages={initialTotalPages}
        initialCategories={categoriesData ?? []}
        initialCategory={category}
        initialSearch={search}
        initialSort={sort}
        initialLoaded={Boolean(productsData)}
      />
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />}
    </>
  );
}
