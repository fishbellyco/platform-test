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
| `/studio` | Standalone customer experience: personalise the fisherman figurine |
| `/embed-demo.html` | A pretend brand page that opens the embed |
| `/embed/demo?product=vase_001` | The embed itself (also `?product=fisherman_001`, with Demo Brand's wordmark on the fish) |
| `/login` | Development sign-in: pick a seeded user (admin, member of Demo Brand, member with no access) |
| `/admin` | Designs in the workspaces you can see, step by step; switch workspace at the top |
| `/admin/access` | Admins: add users, set roles, choose who sees which workspace |

Local data lives in `apps/web/.data/` (delete it to reset; data from before workspaces existed won't show up).

Sign-in is for development only and switched off when `NODE_ENV=production` (so `pnpm build && next start`
has no way into `/admin`). Supabase Auth is next.

## Layout

| Path | What |
| --- | --- |
| `packages/core` | Product templates, `DesignSpec`, constraint and validation rules, workspaces and access rules. No dependencies. |
| `packages/pipeline` | Pipeline steps, job recording, stores, provider adapters and mocks, workspace access layer. |
| `apps/web` | Next.js: studio, embed, admin, API routes, `public/embed.js`. |
| `services/geometry` | Python service that measures meshes (trimesh). |
| `db/schema.sql` | Postgres schema for the move to Supabase. |

## State of things

**Working and tested** (`pnpm test`, `pnpm demo`): `packages/core`, `packages/pipeline` on mocks.

Workspace access rules are unit-tested in both packages.

**Working, checked by hand** (`pnpm dev`, `pnpm build`): `apps/web` on mocks: studio, embed via
`/embed-demo.html` (approval reaches the parent page), admin with workspace switching, and access
management for each role. No automated browser tests yet.

**Written but not yet run** (no package installs were possible where this was scaffolded):

- `services/geometry` — needs `pip install -r requirements.txt`, then test against known meshes.
- `providers/claude.ts` — set `FISHBELLY_INTERPRETER=claude` and `ANTHROPIC_API_KEY`.

**Not built yet:** Meshy adapter, image model, Inngest, Supabase, Stripe, scale/base-merge/repair,
embed session tokens, real sign-in, rate limits. See the milestones in the architecture doc.

Products: `fisherman_001` (the brand-agnostic example; the Weavy flow rebuilt for it, see
`docs/WEAVY_FLOW.md` §7) and `vase_001`. Dimensions, palettes and prompts in
`packages/core/src/template.ts` are placeholders.
