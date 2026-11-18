import type { Brand, DesignSpec, Measurements, ProductTemplate } from "@fishbelly/core";

// One interface per pipeline stage. Every real provider gets an adapter here and nothing
// else in the codebase knows its name. Each stage also has a mock (see ./mock).

export interface PromptInterpreter {
  name: string;
  /** Proposes a new spec. The result is NOT trusted: enforceConstraints() runs on it next. */
  interpret(input: {
    prompt: string;
    current: DesignSpec;
    template: ProductTemplate;
  }): Promise<{ proposed: unknown; notes: string[]; costUsd: number }>;
}

// Real image and 3D providers work from `prompt` (built by composePrompts() in core) and the
// images. `spec`, `template` and `brand` are there for mocks, which draw from the numbers.

export interface PreviewGenerator {
  name: string;
  generate(input: {
    prompt: string;
    /** Template reference image keys (assets/references/...): the product's look. */
    referenceImages: string[];
    /** Set when refining: edit this image rather than starting again. */
    previousPreviewUrl: string | null;
    spec: DesignSpec;
    template: ProductTemplate;
    brand: Brand;
  }): Promise<{ content: string; extension: "svg" | "png"; costUsd: number }>;
}

/** Turns the approved render into a clean, front-on, flat-coloured image for 3D reconstruction. */
export interface ReferenceGenerator {
  name: string;
  generate(input: {
    prompt: string;
    approvedPreviewUrl: string;
    spec: DesignSpec;
    template: ProductTemplate;
    brand: Brand;
  }): Promise<{ content: string; extension: "svg" | "png"; costUsd: number }>;
}

export interface ModelGenerator {
  name: string;
  // Real providers return a binary GLB by URL; widen `content` when the first one lands.
  generate(input: {
    prompt: string;
    /** The manufacturing reference if the template has that step, else the approved preview. */
    imageUrl: string;
    spec: DesignSpec;
    template: ProductTemplate;
  }): Promise<{ content: string; format: "stl"; costUsd: number }>;
}

export interface GeometryMeasurer {
  name: string;
  /** Returns numbers only. Pass/fail is decided by evaluateMeasurements() in core. */
  measure(input: { mesh: string; format: "stl" }): Promise<Measurements>;
}

export interface Providers {
  interpreter: PromptInterpreter;
  preview: PreviewGenerator;
  reference: ReferenceGenerator;
  model: ModelGenerator;
  geometry: GeometryMeasurer;
}
