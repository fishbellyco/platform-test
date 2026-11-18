import { DEFAULT_COLOUR, defaultSpec, type AttributeSpec, type DesignSpec } from "./designSpec";
import { label, type Palette, type ProductTemplate } from "./template";

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

  const colour = typeof input.colour === "string" && isHex(input.colour) ? input.colour.toLowerCase() : null;
  if (template.palette) {
    enforcePalette(spec, colour, template.palette, adjustments);
  } else {
    spec.colour = colour ?? DEFAULT_COLOUR;
    for (const attr of Object.values(spec.attributes)) delete attr.colour;
  }
  if (typeof input.summary === "string" && input.summary.trim()) {
    spec.summary = input.summary.trim().slice(0, 300);
  }
  return { spec, adjustments };
}

/**
 * Every colour must be printable, and the product may only use `maxColours` of them.
 * Unprintable colours snap to the nearest palette colour; colours over the limit snap to the
 * nearest colour the product already uses. The fixed colours (and the main colour) come first.
 */
function enforcePalette(spec: DesignSpec, proposedMain: string | null, palette: Palette, adjustments: string[]): void {
  const names = Object.keys(palette.colours);
  const hexOf = (name: string) => palette.colours[name]!;
  const nameOf = (hex: string) => names.find((n) => hexOf(n) === hex) ?? hex;
  const used = new Set(palette.fixed.map(hexOf));

  const place = (hex: string, what: string): string => {
    let chosen = nearest(hex, names.map(hexOf));
    if (chosen !== hex) adjustments.push(`The ${what} is ${nameOf(chosen)}, the closest colour we can print.`);
    if (!used.has(chosen) && used.size >= palette.maxColours) {
      chosen = nearest(chosen, [...used]);
      adjustments.push(
        `This product can have up to ${palette.maxColours} colours, so the ${what} uses ${nameOf(chosen)}, a colour it already has.`,
      );
    }
    used.add(chosen);
    return chosen;
  };

  spec.colour = proposedMain ? place(proposedMain, "main colour") : hexOf(palette.default);
  used.add(spec.colour);
  for (const [key, attr] of Object.entries(spec.attributes)) {
    if (attr.colour === undefined) continue;
    if (!isHex(attr.colour)) delete attr.colour;
    else attr.colour = place(attr.colour.toLowerCase(), label(key));
  }
}

/** Closest colour as people see it ("redmean" weighted RGB distance). */
function nearest(hex: string, options: string[]): string {
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r, g, b] = rgb(hex) as [number, number, number];
  let best = options[0]!;
  let bestDistance = Infinity;
  for (const option of options) {
    const [r2, g2, b2] = rgb(option) as [number, number, number];
    const mean = (r + r2) / 2;
    const distance = (2 + mean / 256) * (r - r2) ** 2 + 4 * (g - g2) ** 2 + (2 + (255 - mean) / 256) * (b - b2) ** 2;
    if (distance < bestDistance) [best, bestDistance] = [option, distance];
  }
  return best;
}

const isHex = (value: string) => /^#[0-9a-f]{6}$/i.test(value);

function toAttribute(value: unknown): AttributeSpec | null {
  if (!isRecord(value)) return null;
  const intensity =
    typeof value.intensity === "number" && Number.isFinite(value.intensity) ? value.intensity : 0.5;
  return {
    description: typeof value.description === "string" ? value.description.slice(0, 200) : "",
    intensity: Math.round(Math.min(1, Math.max(0, intensity)) * 100) / 100,
    ...(typeof value.colour === "string" ? { colour: value.colour } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
