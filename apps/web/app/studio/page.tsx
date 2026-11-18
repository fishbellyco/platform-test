import { getBrand, getTemplate, STANDALONE_BRAND_ID } from "@fishbelly/core";
import { Studio } from "@/components/Studio";

// Standalone experience: Fishbelly's own brand, in the Fishbelly workspace. One product for now.
export default function StudioPage() {
  const brand = getBrand(STANDALONE_BRAND_ID)!;
  const template = getTemplate(brand.templateIds[0]!)!;
  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="mb-6 text-center text-sm font-medium uppercase tracking-[0.3em] text-neutral-500">
        Fishbelly
      </h1>
      <Studio
        templateId={template.id}
        productName={template.name}
        examplePrompt={template.examplePrompt}
        brandId={brand.id}
      />
    </main>
  );
}
