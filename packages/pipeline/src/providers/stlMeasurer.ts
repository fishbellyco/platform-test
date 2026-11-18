import type { Measurements } from "@fishbelly/core";
import type { GeometryMeasurer } from "./types";

/**
 * Measures an ASCII STL without any dependencies. Assumes the product stands on z = min,
 * in millimetres. It cannot measure wall thickness, so designs measured here can reach
 * "needs_review" at best. The Python service (services/geometry) is the real measurer.
 */
export function measureAsciiStl(stl: string): Measurements {
  const verts: [number, number, number][] = [];
  const re = /vertex\s+(\S+)\s+(\S+)\s+(\S+)/g;
  for (let m = re.exec(stl); m; m = re.exec(stl)) {
    verts.push([Number(m[1]), Number(m[2]), Number(m[3])]);
  }
  if (verts.length < 3 || verts.length % 3 !== 0 || verts.some((v) => v.some((n) => !Number.isFinite(n)))) {
    return {
      heightMm: null,
      maxDiameterMm: null,
      baseDiameterMm: null,
      minWallThicknessMm: null,
      watertight: null,
    };
  }

  const span = (points: [number, number, number][], axis: 0 | 1 | 2) => {
    let lo = Infinity, hi = -Infinity;
    for (const p of points) {
      lo = Math.min(lo, p[axis]);
      hi = Math.max(hi, p[axis]);
    }
    return { lo, hi, size: hi - lo };
  };
  const z = span(verts, 2);
  const footprint = (points: [number, number, number][]) =>
    Math.max(span(points, 0).size, span(points, 1).size);
  const base = verts.filter((v) => v[2] <= z.lo + 0.01);

  // Watertight: every edge is shared by exactly two triangles.
  const key = (v: [number, number, number]) => v.map((n) => n.toFixed(3)).join(",");
  const edges = new Map<string, number>();
  for (let i = 0; i < verts.length; i += 3) {
    const tri = [key(verts[i]!), key(verts[i + 1]!), key(verts[i + 2]!)];
    for (let e = 0; e < 3; e++) {
      const a = tri[e]!, b = tri[(e + 1) % 3]!;
      if (a === b) continue;
      const id = a < b ? `${a}|${b}` : `${b}|${a}`;
      edges.set(id, (edges.get(id) ?? 0) + 1);
    }
  }
  let watertight = edges.size > 0;
  for (const count of edges.values()) {
    if (count !== 2) {
      watertight = false;
      break;
    }
  }

  return {
    heightMm: z.size,
    maxDiameterMm: footprint(verts),
    baseDiameterMm: footprint(base),
    minWallThicknessMm: null,
    watertight,
  };
}

export const stlMeasurer: GeometryMeasurer = {
  name: "local-stl",
  async measure({ mesh }) {
    return measureAsciiStl(mesh);
  },
};

/** Sends the mesh to the Python measuring service (services/geometry). */
export function httpMeasurer(baseUrl: string): GeometryMeasurer {
  return {
    name: "geometry-service",
    async measure(input) {
      const res = await fetch(`${baseUrl.replace(/\/$/, "")}/measure`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`Geometry service returned ${res.status}`);
      return (await res.json()) as Measurements;
    },
  };
}
