import { DEFAULT_COLOUR, defaultSpec, type AttributeSpec, type DesignSpec } from "./designSpec";
import { label, type ProductTemplate } from "./template";

export interface EnforcementResult {
  spec: DesignSpec;
  /** Plain-language notes for the customer about anything that was kept or changed. */
  adjustments: string[];
}

/**
 * The gate between "what the AI proposed" and "what we will generate".
 * `proposed` comes from an LLM, so it is treated as untrusted input:
 * nothing reaches the result unless the template allows it.
 */
export function enforceConstraints(proposed: unknown, template: ProductTemplate): EnforcementResult {
  const spec = defaultSpec(template);
  const adjustments: string[] = [];
  const input = isRecord(proposed) ? proposed : {};

  const dims = isRecord(input.dimensions) ? input.dimensions : {};
  for (const [key, value] of Object.entries(dims)) {
    const rule = template.dimensions[key];
    if (!rule) {
      adjustments.push(`"${label(key)}" isn't something this product has, so it was ignored.`);
      continue;
    }
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    if (rule.kind === "locked") {
      if (value !== rule.value) {
        adjustments.push(
          `The ${label(key)} is fixed for this product, so it stays at ${rule.value} ${template.units}.`,
        );
      }
      continue;
    }
    if (rule.kind !== "range") {
      adjustments.push(`The ${label(key)} is an engineering limit and can't be set directly.`);
      continue;
    }
    const clamped = Math.min(rule.max, Math.max(rule.min, value));
    if (clamped !== value) {
      adjustments.push(
        `The ${label(key)} can be ${rule.min}–${rule.max} ${template.units}, so it was set to ${clamped} ${template.units}.`,
      );
    }
    spec.dimensions[key] = clamped;
  }

  const attrs = isRecord(input.attributes) ? input.attributes : {};
  for (const [key, value] of Object.entries(attrs)) {
    if (template.customisation[key] !== true) {
      adjustments.push(`The ${label(key)} can't be customised on this product.`);
      continue;
    }
    const attr = toAttribute(value);
    if (attr) spec.attributes[key] = attr;
  }

  spec.colour =
    typeof input.colour === "string" && /^#[0-9a-f]{6}$/i.test(input.colour)
      ? input.colour.toLowerCase()
      : DEFAULT_COLOUR;
  if (typeof input.summary === "string" && input.summary.trim()) {
    spec.summary = input.summary.trim().slice(0, 300);
  }
  return { spec, adjustments };
}

function toAttribute(value: unknown): AttributeSpec | null {
  if (!isRecord(value)) return null;
  const intensity =
    typeof value.intensity === "number" && Number.isFinite(value.intensity) ? value.intensity : 0.5;
  return {
    description: typeof value.description === "string" ? value.description.slice(0, 200) : "",
    intensity: Math.round(Math.min(1, Math.max(0, intensity)) * 100) / 100,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
