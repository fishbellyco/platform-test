// Product templates: the source of truth for what may and may not change.
// This package has no dependencies and no Node imports, so the browser can use it.

export type ManufacturingMethod = "3d_printing" | "metal_casting" | "embroidery";

export type DimensionRule =
  /** Fixed by the manufacturer. Customers can never change it. */
  | { kind: "locked"; value: number }
  /** Customer may choose a value inside the range. */
  | { kind: "range"; min: number; max: number; default: number }
  /** Engineering limits. Checked on the finished mesh, never set by the customer. */
  | { kind: "maximum"; value: number }
  | { kind: "minimum"; value: number };

export interface ProductTemplate {
  id: string;
  version: number;
  name: string;
  category: string;
  manufacturingMethod: ManufacturingMethod;
  units: "mm";
  dimensions: Record<string, DimensionRule>;
  /** Attribute name -> may the customer customise it? Anything absent is not allowed. */
  customisation: Record<string, boolean>;
  validation: {
    toleranceMm: number;
    requireWatertight: boolean;
  };
}

// PLACEHOLDER VALUES. Replace with the real product's specification.
const vase001: ProductTemplate = {
  id: "vase_001",
  version: 1,
  name: "Organic Vase",
  category: "homeware",
  manufacturingMethod: "3d_printing",
  units: "mm",
  dimensions: {
    base_diameter: { kind: "locked", value: 90 },
    height: { kind: "range", min: 150, max: 250, default: 200 },
    max_diameter: { kind: "maximum", value: 160 },
    wall_thickness: { kind: "minimum", value: 3 },
  },
  customisation: {
    surface_texture: true,
    decorative_pattern: true,
    silhouette: true,
    base_geometry: false,
    internal_structure: false,
  },
  validation: { toleranceMm: 0.5, requireWatertight: true },
};

const TEMPLATES: Record<string, ProductTemplate> = { [vase001.id]: vase001 };

export function getTemplate(id: string): ProductTemplate | null {
  return TEMPLATES[id] ?? null;
}

export function listTemplates(): ProductTemplate[] {
  return Object.values(TEMPLATES);
}

export function lockedValue(template: ProductTemplate, key: string): number | null {
  const rule = template.dimensions[key];
  return rule && rule.kind === "locked" ? rule.value : null;
}

export function label(key: string): string {
  return key.replace(/_/g, " ");
}
