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

/** Printable colours. Weavy asked for this in the prompt ("only 4 colours"); here it is enforced. */
export interface Palette {
  /** Name -> hex. Customer colours are snapped to the nearest of these. */
  colours: Record<string, string>;
  /** Colours every figure uses whatever the customer asks (e.g. the face, the brand fish). */
  fixed: string[];
  /** Name of the main colour when none is chosen. */
  default: string;
  /** Most distinct colours one product may use, fixed ones included. */
  maxColours: number;
}

/**
 * The text sent to each generation step. Product-specific, so it lives here, not in pipeline code.
 * `{{wordmark}}` is replaced with the brand's wordmark. The customer's own words are never pasted
 * in: the pipeline appends a description of the enforced spec instead (see prompts.ts).
 */
export interface TemplatePrompts {
  /** Image model: renders the design the customer sees and approves. */
  preview: string;
  /** Image model: turns the approved render into a clean reference for 3D. Null = skip the step. */
  manufacturingReference: string | null;
  /** Image-to-3D model. */
  model3d: string;
}

export interface ProductTemplate {
  id: string;
  version: number;
  name: string;
  category: string;
  /** Shown as the placeholder in the prompt box. */
  examplePrompt: string;
  manufacturingMethod: ManufacturingMethod;
  units: "mm";
  dimensions: Record<string, DimensionRule>;
  /** Attribute name -> may the customer customise it? Anything absent is not allowed. */
  customisation: Record<string, boolean>;
  /** Starting design before the customer says anything. Keys must be customisable. */
  defaults: Record<string, { description: string; colour?: string }>;
  palette: Palette | null;
  prompts: TemplatePrompts;
  /** Images that define the product's look, sent to the image model. Keys under assets/references/. */
  referenceImages: string[];
  validation: {
    toleranceMm: number;
    requireWatertight: boolean;
    /** One connected piece: nothing floating, nothing that falls off. */
    requireSinglePiece: boolean;
  };
}

// PLACEHOLDER VALUES. Replace with the real product's specification.
const vase001: ProductTemplate = {
  id: "vase_001",
  version: 1,
  name: "Organic Vase",
  category: "homeware",
  examplePrompt: "An ocean-wave texture, slightly asymmetric…",
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
  defaults: {},
  palette: null,
  prompts: {
    preview:
      "A studio product photograph of a 3D-printed ceramic-look vase on a seamless warm off-white " +
      "background, soft daylight, gentle contact shadow, no other objects and no text. " +
      "The vase is described below; follow it exactly.",
    manufacturingReference: null,
    model3d:
      "A single watertight solid vase matching the reference image: same silhouette, proportions and " +
      "surface texture. Flat circular base. Smooth, printable forms with no fragile detail.",
  },
  referenceImages: [],
  validation: { toleranceMm: 0.5, requireWatertight: true, requireSinglePiece: true },
};

