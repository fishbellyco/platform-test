import { cloneSpec, lockedValue, type DesignSpec, type ProductTemplate } from "@fishbelly/core";
import type { PromptInterpreter } from "../types";

// Mocks for figurine templates (the fisherman). Like the vase mocks, they stand in for the
// LLM, the image model and the 3D model so the whole journey runs without keys.

// Words customers use -> hex. Palette names map to palette colours; a few deliberately
// don't (pink, purple), so enforceConstraints() has something to snap.
const EXTRA_COLOURS: Record<string, string> = {
  yellow: "#e5ad2f",
  gold: "#e5ad2f",
  ginger: "#e07a2e",
  gray: "#8e8e8e",
  beige: "#efe4cc",
  tan: "#7a4b2a",
  pink: "#e7a1b0",
  purple: "#7d4fa0",
};

// First matching phrase wins, so specific phrases come before general ones.
const PARTS: { key: string; phrases: [RegExp, string][] }[] = [
  {
    key: "headwear",
    phrases: [
      [/no hat|hatless/, "none"],
      [/bobble/, "bobble hat"],
      [/beanie|woolly hat|knitted hat/, "knitted beanie"],
      [/flat cap/, "flat cap"],
      [/captain|sailor hat/, "captain's hat with an anchor badge"],
      [/sou'?wester|rain hat|bucket hat/, "sou'wester rain hat"],
      [/\bcap\b|baseball/, "baseball cap"],
    ],
  },
  {
    key: "hair",
    phrases: [
      [/bald/, "bald"],
      [/\bbun\b/, "hair in a top bun"],
      [/long hair|wavy hair/, "long wavy hair"],
      [/ponytail/, "ponytail"],
      [/curly/, "short curly hair"],
      [/\bhair\b/, "short hair"],
    ],
  },
  {
    key: "facial_hair",
    phrases: [
      [/no beard|clean[- ]shaven|shave/, "none"],
      [/mou?stache|mustache/, "moustache"],
      [/stubble/, "stubble"],
      [/beard/, "full beard"],
    ],
  },
  {
    key: "eyewear",
    phrases: [
      [/no glasses/, "none"],
      [/sunglasses|shades/, "sunglasses"],
      [/glasses|specs|spectacles/, "round glasses"],
    ],
  },
  { key: "scarf", phrases: [[/scarf/, "chunky scarf"]] },
  { key: "jewellery", phrases: [[/earring/, "hoop earrings"]] },
  {
    key: "top",
    phrases: [
      [/rain ?coat|oilskin|mac\b/, "raincoat"],
      [/jumper|sweater|knit/, "chunky jumper"],
      [/gilet|vest/, "gilet over a shirt"],
      [/dungarees|overalls/, "dungarees"],
      [/jacket|coat/, "jacket"],
    ],
  },
  {
    key: "trousers",
    phrases: [
      [/shorts/, "shorts"],
      [/trousers|pants|jeans/, "trousers"],
    ],
  },
  { key: "boots", phrases: [[/boots|wellies|wellingtons/, "chunky boots"]] },
];

function colourWords(template: ProductTemplate): Record<string, string> {
  return { ...EXTRA_COLOURS, ...(template.palette?.colours ?? {}) };
}

/**
 * Naive on purpose, like the vase mock: it proposes whatever was asked, including things the
 * template locks (a different fish, a fishing rod, a taller figure), so enforcement is exercised.
 */
export const mockFigurineInterpreter: PromptInterpreter = {
  name: "mock-interpreter",
  async interpret({ prompt, current, template }) {
    const text = prompt.toLowerCase();
    const proposed = cloneSpec(current);
    const colours = colourWords(template);
    const colourPattern = Object.keys(colours).sort((a, b) => b.length - a.length).join("|");
    let changed = false;
    const claimed = new Set<string>();

    for (const part of PARTS) {
      for (const [pattern, description] of part.phrases) {
        const match = pattern.exec(text);
        if (!match) continue;
        const attr = { ...(proposed.attributes[part.key] ?? { description, intensity: 0.5 }), description };
        // A colour word up to two words before the item: "a red knitted beanie".
        const before = text.slice(0, match.index);
        const colour = new RegExp(`\\b(${colourPattern})\\s+(?:[a-z']+\\s+){0,2}$`).exec(before);
        if (colour) {
          attr.colour = colours[colour[1]!];
          claimed.add(colour[1]!);
        }
        proposed.attributes[part.key] = attr;
        changed = true;
        break;
      }
    }

    // Asks for things the template locks. The constraint layer, not this mock, says no.
    if (/shark|whale|octopus|lobster|different fish|change the fish|bigger fish/.test(text)) {
      proposed.attributes.fish = { description: text, intensity: 0.5 };
      changed = true;
    }
    if (/logo|wordmark|\btext\b|my name|lettering/.test(text)) {
      proposed.attributes.wordmark = { description: text, intensity: 0.5 };
      changed = true;
    }
    if (/rod|net\b|pipe|dog|parrot|cat\b|guitar/.test(text)) {
      proposed.attributes.props = { description: text, intensity: 0.5 };
      changed = true;
    }
    if (/waving|sitting|running|pose|arms up/.test(text)) {
      proposed.attributes.pose = { description: text, intensity: 0.5 };
      changed = true;
    }
    const height = lockedValue(template, "height");
    if (height !== null && /taller|\bbig|larger|smaller|shorter|twice|double|\d+\s*(cm|mm)/.test(text)) {
      proposed.dimensions.height = /smaller|shorter/.test(text) ? height * 0.7 : height * 1.5;
      changed = true;
    }

    // A bare colour ("make it green") recolours the clothing.
    for (const [word, hex] of Object.entries(colours)) {
      if (claimed.has(word) || !new RegExp(`\\b${word}\\b`).test(text)) continue;
      const top = proposed.attributes.top;
      if (top) top.colour = hex;
      changed = true;
    }

    const notes: string[] = [];
    if (changed) proposed.summary = prompt.trim();
    else notes.push("I wasn't sure what to change. Try describing the hat, hair, beard, glasses or clothes.");
    return { proposed, notes, costUsd: 0 };
  },
};

// ---- Drawing ----

const escapeXml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

function partColour(spec: DesignSpec, key: string, fallback: string): string {
  const colour = spec.attributes[key]?.colour;
  return colour && /^#[0-9a-f]{6}$/i.test(colour) ? colour : fallback;
}

function has(spec: DesignSpec, key: string, pattern?: RegExp): boolean {
  const description = spec.attributes[key]?.description ?? "none";
  if (description === "none") return false;
  return pattern ? pattern.test(description) : true;
}

/**
 * Draws the figure as SVG. "render" is what the customer sees; "flat" stands in for the
 * manufacturing reference: front-on, outlined, flat colour, plain white background.
 */
export function renderFigurineSvg(
  spec: DesignSpec,
  template: ProductTemplate,
  wordmark: string,
  style: "render" | "flat" = "render",
): string {
  const palette = template.palette?.colours ?? {};
  const skin = palette.peach ?? "#f3c7a0";
  const fish = palette.periwinkle ?? "#8090e0";
  const ink = palette.black ?? "#1f1f1f";
  const stroke = style === "flat" ? ` stroke="${ink}" stroke-width="3"` : "";
  const el = (tag: string, attrs: string, fill: string) => `<${tag} ${attrs} fill="${fill}"${stroke}/>`;

  const top = partColour(spec, "top", spec.colour);
  const trousers = partColour(spec, "trousers", palette.navy ?? "#2d3f6b");
  const boots = partColour(spec, "boots", palette["dark brown"] ?? "#3f2a1d");
  const hair = partColour(spec, "hair", palette["dark brown"] ?? "#3f2a1d");
  const beard = partColour(spec, "facial_hair", hair);
  const hat = partColour(spec, "headwear", palette.red ?? "#c8442f");
  const out: string[] = [];

  // Boots, legs, body
  out.push(el("rect", `x="184" y="402" width="52" height="38" rx="14"`, boots));
  out.push(el("rect", `x="244" y="402" width="52" height="38" rx="14"`, boots));
  if (has(spec, "trousers", /shorts/)) {
    out.push(el("rect", `x="196" y="370" width="88" height="36" rx="10"`, skin));
    out.push(el("rect", `x="190" y="340" width="100" height="36" rx="12"`, trousers));
  } else {
    out.push(el("rect", `x="190" y="340" width="100" height="66" rx="12"`, trousers));
  }
  const gilet = has(spec, "top", /gilet/);
  out.push(el("rect", `x="168" y="240" width="144" height="122" rx="42"`, gilet ? (palette.cream ?? "#efe4cc") : top));
  if (gilet) {
    out.push(el("rect", `x="168" y="240" width="48" height="122" rx="20"`, top));
    out.push(el("rect", `x="264" y="240" width="48" height="122" rx="20"`, top));
  }

  // Head
  out.push(el("circle", `cx="150" cy="180" r="16"`, skin), el("circle", `cx="330" cy="180" r="16"`, skin));
  if (has(spec, "hair", /long|ponytail/)) out.push(el("rect", `x="140" y="120" width="200" height="140" rx="60"`, hair));
  out.push(el("circle", `cx="240" cy="170" r="94"`, skin));
  if (has(spec, "hair") && !has(spec, "hair", /bald/)) {
    out.push(el("path", `d="M150 165 Q150 80 240 76 Q330 80 330 165 Q300 115 240 112 Q180 115 150 165 Z"`, hair));
    if (has(spec, "hair", /bun/)) out.push(el("circle", `cx="240" cy="70" r="34"`, hair));
    if (has(spec, "hair", /curly/)) {
      for (const [x, y] of [[152, 150], [165, 118], [195, 96], [285, 96], [315, 118], [328, 150]]) {
        out.push(el("circle", `cx="${x}" cy="${y}" r="17"`, hair));
      }
    }
  }
  if (has(spec, "jewellery")) {
    const gold = partColour(spec, "jewellery", palette.mustard ?? "#e5ad2f");
    out.push(`<circle cx="150" cy="208" r="11" fill="none" stroke="${gold}" stroke-width="6"/>`);
    out.push(`<circle cx="330" cy="208" r="11" fill="none" stroke="${gold}" stroke-width="6"/>`);
  }

  // Face
  out.push(`<circle cx="205" cy="182" r="11" fill="${ink}"/><circle cx="275" cy="182" r="11" fill="${ink}"/>`);
  out.push(`<circle cx="240" cy="205" r="8" fill="#e3a982"/>`);
  if (has(spec, "facial_hair", /beard/)) {
    out.push(el("path", `d="M158 190 Q160 270 240 272 Q320 270 322 190 Q300 222 240 222 Q180 222 158 190 Z"`, beard));
  }
  if (has(spec, "facial_hair", /beard|moustache/)) {
    out.push(el("path", `d="M206 228 Q222 210 240 222 Q258 210 274 228 Q256 236 240 228 Q224 236 206 228 Z"`, beard));
  }
  if (has(spec, "scarf")) out.push(el("ellipse", `cx="240" cy="262" rx="78" ry="20"`, partColour(spec, "scarf", "#c8442f")));
  if (has(spec, "eyewear", /sun/)) {
    out.push(el("rect", `x="180" y="168" width="50" height="30" rx="10"`, ink), el("rect", `x="250" y="168" width="50" height="30" rx="10"`, ink));
    out.push(`<rect x="228" y="176" width="24" height="5" fill="${ink}"/>`);
  } else if (has(spec, "eyewear")) {
    const frame = partColour(spec, "eyewear", palette.red ?? "#c8442f");
    out.push(`<circle cx="205" cy="182" r="24" fill="none" stroke="${frame}" stroke-width="6"/>`);
    out.push(`<circle cx="275" cy="182" r="24" fill="none" stroke="${frame}" stroke-width="6"/>`);
    out.push(`<path d="M229 180 Q240 172 251 180" fill="none" stroke="${frame}" stroke-width="6"/>`);
  }

  // Headwear
  const headwear = spec.attributes.headwear?.description ?? "none";
  if (/sou'wester/.test(headwear)) {
    out.push(el("ellipse", `cx="240" cy="118" rx="140" ry="26"`, hat), el("path", `d="M160 118 Q165 50 240 46 Q315 50 320 118 Z"`, hat));
  } else if (/captain/.test(headwear)) {
    out.push(el("path", `d="M150 110 Q150 46 240 44 Q330 46 330 110 Z"`, palette.white ?? "#f5f2ea"));
    out.push(el("rect", `x="152" y="100" width="176" height="24" rx="8"`, ink));
    out.push(el("ellipse", `cx="240" cy="126" rx="80" ry="10"`, ink));
    out.push(`<text x="240" y="90" text-anchor="middle" font-size="30" fill="${ink}">⚓</text>`);
  } else if (/flat cap/.test(headwear)) {
    out.push(el("path", `d="M146 120 Q150 62 240 58 Q330 62 334 120 Z"`, hat), el("ellipse", `cx="240" cy="122" rx="104" ry="14"`, hat));
  } else if (/cap/.test(headwear)) {
    out.push(el("path", `d="M148 122 Q150 50 240 48 Q330 50 332 122 Z"`, hat), el("ellipse", `cx="200" cy="124" rx="96" ry="14"`, hat));
  } else if (/beanie|bobble/.test(headwear)) {
    out.push(el("path", `d="M146 128 Q146 44 240 40 Q334 44 334 128 Z"`, hat));
    out.push(el("rect", `x="140" y="108" width="200" height="30" rx="12"`, hat));
    if (/bobble/.test(headwear)) out.push(el("circle", `cx="240" cy="38" r="22"`, palette.cream ?? "#efe4cc"));
  }

  // The fish, held in front with both hands. Locked: same on every figure.
  out.push(el("path", `d="M346 304 L400 270 L392 304 L400 338 Z"`, fish));
  out.push(el("ellipse", `cx="246" cy="304" rx="118" ry="40"`, fish));
  out.push(`<circle cx="152" cy="296" r="6" fill="${ink}"/>`);
  out.push(
    `<text x="252" y="312" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="22" fill="#5f6fc0">${escapeXml(wordmark)}</text>`,
  );
  out.push(el("circle", `cx="178" cy="336" r="18"`, skin), el("circle", `cx="314" cy="336" r="18"`, skin));

  const flat = style === "flat";
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" width="480" height="480">`,
    `<rect width="480" height="480" fill="${flat ? "#ffffff" : "#f6efe6"}"/>`,
    flat ? "" : `<ellipse cx="240" cy="444" rx="96" ry="10" fill="#000" opacity="0.12"/>`,
    out.join(""),
    `<text x="16" y="28" font-family="sans-serif" font-size="12" fill="#999">${flat ? "MOCK MANUFACTURING REFERENCE" : "MOCK PREVIEW"}</text>`,
    `</svg>`,
  ].join("");
}

