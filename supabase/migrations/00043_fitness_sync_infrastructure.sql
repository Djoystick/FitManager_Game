-- ============================================================
-- Migration: 00042_fitness_sync_infrastructure.sql
-- Purpose:   Add tables for future Google Health / Apple Health
--            fitness tracker integration (fitness_sync_sources,
--            fitness_sync_logs). Tables are created but the
--            feature is "Coming Soon" — no data will be written
--            until the mobile SDK is integrated.
-- ============================================================

-- ── 1. fitness_sync_sources ──────────────────────────────────
-- Stores which fitness provider a user has connected.
-- One row per user (upsert on connect/disconnect).

create table if not exists fitness_sync_sources (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references users(id) on delete cascade,
  provider        text        not null check (provider in ('google_health', 'apple_health', 'manual')),
  is_connected    boolean     not null default false,
  access_token    text,          -- encrypted OAuth token (stored server-side only)
  refresh_token   text,          -- encrypted refresh token
  token_expires_at timestamptz,
  last_synced_at  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- One source per provider per user
  unique (user_id, provider)
);

-- RLS: users can only see their own sync sources
alter table fitness_sync_sources enable row level security;

create policy "fitness_sync_sources_owner"
  on fitness_sync_sources
  for all
  using (user_id = auth.uid());

-- Auto-update updated_at
create or replace function update_fitness_sync_sources_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_fitness_sync_sources_updated_at on fitness_sync_sources;
create trigger trg_fitness_sync_sources_updated_at
  before update on fitness_sync_sources
  for each row execute function update_fitness_sync_sources_updated_at();


-- ── 2. fitness_sync_logs ─────────────────────────────────────
-- Audit log of every sync event (success / error / partial).
-- Used for debugging and fraud-detection cross-referencing.

create table if not exists fitness_sync_logs (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references users(id) on delete cascade,
  provider        text        not null,
  synced_at       timestamptz not null default now(),
  steps_raw       bigint      not null default 0,   -- steps reported by the provider
  steps_credited  bigint      not null default 0,   -- steps actually credited (after cap/validation)
  sp_awarded      numeric(10,2) not null default 0, -- Sweat Points awarded this sync
  status          text        not null check (status in ('success', 'partial', 'error', 'skipped')),
  error_message   text,
  metadata        jsonb       default '{}'::jsonb   -- arbitrary debug payload
);

-- Index for fast user history lookups
create index if not exists idx_fitness_sync_logs_user_synced
  on fitness_sync_logs (user_id, synced_at desc);

-- RLS: users can only read their own logs
alter table fitness_sync_logs enable row level security;

create policy "fitness_sync_logs_owner_read"
  on fitness_sync_logs
  for select
  using (user_id = auth.uid());

-- Only server-side service role can INSERT (never client-side)
create policy "fitness_sync_logs_service_insert"
  on fitness_sync_logs
  for insert
  with check (false);  -- blocked for anon/authenticated; use service_role key server-side


-- ── 3. Helper view: latest sync per user ─────────────────────
create or replace view fitness_sync_status as
select
  s.user_id,
  s.provider,
  s.is_connected,
  s.last_synced_at,
  coalesce(l.steps_credited, 0)  as last_steps_credited,
  coalesce(l.sp_awarded, 0)      as last_sp_awarded,
  l.status                       as last_sync_status
from fitness_sync_sources s
left join lateral (
  select steps_credited, sp_awarded, status
  from fitness_sync_logs
  where user_id = s.user_id and provider = s.provider
  order by synced_at desc
  limit 1
) l on true;

-- ── 4. Backfill: create a 'manual' source row for every existing user ──
-- This ensures every user has at least one source row so the UI can
-- display the "Not connected" state immediately.
insert into fitness_sync_sources (user_id, provider, is_connected)
select id, 'manual', true
from users
on conflict (user_id, provider) do nothing;

-- Done!
comment on table fitness_sync_sources is
  'Tracks which fitness data providers (Google Health, Apple Health) a user has connected. Coming Soon feature.';
comment on table fitness_sync_logs is
  'Audit log of all fitness sync events. Server-side only writes via service_role key.';
