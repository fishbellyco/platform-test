# Weavy flow → pipeline steps

**Source:** two screenshots of the read-only Weavy workflow (vinyl-figurine mascot, Nov 2026).
**Status:** mapped, and rebuilt in code around the **fisherman figurine** (`fisherman_001`), the
brand-agnostic example, instead of the pickle. See §7. Runs on mocks; the real image and 3D
providers are not connected yet.
Prompt text is transcribed from the screenshots; where a node's text runs off the screen it says *[cut off]*.

---

## 1. What the flow does

```
Brand Prompt ─┐
Product Prompt ┼─ Prompt Concatenators ─► Nano Banana 2 ─► concept render ─┐
User Prompt ──┘                            ▲                               │
Brand reference image ─────────────────────┘                               │
                                                                           ▼
                        Manufacturing Prompt ─────────────────────► Nano Banana 2 ─► manufacturing reference
                                                                                          │
                        Meshy Prompt ─────────────────────────────────────────────► Meshy V6 ◄┘
                                                                                          │
                                                                                       Export
```

## 2. Nodes

| Weavy node | Kind | Model / settings | Inputs → output |
| --- | --- | --- | --- |
| **Brand Prompt** | text | – | Mascot identity, style and palette (text in §4.1) |
| **Product Prompt** | text | – | What a vinyl figurine is (§4.2) |
| **User Prompt** | text | – | "The pickle is standing on a skateboard wearing a varsity jacket and cap." |
| **Reference image** | image | – | `Screenshot 2026-07-13 at 11.38.02.png`: the mascot in a deck chair, flat 2D artwork |
| **Prompt Concatenator** ×5 | text join | – | Chains of Brand + Product + User (+ one input from a Prompt node below the visible area) |
| **Gemini 3.1 Flash (Nano Banana 2)**: concept render, variant A | image | not visible | Prompt + reference image → grey-background render. **Output not connected**: looks like an experiment. |
| **Gemini 3.1 Flash (Nano Banana 2)**: concept render, variant B | image | not visible | Prompt + reference image → white-background render. **This is the production path.** |
| **Prompt**: manufacturing | text | – | §4.3 |
| **Gemini 3.1 Flash (Nano Banana 2)**: manufacturing reference | image | not visible | Variant B render + manufacturing prompt → simplified front view, flat colour |
| **Prompt**: Meshy | text | – | §4.4 |
| **Meshy V6** | image → 3D | Only the viewer shows (75° FOV, 1024×1024 viewport); generation settings are not visible | Three inputs: image (**unconnected**), prompt (Meshy prompt), image (manufacturing reference) |
| **Export** | file | – | Meshy model output |

## 3. Mapping onto the pipeline

| Pipeline step (`JobKind`) | Weavy equivalent | What changes in code |
| --- | --- | --- |
| `interpret` | *none* | Weavy pastes the raw user prompt into the image prompt. We turn it into a `DesignSpec` first. |
| *(enforce, no job)* | *none* | `enforceConstraints()` decides what's allowed **before** any image is generated. |
| `preview` | Concatenators + Nano Banana (variant B) | Image prompt = brand prompt + product prompt + the **enforced spec**, not the raw user text. Image input = brand reference image (+ the previous preview when refining). |
| *(approve)* | *none* | Customer approves one version; it becomes immutable. |
| `manufacturing_reference` **(new)** | Nano Banana + manufacturing prompt | New step between approval and 3D, recorded through `runStep()` like the others. |
| `model_3d` | Meshy V6 + Meshy prompt | Meshy adapter behind `ModelGenerator`; input = manufacturing reference image + prompt. |
| `geometry` | *none* | Scale to template, measure, `evaluateMeasurements()`. Weavy has no check at all. |
| *(gate + export)* | Export | Only `production_ready` exports automatically. |

**Where each piece belongs** (rule 6: product specifics in the template, not pipeline code):

- **Brand prompt and brand reference image:** the client's **brand**, which sits in that client's
  workspace. A second client brings its own mascot and prompt without touching code.
- **Product prompt, manufacturing prompt and Meshy prompt:** the **product template** (a new
  `vinyl_figurine` template, with a `prompts` block).
- **Model choice and settings:** the provider adapters (`providers/nanoBanana.ts`, `providers/meshy.ts`).

## 4. Prompts (as transcribed)

