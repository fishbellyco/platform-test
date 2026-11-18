# FISHBELLY — PLATFORM ARCHITECTURE

**Status:** proposed, v0.1 (15 Nov 2026)
**Companion to:** `FISHBELLY_PLATFORM_BUILD_CONTEXT.md`
**Repo scaffold:** matches this doc; anything not yet built is marked *(next)*

---

## 1. Core decision

- **Weavy stays the lab. Production runs as code.**
- Each Weavy node becomes one typed pipeline step in the repo.
- Why: per-step logs, retries, rerun-from-failed-step, cost tracking, everything in git.
- New models and prompts are trialled in Weavy, then copied into the code.
- Not yet done: mapping the existing Weavy flow node by node (the flow is login-only, so it needs a screenshot or node list).

## 2. Stack

- **App:** one Next.js app (TypeScript, Tailwind).
  - `/studio` standalone, `/embed/[brand]` iframe version, `/admin` internal view.
  - All three sit on the same core and pipeline.
- **Embed:** `embed.js` opens the iframe and returns `design_id` to the brand page by `postMessage`. Brand keeps checkout.
- **Data:** Postgres + file storage on Supabase *(next — scaffold uses a local JSON store behind the same interface)*.
- **Workflows:** Inngest wraps the pipeline steps once real providers are in *(next — scaffold runs steps in-process)*.
- **Geometry worker:** Python (FastAPI, trimesh). It only **measures** meshes.
- **Providers,** each behind an interface, each with a mock:
  - LLM for prompt interpretation (Claude)
  - image model for previews (not yet chosen)
  - Meshy for 3D
- **Payments:** Stripe for standalone *(next)*. Brand checkout for embedded.

## 3. Pipeline

1. **Interpret** — LLM turns the prompt into a proposed `DesignSpec` (JSON).
2. **Enforce** — code checks the spec against the product template. Locked parts are kept, out-of-range values clamped, non-permitted features dropped. The customer is told what was kept and why.
3. **Preview** — image model renders the spec, guided by a reference render of the template.
4. **Refine** — each follow-up prompt changes the spec, not the conversation. The image model edits the last preview.
5. **Approve** — creates an immutable `ApprovedDesign`. Payment follows.
6. **3D** — Meshy image-to-3D from the approved preview (multi-view if available).
7. **Geometry** — scale to template, merge the fixed base, measure, validate.
8. **Gate** — `production_ready`, `needs_review` or `failed`. Only `production_ready` goes to a manufacturer automatically.
9. **Route by method:**
   - plastic → STL / 3MF to the printer
   - precious metal → print-ready master for the mould, scaled for shrinkage
   - embroidery → separate 2D vector + stitch-file path, no Meshy
10. **Handoff** — production pack (file, specs, order reference).

## 4. Where constraints are enforced

- **Before generation:** `enforceConstraints()` in `packages/core`. The LLM proposes, code decides.
- **After generation:** `evaluateMeasurements()` in `packages/core`. Same template, same rules.
- **One rule set.** The Python worker returns numbers only; pass/fail lives in one place.
- **Unknown is not a pass.** A check that could not be run gives `needs_review`, never `production_ready`.
- **Long term:** build the final mesh from trusted base geometry plus the generated part, rather than trusting the generator with dimensions.

## 5. Debugging

- Every step writes a `generation_jobs` row: input, output, provider, cost, duration, error.
- `/admin/designs/[id]` shows the whole timeline for one design.
- Prompts and model choices live in the repo.
- Mock mode runs the whole journey for free (`pnpm demo`, `pnpm test`).
- *(next)* rerun-from-step button, Sentry, Langfuse, 3D viewer in admin.

## 6. Data model

- `brands`, `product_templates` (versioned)
- `design_sessions` → `design_versions` → `approved_designs` (immutable)
- `generation_jobs` (one per step run)
- `manufacturing_assets` (file + measurements + check results)
- `order_references` *(next)*

## 7. Repo layout

- `apps/web` — Next.js: studio, embed, admin, API routes, `public/embed.js`
- `packages/core` — templates, `DesignSpec`, constraint and validation rules (no dependencies)
- `packages/pipeline` — steps, job recording, stores, provider adapters and mocks
- `services/geometry` — Python measuring service
- `db/schema.sql` — Postgres schema
- `scripts/demo.ts` — full journey in the terminal

## 8. Main risks

- **2D → 3D drift.** The customer approves an image; the mesh may differ.
  - Mitigations: reference render in every preview, multi-view input to Meshy, render the finished mesh and compare with the approved image before release.
- **Dimensions.** Meshy output has no reliable scale or wall thickness. Handled by step 7, never by prompting.
- **Cost.** Revisions are cheap (images); 3D runs only after approval and payment. Cap revisions per session.
- **Embroidery** is a different product pipeline. Decide whether it is in the first release.

## 9. Confirmed, proposed, open

- **Confirmed (from the build context):** prompt + viewport UI, 2D approval before 3D, constraints enforced in code, swappable providers, one core for standalone and embed, modular monolith.
- **Proposed here:** Supabase, Inngest, Python measuring service, rules in TypeScript, Stripe.
- **Open:**
  - Which image model for previews?
  - First real product and its true dimensions (vase values are placeholders)
  - Manufacturer file formats and tolerances
  - Does the embed session start from a signed token issued by the brand's server?
  - Is embroidery in the first release?

## 10. Milestones

1. **Mock journey end to end** — prompt → preview → refine → approve → mesh → validation. *Scaffolded.*
2. **Real preview** — Claude interpreter + chosen image model.
3. **Real 3D** — Meshy adapter, Inngest, Supabase.
4. **Real geometry** — scale, base merge, wall thickness, repair/regenerate loop.
5. **Embed with a real brand** — signed sessions, theming, cart handoff.
6. **Hardening** — auth, tenant isolation, quotas, monitoring.
