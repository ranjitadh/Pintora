"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Design, Product, Template } from "@/lib/types";
import { DesignEditor } from "@/components/design-editor";
import { Alert, LinkButton, LoadingBlock } from "@/components/ui";

function EditorLoader() {
  const params = useParams<{ slug: string }>();
  const search = useSearchParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [design, setDesign] = useState<Design | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      try {
        const data = await api.get<Product>(`/products/${params.slug}/`);
        if (!alive) return;
        setProduct(data);

        const designId = search.get("design");
        if (designId) {
          try {
            const saved = await api.get<Design>(`/designs/${designId}/`);
            if (alive) setDesign(saved);
          } catch {
            if (alive) setError("That saved design could not be opened. You can start a new one below.");
          }
        }

        const templateId = search.get("template");
        if (templateId) {
          try {
            const found = await api.get<Template>(`/templates/${templateId}/`);
            if (alive) setTemplate(found);
          } catch {
            if (alive) setError("That template could not be loaded. You can still design from scratch.");
          }
        }
      } catch {
        if (alive) setError("We couldn't load this product in the studio.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [params.slug, search]);

  if (loading) return <LoadingBlock label="Opening the studio…" />;

  if (!product) {
    return (
      <div className="container-x py-20 text-center">
        <Alert>{error || "Product not found."}</Alert>
        <LinkButton href="/shop" className="mt-6" variant="secondary">Back to shop</LinkButton>
      </div>
    );
  }

  if (!product.stages.length) {
    return (
      <div className="container-x py-20 text-center">
        <h1 className="font-display text-3xl">This product isn&apos;t customizable yet.</h1>
        <p className="mt-2 text-sm text-muted">Our team is preparing its print areas. Please check back soon.</p>
        <Link href="/shop" className="mt-5 inline-block text-sm font-semibold text-clay underline">Browse other products</Link>
      </div>
    );
  }

  const variantParam = search.get("variant") || undefined;
  const methodParam = search.get("method") || undefined;
  const issues: string[] = [];

  let variantId: string | undefined;
  if (variantParam) {
    const requestedVariant = product.variants.find((variant) => variant.id === variantParam);
    if (!requestedVariant) {
      issues.push("The requested colour/size is not available for this product, so the default configuration is shown.");
    } else if (!requestedVariant.is_active) {
      issues.push("The requested colour/size is currently unavailable, so the default configuration is shown.");
    } else {
      variantId = requestedVariant.id;
    }
  }

  let methodId: string | undefined;
  if (methodParam) {
    const requestedMethod = product.printing_methods.find((link) => link.printing_method.id === methodParam);
    if (!requestedMethod) {
      issues.push("The requested printing method is not available for this product, so the default method is shown.");
    } else {
      methodId = methodParam;
    }
  }

  return (
    <DesignEditor
      product={product}
      initialDesign={design}
      initialTemplate={template}
      initialVariantId={variantId}
      initialMethodId={methodId}
      initialError={[error, ...issues].filter(Boolean).join(" ")}
    />
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={<LoadingBlock label="Opening the studio…" />}>
      <EditorLoader />
    </Suspense>
  );
}
