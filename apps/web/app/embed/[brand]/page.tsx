import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { getBrand, getTemplate } from "@fishbelly/core";
import { Studio } from "@/components/Studio";

// Embedded experience: the same Studio, inside a brand's iframe.
// TODO (Phase 5): start from a signed token issued by the brand's server instead of
// trusting the URL, and send `Content-Security-Policy: frame-ancestors <brand origin>`.
export default async function EmbedPage({
  params,
  searchParams,
}: {
  params: Promise<{ brand: string }>;
  searchParams: Promise<{ product?: string }>;
}) {
  const { brand: brandId } = await params;
  const { product } = await searchParams;
  const brand = getBrand(brandId);
  const template = product ? getTemplate(product) : null;
  if (!brand?.allowedOrigin || !template || !brand.templateIds.includes(template.id)) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-6" style={{ "--accent": brand.theme.accent } as CSSProperties}>
      <Studio
        templateId={template.id}
        productName={template.name}
        examplePrompt={template.examplePrompt}
        brandId={brand.id}
        parentOrigin={brand.allowedOrigin}
      />
    </main>
  );
}
