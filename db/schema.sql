-- Postgres schema mirroring packages/core/src/records.ts.
-- Not applied anywhere yet: the scaffold uses a local JSON store behind the same Store
-- interface. When moving to Supabase, apply this and write a PostgresStore.

create table brands (
  id              text primary key,
  name            text not null,
  allowed_origin  text not null,
  theme           jsonb not null default '{}'
);

create table product_templates (
  id          text not null,
  version     int  not null,
  brand_id    text references brands (id),      -- null = Fishbelly's own catalogue
  definition  jsonb not null,                   -- ProductTemplate
  created_at  timestamptz not null default now(),
  primary key (id, version)                     -- templates are versioned, never edited
);

create table design_sessions (
  id                  text primary key,
  brand_id            text references brands (id),
  template_id         text not null,
  template_version    int  not null,
  status              text not null,
  current_version_id  text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  foreign key (template_id, template_version) references product_templates (id, version)
);

create table design_versions (
  id           text primary key,
  session_id   text not null references design_sessions (id),
  index        int  not null,
  prompt       text not null,
  spec         jsonb not null,                  -- DesignSpec
  notes        jsonb not null default '[]',
  preview_url  text not null,
  created_at   timestamptz not null default now(),
  unique (session_id, index)
);

-- Immutable: grant insert + select only, no update or delete.
create table approved_designs (
  id                text primary key,
  session_id        text not null unique references design_sessions (id),
  version_id        text not null references design_versions (id),
  template_id       text not null,
  template_version  int  not null,
  spec              jsonb not null,
  preview_url       text not null,
  prompts           jsonb not null,
  approved_at       timestamptz not null default now()
);

create table generation_jobs (
  id           text primary key,
  session_id   text not null references design_sessions (id),
  kind         text not null,                   -- interpret | preview | model_3d | geometry
  provider     text not null,
  status       text not null,                   -- running | succeeded | failed
  input        jsonb,
  output       jsonb,
  error        text,
  cost_usd     numeric(10, 4) not null default 0,
  started_at   timestamptz not null,
  finished_at  timestamptz,
  duration_ms  int
);
create index on generation_jobs (session_id, started_at);

create table manufacturing_assets (
  id                  text primary key,
  session_id          text not null references design_sessions (id),
  approved_design_id  text not null references approved_designs (id),
  mesh_url            text not null,
  format              text not null,
  measurements        jsonb not null,
  checks              jsonb not null,
  outcome             text not null,            -- production_ready | needs_review | failed
  created_at          timestamptz not null default now()
);

-- Next: order_references (approved design + asset -> brand or Stripe order).
-- Tenant isolation: enable row level security on every table keyed by brand_id.
