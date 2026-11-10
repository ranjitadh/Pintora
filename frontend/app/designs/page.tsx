import type { Metadata } from "next";
import { DesignsContent } from "./designs-content";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.SITE_URL ||
  "http://localhost:3000"
).replace(/\/$/, "");

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Your designs · MerchPress",
  description:
    "Your saved design library. Open, duplicate, download or delete any canvas — every design is versioned and ready for print.",
  alternates: { canonical: "/designs" },
  openGraph: {
    title: "Your designs · MerchPress",
    description: "Your saved design library. Open, duplicate, download or delete any canvas.",
    url: "/designs",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Your designs · MerchPress",
    description: "Your saved design library.",
  },
};

export default function DesignsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const initialSearch = firstValue(searchParams?.search);
  const initialSort = firstValue(searchParams?.sort) || "newest";
  const initialPage = Math.max(
    parseInt(firstValue(searchParams?.page) || "1", 10),
    1
  );

  return (
    <DesignsContent
      initialSearch={initialSearch}
      initialSort={initialSort}
      initialPage={initialPage}
    />
  );
}