### 4.1 Brand prompt
> Use the supplied reference image as the definitive source of truth for the character's identity. Preserve the mascot's recognizable visual DNA in every generation.
> The mascot is an anthropomorphic dill pickle with an elongated, slightly irregular body, rounded ends, subtle pickle bumps, thin cartoon limbs, oversized hands and feet, angular dark sunglasses, and a relaxed, confident personality. The character should always feel laid-back, humorous, slightly smug, and effortlessly cool.
> Maintain a retro American snack-brand aesthetic translated into a premium designer collectible. The design language should be bold, simple, iconic, and instantly recognizable from its silhouette. Favor clean proportions, restrained detailing, and timeless character design over realism or excessive stylization.
> Use only the established brand color palette consisting of rich pickle greens with darker and lighter green variation, black, white, neutral gray, and small red accents where appropriate. Preserve clean color blocking and avoid introducing unnecessary colors.
> The mascot should always feel playful, nostalgic, and premium while remaining unmistakably the same character regardless of clothing, pose, or accessories.
> Never change the core body proportions, facial identity, sunglasses, personality, or overall silhouette.

### 4.2 Product prompt
> Create a premium 3D collectible vinyl figurine based on the established brand style.
> Interpret the mascot as a physical designer toy rather than a 3D illustration. The sculpt should feature soft rounded geometry, simplified forms, subtle organic asymmetry, gentle pickle texture, and manufacturing-friendly proportions. Every element should feel intentionally designed for collectible vinyl production.
> Use a matte or soft satin vinyl material with crisp paint separation, minimal surface detail, and clean sculpting.
> Preserve the character's iconic elongated pickle form, signature sunglasses, thin limbs, oversized hands and feet, and relaxed proportions.
> The figure should appear as a professionally photographed collectible product with studio-quality lighting, a seamless neutral background, soft shadows, and premium product photography. The render should emphasize the sculpt, materials, and craftsmanship while keeping the focus entirely on the collectible.
> Do not determine the character's pose, clothing, accessories, props, expression, or activity. These elements will be provided separately and should be incorporated while preserving the established brand identity and collectible design language.
>
> No trademark symbols or text. Only 4 colours allowed across *[cut off]*

### 4.3 Manufacturing prompt
> Transform this 3D render into a manufacturing reference image optimised for AI 3D reconstruction.
> Preserve the character's identity exactly. Do not redesign, reinterpret or stylise the character. Maintain the same silhouette, proportions, clothing, accessories, facial expression and overall design.
> The output should represent the physical figurine as if it were a professionally manufactured vinyl collectible prepared for digital 3D reconstruction.
> Geometry
> Simplify the sculpt into clean manufacturing geometry.
> Smooth rounded vinyl surfaces. Large readable forms. Thick printable proportions. Soft continuous transitions. Oversized hands and feet. Thick limbs. Integrated clothing. All components physically connected. Stable centre of gravity. No floating objects.
> Surface Detail
> Remove unnecessary surface detail.
> Do not include:
> Fine wrinkles *[cut off]*

### 4.4 Meshy prompt
> Create a watertight collectible vinyl figurine matching the supplied reference images exactly.
> Preserve the silhouette, proportions, clothing, sunglasses, cap, expression and accessories.
> Use smooth rounded vinyl geometry with thick printable forms.
> Keep all major sculpted details while avoiding fragile micro-details.
> Produce a clean manifold mesh suitable for physical manufacture.
> Use exactly four colour regions: green, white, red and black.
> Preserve the colour boundaries shown in this reference image.

## 5. Constraints Weavy enforces only by prompting

Rule 1 says these must become code. The screenshots already show prompting falling short: variant A's
cap appears to carry the brand wordmark despite "No trademark symbols or text", and the Meshy
preview seems to have lost the skateboard and turned the jacket sleeves into white tubes.

| Prompt instruction | In code | Before / after generation |
| --- | --- | --- |
| Four colours: green, white, red, black | Template palette; the spec may only use palette colours | before (`enforceConstraints`) |
| …and the mesh has exactly those four regions | Count colour regions on the textured mesh | after; `not_checked` until the measurer can |
| Watertight, manifold | Already measured | after |
| Thick limbs, printable | Minimum wall thickness / feature size | after (geometry service) |
| All components connected, no floating objects | Connected-component count = 1 | after (trimesh, easy) |
| Stable centre of gravity | Centre of mass inside the base footprint | after (trimesh) |
| No trademark symbols or text | Can't be verified in code | always a manual review check → `needs_review` |
| Size of the figurine | Template dimensions (height, base) | both; **values unknown** |

