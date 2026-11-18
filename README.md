# Fishbelly

AI product customisation: prompt → 2D preview → revisions → approval → 3D model → validation → production file.

Architecture and reasoning: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Run it

```bash
pnpm install
pnpm test        # constraint + pipeline tests
pnpm demo        # the whole journey in the terminal
pnpm dev         # http://localhost:3000
```

Everything runs on mock providers by default: no keys, no database, no cost.

| URL | What |
| --- | --- |
| `/studio` | Standalone customer experience |
| `/embed-demo.html` | A pretend brand page that opens the embed |
| `/embed/demo?product=vase_001` | The embed itself |
| `/admin/designs` | Every design, step by step (**no auth yet**) |

Local data lives in `apps/web/.data/` (delete it to reset).

## Layout

| Path | What |
| --- | --- |
| `packages/core` | Product templates, `DesignSpec`, constraint and validation rules. No dependencies. |
| `packages/pipeline` | Pipeline steps, job recording, stores, provider adapters and mocks. |
| `apps/web` | Next.js: studio, embed, admin, API routes, `public/embed.js`. |
| `services/geometry` | Python service that measures meshes (trimesh). |
| `db/schema.sql` | Postgres schema for the move to Supabase. |

## State of things

**Working and tested** (`pnpm test`, `pnpm demo`): `packages/core`, `packages/pipeline` on mocks.

**Written but not yet run** (no package installs were possible where this was scaffolded):

- `apps/web` — first job is `pnpm install && pnpm dev` and fix whatever comes up.
- `services/geometry` — needs `pip install -r requirements.txt`, then test against known meshes.
- `providers/claude.ts` — set `FISHBELLY_INTERPRETER=claude` and `ANTHROPIC_API_KEY`.

**Not built yet:** Meshy adapter, image model, Inngest, Supabase, Stripe, scale/base-merge/repair,
embed session tokens, auth, rate limits. See the milestones in the architecture doc.

The vase dimensions in `packages/core/src/template.ts` are placeholders.
