-- Scopes inventory_log, management_log, and finance_entries to the authenticated
-- user that owns each row, and removes the "anon full access" policies that
-- currently let anyone with the public anon key read/write/delete all rows.
--
-- Run this in the Supabase SQL Editor after confirming the app has been switched
-- to Supabase Auth (see app/login.tsx, app/sign-up.tsx, app/index.tsx,
-- app/(tabs)/profile.tsx) — auth.uid() is NULL for unauthenticated requests and
-- for sessions that were never established via supabase.auth.*.
--
-- Steps, in order:
--   1. Add a nullable user_id column to each table.
--   2. Backfill existing rows (see BACKFILL section below — edit before running).
--   3. Make user_id NOT NULL with a default of auth.uid() for future inserts.
--   4. Drop the "anon full access" policies.
--   5. Add policies scoped to the authenticated role, keyed on user_id.

-- 1. Add columns -------------------------------------------------------------

alter table public.inventory_log
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.management_log
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.finance_entries
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- 2. BACKFILL ------------------------------------------------------------
-- Existing rows had no owner; assigning them all to the account that owns
-- them (id confirmed via `select id, email from auth.users;`).

update public.inventory_log   set user_id = '4de310d4-f432-4e52-a2eb-c1f056279620' where user_id is null;
update public.management_log  set user_id = '4de310d4-f432-4e52-a2eb-c1f056279620' where user_id is null;
update public.finance_entries set user_id = '4de310d4-f432-4e52-a2eb-c1f056279620' where user_id is null;

-- 3. Enforce NOT NULL + default for future inserts ---------------------------

alter table public.inventory_log
  alter column user_id set default auth.uid(),
  alter column user_id set not null;

alter table public.management_log
  alter column user_id set default auth.uid(),
  alter column user_id set not null;

alter table public.finance_entries
  alter column user_id set default auth.uid(),
  alter column user_id set not null;

-- 4. Drop the open "anon full access" policies --------------------------------

drop policy if exists "anon full access" on public.inventory_log;
drop policy if exists "anon full access" on public.management_log;
drop policy if exists "anon full access" on public.finance_entries;

-- 5. Add per-user policies for the authenticated role -------------------------

create policy "authenticated users manage own inventory_log rows"
  on public.inventory_log
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "authenticated users manage own management_log rows"
  on public.management_log
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "authenticated users manage own finance_entries rows"
  on public.finance_entries
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
