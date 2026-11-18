-- Postgres schema mirroring packages/core/src/records.ts.
-- Not applied anywhere yet: the scaffold uses a local JSON store behind the same Store
-- interface. When moving to Supabase, apply this and write a PostgresStore.

-- A workspace is one client. Brands and design sessions carry workspace_id; everything a
-- session produces (versions, jobs, approved designs, assets) belongs to it through session_id.
create table workspaces (
  id          text primary key,                 -- appears in URLs; "access" is reserved
  name        text not null,
  created_at  timestamptz not null default now()
);

-- Internal app users (not customers). With Supabase Auth, id = auth.users.id.
create table users (
  id          text primary key,
  email       text not null unique,
  name        text not null,
  role        text not null check (role in ('admin', 'member')),  -- admin = every workspace
  created_at  timestamptz not null default now()
);

-- Members see only the workspaces listed here. Admins don't need rows.
create table workspace_members (
  user_id       text not null references users (id) on delete cascade,
  workspace_id  text not null references workspaces (id) on delete cascade,
  granted_by    text not null references users (id),
  created_at    timestamptz not null default now(),
  primary key (user_id, workspace_id)
);

create table brands (
  id              text primary key,
  workspace_id    text not null references workspaces (id),
  name            text not null,
  allowed_origin  text,                         -- null = not embeddable (e.g. the standalone studio)
  theme           jsonb not null default '{}'
);

create table product_templates (
  id          text not null,
  version     int  not null,
  brand_id    text references brands (id),      -- null = shared catalogue; brands list what they offer
  definition  jsonb not null,                   -- ProductTemplate
  created_at  timestamptz not null default now(),
  primary key (id, version)                     -- templates are versioned, never edited
);

create table design_sessions (
  id                  text primary key,
  workspace_id        text not null references workspaces (id),  -- = the brand's workspace, set once
  brand_id            text not null references brands (id),
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

create index on design_sessions (workspace_id, created_at);

-- Tenant isolation. The app checks access in packages/pipeline/src/workspaces.ts; row level
-- security makes the database refuse the same reads if a query ever forgets to.
-- Sketch for Supabase (auth.uid() = users.id); child tables join through design_sessions.
--
-- create function can_access_workspace(ws text) returns boolean language sql stable as $$
--   select exists (select 1 from users u where u.id = auth.uid()::text and u.role = 'admin')
--       or exists (select 1 from workspace_members m where m.user_id = auth.uid()::text and m.workspace_id = ws)
-- $$;
-- alter table design_sessions enable row level security;
-- create policy workspace_read on design_sessions for select using (can_access_workspace(workspace_id));
-- (customer-facing routes use the service role and only touch the session they were given)

-- Next: order_references (approved design + asset -> brand or Stripe order).