// The brand-agnostic example: a chibi fisherman holding a fish that carries the brand's wordmark.
// Customers personalise the character; the pose, the fish and the wordmark never change.
// PLACEHOLDER VALUES: size, palette and limits are guesses until the print spec is confirmed.
// Prompts are adapted from the Weavy flow (docs/WEAVY_FLOW.md) and not yet trialled there.
const fisherman001: ProductTemplate = {
  id: "fisherman_001",
  version: 1,
  name: "Fisherman Figurine",
  category: "figurine",
  examplePrompt: "A red beanie, a big curly beard and a yellow raincoat…",
  manufacturingMethod: "3d_printing",
  units: "mm",
  dimensions: {
    height: { kind: "locked", value: 100 },
    base_diameter: { kind: "minimum", value: 35 }, // footprint of the boots: stands without tipping
    max_diameter: { kind: "maximum", value: 80 }, // fits the packaging
    wall_thickness: { kind: "minimum", value: 1.2 },
  },
  customisation: {
    headwear: true,
    hair: true,
    facial_hair: true,
    eyewear: true,
    scarf: true,
    jewellery: true,
    top: true,
    trousers: true,
    boots: true,
    fish: false,
    wordmark: false,
    pose: false,
    props: false,
    face: false,
    body_shape: false,
  },
  defaults: {
    headwear: { description: "knitted beanie", colour: "red" },
    hair: { description: "short curly hair", colour: "dark brown" },
    facial_hair: { description: "full beard", colour: "dark brown" },
    top: { description: "raincoat", colour: "mustard" },
    trousers: { description: "trousers", colour: "navy" },
    boots: { description: "chunky boots", colour: "dark brown" },
  },
  palette: {
    colours: {
      red: "#c8442f",
      orange: "#e07a2e",
      mustard: "#e5ad2f",
      olive: "#7b8b3a",
      green: "#4f7f52",
      navy: "#2d3f6b",
      blue: "#4a78b8",
      periwinkle: "#8090e0",
      brown: "#7a4b2a",
      "dark brown": "#3f2a1d",
      cream: "#efe4cc",
      white: "#f5f2ea",
      grey: "#8e8e8e",
      black: "#1f1f1f",
      peach: "#f3c7a0",
    },
    fixed: ["peach", "periwinkle", "black"], // face and hands, the fish, the eyes
    default: "mustard",
    maxColours: 8,
  },
  prompts: {
    preview: [
      "Create a premium collectible figurine of a fisherman character, photographed as a finished physical product.",
      "Style: a soft, rounded chibi character with an oversized head, a small sturdy body and short legs, simple glossy dot eyes, small eyebrows, a small round nose and a calm, friendly expression. It looks hand-sculpted from smooth matte clay or soft vinyl: chunky readable forms, rounded edges, clean colour blocking and no fine surface detail.",
      'Fixed on every figure: the character stands upright with feet together in chunky boots, holding a large fish horizontally in front of their body with both hands. The fish is periwinkle blue with rounded fins and the wordmark "{{wordmark}}" in raised capital letters along its side. Keep the pose, the fish, the wordmark, the face style and the body proportions exactly as in the reference image.',
      "The personalisation below applies only to the hat, hair, facial hair, glasses, scarf, jewellery and clothing. Use exactly the colours given.",
      "Show the whole figure in a front three-quarter view, centred, on a seamless warm off-white background with soft studio lighting and a soft contact shadow. No other objects and no text apart from the wordmark on the fish.",
    ].join("\n"),
    manufacturingReference: [
      "Transform this render into a manufacturing reference image optimised for AI 3D reconstruction.",
      "Preserve the character exactly: the same silhouette, proportions, pose, fish, wordmark, clothing, accessories and colours. Do not redesign, reinterpret or restyle anything.",
      "Show the figure straight from the front, full body, centred, on a plain white background with flat, even lighting and no shadows.",
      "Geometry: one solid piece with every part physically connected. Thick limbs. Hat brims, glasses and earrings thickened so nothing is fragile. No floating parts. Flat-bottomed boots that stand stably.",
      "Surface: smooth. No fine wrinkles, stitching, fabric texture or individual hair strands. Keep the wordmark letters large and raised.",
      "Colour: flat, solid regions with crisp boundaries, using only the colours already in the image.",
    ].join("\n"),
    model3d: [
      "Create a single watertight, manifold collectible figurine matching the reference image exactly.",
      "Preserve the silhouette, proportions, pose, clothing, accessories, facial features and the fish with its raised wordmark.",
      "Use smooth, rounded geometry with thick printable forms, avoiding fragile micro-detail. Every part is physically connected. Flat base under the boots so it stands upright.",
      "Preserve the colour regions and their boundaries as shown in the reference image.",
    ].join("\n"),
  },
  referenceImages: ["fisherman_001/lineup.jpg"],
  validation: { toleranceMm: 0.5, requireWatertight: true, requireSinglePiece: true },
};

const TEMPLATES: Record<string, ProductTemplate> = { [vase001.id]: vase001, [fisherman001.id]: fisherman001 };

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

/** Palette entry name for a hex value, if it is one. */
export function colourName(template: ProductTemplate, hex: string): string | null {
  const entry = Object.entries(template.palette?.colours ?? {}).find(([, value]) => value === hex);
  return entry ? entry[0] : null;
}

export function label(key: string): string {
  return key.replace(/_/g, " ");
}
