import { Studio } from "@/components/Studio";

// Standalone experience. One product for now.
export default function StudioPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="mb-6 text-center text-sm font-medium uppercase tracking-[0.3em] text-neutral-500">
        Fishbelly
      </h1>
      <Studio templateId="vase_001" productName="Organic Vase" />
    </main>
  );
}
