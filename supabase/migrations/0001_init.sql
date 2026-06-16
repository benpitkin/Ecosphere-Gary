-- Phase 0 — local/dev baseline.
--
-- Gary's domain schema (quotes, BOM, etc.) lands in a later phase. This first
-- migration creates a tiny health_check table so the local Supabase stack has a
-- verifiable object and the app's /api/health probe has something real to read
-- against once wired up.

create table if not exists public.health_check (
  id smallint primary key default 1,
  status text not null default 'ok',
  checked_at timestamptz not null default now(),
  constraint health_check_singleton check (id = 1)
);

insert into public.health_check (id, status)
values (1, 'ok')
on conflict (id) do nothing;

alter table public.health_check enable row level security;

-- Allow read access to the singleton row (no client secrets involved).
create policy "health_check is readable"
  on public.health_check
  for select
  using (true);
