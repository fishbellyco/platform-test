import type { DesignSpec, ProductTemplate } from "@fishbelly/core";
import type { PreviewGenerator } from "../types";
import { centreOffset, radius, shapeParams } from "./shape";

/** Draws the vase as a flat SVG. Stands in for the image model. */
export function renderPreviewSvg(spec: DesignSpec, template: ProductTemplate): string {
  const p = shapeParams(spec, template);
  const size = 480;
  const scale = 1.36; // px per mm: a 250 mm vase fills the frame
  const floor = 430;
  const steps = 60;
  const colour = /^#[0-9a-f]{6}$/i.test(spec.colour) ? spec.colour : "#d9d2c5";

  const right: string[] = [];
  const left: string[] = [];
  const grooves: string[][] = Array.from({ length: 7 }, () => []);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = size / 2 + centreOffset(p, t) * scale;
    const y = (floor - t * p.height * scale).toFixed(1);
    right.push(`${(cx + radius(p, t, 0) * scale).toFixed(1)},${y}`);
    left.push(`${(cx - radius(p, t, Math.PI) * scale).toFixed(1)},${y}`);
    grooves.forEach((line, k) => {
      const across = -0.75 + k * 0.25;
      const sway = p.wavy ? Math.sin(t * 14 + k) * 3 * Math.min(1, t * 5) : 0;
      line.push(`${(cx + across * radius(p, t, 0) * scale + sway).toFixed(1)},${y}`);
    });
  }
  const outline = `M${right.join(" L")} L${left.reverse().join(" L")} Z`;
  const lines = p.grooves
    ? grooves
        .map(
          (line) =>
            `<path d="M${line.join(" L")}" fill="none" stroke="#000" stroke-opacity="${(0.08 + p.grooveDepth * 8).toFixed(2)}" stroke-width="2"/>`,
        )
        .join("")
    : "";

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`,
    `<defs><linearGradient id="shade" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity="0.18"/>`,
    `<stop offset="0.45" stop-color="#fff" stop-opacity="0.12"/><stop offset="1" stop-color="#000" stop-opacity="0.28"/></linearGradient></defs>`,
    `<rect width="${size}" height="${size}" fill="#f3f0ea"/>`,
    `<ellipse cx="${size / 2}" cy="${floor + 4}" rx="${(p.baseR * scale * 1.5).toFixed(1)}" ry="10" fill="#000" opacity="0.12"/>`,
    `<path d="${outline}" fill="${colour}"/>`,
    lines,
    `<path d="${outline}" fill="url(#shade)"/>`,
    `<text x="16" y="28" font-family="sans-serif" font-size="12" fill="#999">MOCK PREVIEW</text>`,
    `</svg>`,
  ].join("");
}

export const mockPreview: PreviewGenerator = {
  name: "mock-preview",
  async generate({ spec, template }) {
    return { content: renderPreviewSvg(spec, template), extension: "svg", costUsd: 0 };
  },
};