// ---- 3D ----

/**
 * Radius profile (mm) of a turned stand-in for the figure: boots, legs, body with the fish,
 * neck, big head, hat. Height comes from the template. Wide hats widen the top.
 */
export function figurineProfile(spec: DesignSpec, template: ProductTemplate): { height: number; radiusAt: (t: number) => number } {
  const height = lockedValue(template, "height") ?? 100;
  const headwear = spec.attributes.headwear?.description ?? "none";
  const points: [number, number][] = [
    [0, 21], [0.08, 21], [0.09, 16], [0.3, 16], [0.32, 26], [0.45, 30], [0.56, 28], [0.6, 18],
    [0.64, 26], [0.77, 31], [0.88, 26],
  ];
  if (/sou'wester/.test(headwear)) points.push([0.89, 36], [0.91, 36], [0.92, 22], [0.98, 12]);
  else if (/cap|captain/.test(headwear)) points.push([0.89, 30], [0.9, 30], [0.91, 24], [0.98, 12]);
  else if (headwear !== "none") points.push([0.92, 24], [0.98, 14]);
  else points.push([0.94, 20], [0.98, 10]);
  points.push([1, 0.5]);
  return {
    height,
    radiusAt(t) {
      for (let i = 1; i < points.length; i++) {
        const [t1, r1] = points[i]!;
        const [t0, r0] = points[i - 1]!;
        if (t <= t1) return r0 + ((r1 - r0) * (t - t0)) / (t1 - t0 || 1);
      }
      return points.at(-1)![1];
    },
  };
}
