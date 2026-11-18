# Fishbelly — working notes for Claude Code

Read `docs/ARCHITECTURE.md` first. `README.md` says what is tested and what has never been run. `apps/web/AGENTS.md` is
written by `next dev`; it points at the bundled Next 16 docs in `node_modules/next/dist/docs/`.

## Commands

- `pnpm test` — must stay green
- `pnpm typecheck` — core + pipeline
- `pnpm demo` — full journey on mocks in the terminal
- `pnpm dev` — web app on :3000

## Rules that must not be broken

1. **Constraints are enforced in code, never by prompting.** Anything an AI returns goes
   through `enforceConstraints()` before generation, and every mesh goes through
   `evaluateMeasurements()` before release. Both live in `packages/core`.
2. **Unknown is not a pass.** A check that couldn't run means `needs_review`.
3. **Every provider call goes through `runStep()`** in `packages/pipeline/src/pipeline.ts`
   so it is recorded as a generation job.
4. **Providers sit behind the interfaces in `providers/types.ts`**, each with a mock. No
   provider names outside `packages/pipeline/src/providers`.
5. **Approved designs are immutable.**
6. **Product specifics live in the template**, not in pipeline code.
7. **One core, two front doors.** `/studio` and `/embed` both render `components/Studio.tsx`.
8. **The customer UI is a prompt box and a preview.** No sliders, no 3D editor, no technical settings.
9. `packages/core` stays dependency-free and browser-safe (no Node imports).

## Next up

1. Map the Weavy flow's nodes onto pipeline steps; note the models and settings it uses.
2. Turn on the Claude interpreter; pick and add the image model behind `PreviewGenerator`.
3. Meshy adapter from Meshy's current API docs + Inngest for the production workflow.
4. Supabase: apply `db/schema.sql`, write `PostgresStore` and a storage-backed `AssetStorage`.
