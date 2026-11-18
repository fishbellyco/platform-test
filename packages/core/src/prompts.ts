import type { Brand } from "./brands";
import type { DesignSpec } from "./designSpec";
import { colourName, label, type ProductTemplate } from "./template";

// The prompt concatenator. In Weavy, the brand prompt, the product prompt and the customer's raw
// text were joined. Here the customer's text never reaches an image or 3D model: the design is
// described from the spec that enforceConstraints() produced, so anything the template forbids
// is already gone.

export interface StepPrompts {
  preview: string;
  manufacturingReference: string | null;
  model3d: string;
}

/** True if the template's prompts put a brand wordmark on the product. */
export function needsWordmark(template: ProductTemplate): boolean {
  const p = template.prompts;
  return [p.preview, p.manufacturingReference ?? "", p.model3d].some((text) => text.includes("{{wordmark}}"));
}

/** The enforced design as plain lines, e.g. "- headwear: red knitted beanie". */
export function describeSpec(spec: DesignSpec, template: ProductTemplate): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(spec.dimensions)) {
    lines.push(`- ${label(key)}: ${value} ${template.units}`);
  }
  for (const key of Object.keys(template.customisation)) {
    const attr = spec.attributes[key];
    if (!attr || !template.customisation[key]) continue;
    const colour = attr.colour ? `${colourName(template, attr.colour) ?? attr.colour} ` : "";
    const strength = template.palette ? "" : ` (strength ${attr.intensity} of 1)`;
    lines.push(`- ${label(key)}: ${colour}${attr.description}${strength}`);
  }
  lines.push(`- main colour: ${colourName(template, spec.colour) ?? spec.colour}`);
  return lines.join("\n");
}

export function composePrompts(brand: Brand, template: ProductTemplate, spec: DesignSpec): StepPrompts {
  const fill = (text: string) => text.replaceAll("{{wordmark}}", brand.wordmark ?? "");
  return {
    preview: [brand.prompt, fill(template.prompts.preview), `Personalisation:\n${describeSpec(spec, template)}`]
      .filter(Boolean)
      .join("\n\n"),
    manufacturingReference: template.prompts.manufacturingReference && fill(template.prompts.manufacturingReference),
    model3d: fill(template.prompts.model3d),
  };
}
