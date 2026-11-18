import { lockedValue, type DesignSpec, type ProductTemplate } from "@fishbelly/core";

// A simple parametric vase used by the mock preview and the mock 3D model, so that
// what the customer sees and what gets "built" come from the same numbers.

export interface ShapeParams {
  baseR: number;
  height: number;
  bulge: number;
  lean: number;
  grooves: number;
  grooveDepth: number;
  wavy: boolean;
}

export function shapeParams(spec: DesignSpec, template: ProductTemplate): ShapeParams {
  const silhouette = spec.attributes.silhouette?.intensity ?? 0.2;
  const texture = spec.attributes.surface_texture;
  const strength = texture?.intensity ?? 0;
  return {
    baseR: (lockedValue(template, "base_diameter") ?? 90) / 2,
    height: spec.dimensions.height ?? 200,
    bulge: 0.15 + 0.35 * silhouette,
    lean: 0.03 * silhouette,
    grooves: strength > 0 ? 16 : 0,
    grooveDepth: 0.04 * strength,
    wavy: /wave|ripple/.test(texture?.description ?? ""),
  };
}

/** Radius at height fraction t (0 = base, 1 = rim) and angle theta. Equals baseR at t = 0. */
export function radius(p: ShapeParams, t: number, theta: number): number {
  const body = p.baseR * (1 + p.bulge * Math.sin(Math.PI * Math.pow(t, 0.8)) - 0.25 * t * t);
  if (!p.grooves) return body;
  const ramp = Math.min(1, t * 5); // texture fades to nothing at the base
  return body * (1 + p.grooveDepth * ramp * Math.sin(p.grooves * theta + (p.wavy ? 8 * t : 0)));
}

/** Sideways drift of the centre line, for asymmetric silhouettes. Zero at the base. */
export function centreOffset(p: ShapeParams, t: number): number {
  return p.lean * p.height * Math.sin(Math.PI * t);
}
