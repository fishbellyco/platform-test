import type { DesignSpec, Measurements, ProductTemplate } from "@fishbelly/core";

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

export interface PreviewGenerator {
  name: string;
  generate(input: {
    spec: DesignSpec;
    template: ProductTemplate;
    previousPreviewUrl: string | null;
  }): Promise<{ content: string; extension: "svg" | "png"; costUsd: number }>;
}

export interface ModelGenerator {
  name: string;
  // Real providers return a binary GLB by URL; widen `content` when the first one lands.
  generate(input: {
    spec: DesignSpec;
    template: ProductTemplate;
    previewUrl: string;
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
  model: ModelGenerator;
  geometry: GeometryMeasurer;
}
