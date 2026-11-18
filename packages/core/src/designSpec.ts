import type { ProductTemplate } from "./template";

export interface AttributeSpec {
  description: string;
  /** 0 = barely there, 1 = as strong as the product allows. */
  intensity: number;
  /** Hex colour of this part. Only on templates with a palette, and always one of its colours. */
  colour?: string;
}

/**
 * The structured design state. Revisions change this, not the chat history.
 * It is what gets previewed, approved and sent to 3D generation.
 */
export interface DesignSpec {
  templateId: string;
  templateVersion: number;
  /** Customer-chosen values for "range" dimensions only. */
  dimensions: Record<string, number>;
  /** Keyed by the template's customisation attribute names. */
  attributes: Record<string, AttributeSpec>;
  colour: string;
  summary: string;
}

export const DEFAULT_COLOUR = "#d9d2c5";

export function defaultSpec(template: ProductTemplate): DesignSpec {
  const dimensions: Record<string, number> = {};
  for (const [key, rule] of Object.entries(template.dimensions)) {
    if (rule.kind === "range") dimensions[key] = rule.default;
  }
  const palette = template.palette;
  const attributes: Record<string, AttributeSpec> = {};
  for (const [key, value] of Object.entries(template.defaults)) {
    const colour = value.colour ? palette?.colours[value.colour] : undefined;
    attributes[key] = { description: value.description, intensity: 0.5, ...(colour ? { colour } : {}) };
  }
  return {
    templateId: template.id,
    templateVersion: template.version,
    dimensions,
    attributes,
    colour: (palette && palette.colours[palette.default]) || DEFAULT_COLOUR,
    summary: template.name,
  };
}

export function cloneSpec(spec: DesignSpec): DesignSpec {
  return JSON.parse(JSON.stringify(spec)) as DesignSpec;
}