## 6. Open questions (from the pickle flow)

1. **What does the customer approve?** Meshy builds from the *manufacturing reference*, not the
   render the customer approved, and the two visibly differ. That's a second 2D→3D drift point.
   Recommendation: generate the manufacturing reference when the customer clicks Approve, and show
   it as the final confirmation ("this is what we'll make"). Then approval and 3D input are the same image.
2. **Is variant B the canonical path?** Variant A's output isn't connected to anything.
3. **The prompt node below the visible area** feeds the last concatenator on the production path. What does it say?
4. **Cut-off text:** the rest of the product prompt ("Only 4 colours allowed across…") and the
   manufacturing prompt ("Do not include: Fine wrinkles…").
5. **Settings not visible:** Nano Banana (aspect ratio, resolution) and Meshy V6 (topology, polycount,
   texture/PBR, symmetry). Also, what is Meshy's unconnected first image input for (multi-view)?
   Opening each node's settings, or exporting the workflow, would answer this.
6. **The brand reference image** is a screenshot of flat artwork. Is there an original file, and are there more views?
7. **Product spec:** figurine height, base and tolerances. And is it rotocast vinyl (needs a master
   and shrinkage) or printed? This is the "first real product" open question in the architecture doc.

## 7. The same flow, built for the fisherman

The pickle flow told us the steps; the product is now the fisherman figurine: a chibi character
holding a fish that carries the brand's wordmark. Customers personalise the character. The fish,
wordmark, pose, face style and size are locked. Brand-agnostic: each brand supplies its own wordmark.

| Weavy piece | Where it is now |
| --- | --- |
| Brand prompt | `Brand.prompt` (empty for now: the house style is the product's) and `Brand.wordmark` (`FISHBELLY`, `DEMO BRAND`) in `core/src/brands.ts` |
| Product prompt | `fisherman_001.prompts.preview` in `core/src/template.ts`, with `{{wordmark}}` |
| Reference image | `assets/references/fisherman_001/lineup.jpg`, listed in `referenceImages` |
| User prompt | Interpreter → `enforceConstraints()` → `describeSpec()`. The customer's words never reach the image model |
| Prompt Concatenator | `composePrompts()` in `core/src/prompts.ts`: brand prompt + product prompt + enforced spec |
| Nano Banana (concept render) | `preview` step, `PreviewGenerator` (mock today) |
| Manufacturing prompt + Nano Banana | `manufacturing_reference` step, `ReferenceGenerator`; runs only if the template has the prompt (the vase doesn't) |
| Meshy prompt + Meshy V6 | `model_3d` step: `ModelGenerator` gets the manufacturing reference + `prompts.model3d` |
| Export | Only after the geometry gate |

**Constraints that were prompt-only in Weavy, now in code:**

| Was | Now |
| --- | --- |
| "Only 4 colours" / "exactly four colour regions" | `palette`: colours snap to the printable palette; at most `maxColours` (8, placeholder) including the fixed peach, periwinkle and black |
| Fixed character identity | `customisation`: `fish`, `wordmark`, `pose`, `props`, `face`, `body_shape` are `false` and get dropped with a note |
| Size | `height` locked at 100 mm (placeholder), checked on the mesh |
| "Stable centre of gravity" | `base_diameter` minimum 35 mm (boot footprint). Centre of mass: not yet |
| "All components physically connected, no floating objects" | `single_piece` check: connected pieces counted on the mesh (TS measurer and Python service) |
| "Watertight, manifold" | `watertight` check (already there) |
| "Thick printable forms" | `wall_thickness` minimum 1.2 mm: `not_checked` until the Python service runs, so `needs_review` |

**Still open for the fisherman:**
1. Real print spec: height, footprint, wall thickness, tolerances, colour count (AMS slots), and the
   palette's actual filament colours. All values in the template are placeholders.
2. Prompts are adapted from the pickle flow and not yet trialled. Run them through Weavy with the
   lineup as the reference image, then copy the winners back into the template.
3. The MakerWorld "Fisherman" (by Stone) shown as a reference is someone else's design. Check its
   licence before using its geometry for anything commercial; the lineup is Fishbelly's own.
4. Approval question from §6.1 still stands: the customer approves the render, Meshy builds from the
   manufacturing reference. The admin design page now shows the two side by side.
5. Wordmark length: the fish fits about 10–12 characters. Brands are configured by us, so not
   enforced yet; it needs a rule once brands can be added from a screen.
