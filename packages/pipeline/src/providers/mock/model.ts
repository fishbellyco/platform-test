import type { DesignSpec, ProductTemplate } from "@fishbelly/core";
import type { ModelGenerator } from "../types";
import { figurineProfile } from "./figurine";
import { centreOffset, radius, shapeParams } from "./shape";

type V = [number, number, number];

/** A closed solid of revolution as ASCII STL, standing on z = 0, in millimetres. */
function latheStl(
  height: number,
  radiusAt: (t: number, theta: number) => number,
  offsetAt: (t: number) => number,
  scale: number,
  rings: number,
): string {
  const segs = 48;
  const at = (i: number, j: number): V => {
    const t = i / rings;
    const theta = (2 * Math.PI * (j % segs)) / segs;
    const r = radiusAt(t, theta);
    return [(offsetAt(t) + r * Math.cos(theta)) * scale, r * Math.sin(theta) * scale, t * height * scale];
  };
  const tris: [V, V, V][] = [];
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segs; j++) {
      const a = at(i, j), b = at(i, j + 1), c = at(i + 1, j + 1), d = at(i + 1, j);
      tris.push([a, b, c], [a, c, d]);
    }
  }
  const bottom: V = [offsetAt(0) * scale, 0, 0];
  const top: V = [offsetAt(1) * scale, 0, height * scale];
  for (let j = 0; j < segs; j++) {
    tris.push([bottom, at(0, j + 1), at(0, j)]);
    tris.push([top, at(rings, j), at(rings, j + 1)]);
  }
  const v = (x: V) => `vertex ${x[0].toFixed(3)} ${x[1].toFixed(3)} ${x[2].toFixed(3)}`;
  const body = tris
    .map(([a, b, c]) => `facet normal 0 0 0\nouter loop\n${v(a)}\n${v(b)}\n${v(c)}\nendloop\nendfacet`)
    .join("\n");
  return `solid fishbelly_mock\n${body}\nendsolid fishbelly_mock\n`;
}

/**
 * Builds a closed (solid, not hollow) mesh of the design in millimetres as ASCII STL.
 * Stands in for Meshy. Unlike Meshy, it is already at the right scale.
 */
export function buildMockStl(spec: DesignSpec, template: ProductTemplate, scale = 1): string {
  if (template.category === "figurine") {
    const { height, radiusAt } = figurineProfile(spec, template);
    return latheStl(height, (t) => radiusAt(t), () => 0, scale, 100);
  }
  const p = shapeParams(spec, template);
  return latheStl(p.height, (t, theta) => radius(p, t, theta), (t) => centreOffset(p, t), scale, 32);
}

export const mockModel: ModelGenerator = {
  name: "mock-3d",
  async generate({ spec, template }) {
    return { content: buildMockStl(spec, template), format: "stl", costUsd: 0 };
  },
};
