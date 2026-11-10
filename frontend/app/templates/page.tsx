import type { Metadata } from "next";
import type { Template } from "@/lib/types";
import { TemplatesContent } from "./templates-content";

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

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Design templates for custom apparel, decor & gifts",
  description:
    "Start with an artist-made template, then remix the colours, type and layout in the MerchPress studio. Free starting points for tees, hoodies, totes, posters and mugs.",
  alternates: { canonical: "/templates" },
  openGraph: {
    title: "Design templates for custom apparel, decor & gifts · MerchPress",
    description:
      "Artist-made starting points for every canvas. Pick a layout and make it entirely yours in the studio.",
    url: "/templates",
    type: "website",
    images: [
      {
        url: "/studio/shop-studio.jpg",
        width: 1800,
        height: 1199,
        alt: "An artist hand-painting lettering onto a T-shirt in the MerchPress studio",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Design templates for custom apparel, decor & gifts · MerchPress",
    description: "Artist-made starting points for every canvas. Make one yours in the studio.",
    images: ["/studio/shop-studio.jpg"],
  },
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

async function fetchTemplates(): Promise<Template[] | null> {
  try {
    const response = await fetch(`${BACKEND_ORIGIN}/api/templates/`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    });
    if (!response.ok) return null;
    return (await response.json()) as Template[];
  } catch {
    return null;
  }
}

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const initialCategory = firstValue(searchParams?.category).trim();
  const initialSearch = firstValue(searchParams?.search).trim();
  const templates = await fetchTemplates();
  const initialTemplates = templates ?? [];

  const itemList =
    initialTemplates.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "MerchPress template library",
          url: `${SITE_URL}/templates`,
          numberOfItems: initialTemplates.length,
          itemListElement: initialTemplates.map((template, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: template.name,
            url: template.product_slug
              ? `${SITE_URL}/editor/${template.product_slug}?template=${template.id}`
              : `${SITE_URL}/templates`,
          })),
        }
      : null;
  const jsonLd = itemList ? JSON.stringify(itemList).replace(/</g, "\\u003c") : "";

  return (
    <>
      <TemplatesContent
        initialTemplates={initialTemplates}
        initialCategory={initialCategory}
        initialSearch={initialSearch}
        initialLoaded={Boolean(templates)}
      />
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />}
    </>
  );
}
