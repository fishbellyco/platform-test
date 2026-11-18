import { claudeInterpreter } from "./claude";
import { mockInterpreter } from "./mock/interpreter";
import { mockModel } from "./mock/model";
import { mockPreview, mockReference } from "./mock/preview";
import { httpMeasurer, stlMeasurer } from "./stlMeasurer";
import type { Providers } from "./types";

export const mockProviders: Providers = {
  interpreter: mockInterpreter,
  preview: mockPreview,
  reference: mockReference,
  model: mockModel,
  geometry: stlMeasurer,
};

/** Mocks by default; real providers switch on one at a time through environment variables. */
export function buildProviders(env: Record<string, string | undefined>): Providers {
  const providers = { ...mockProviders };
  if (env.FISHBELLY_INTERPRETER === "claude") {
    if (!env.ANTHROPIC_API_KEY) throw new Error("FISHBELLY_INTERPRETER=claude needs ANTHROPIC_API_KEY.");
    providers.interpreter = claudeInterpreter(env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL || undefined);
  }
  if (env.GEOMETRY_SERVICE_URL) providers.geometry = httpMeasurer(env.GEOMETRY_SERVICE_URL);
  return providers;
}
