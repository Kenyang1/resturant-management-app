-- Milestone 3: Tasks system.
--
-- Restaurant-scoped tasks, assignable to any current member. Follows the
-- Milestone 1 permission pattern (any member can read/write) rather than
-- Milestone 2's role-gating — task management is meant to be collaborative
-- for the whole team, not admin-only.
--
-- Run this entire file in the Supabase SQL Editor, top to bottom.

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade default public.current_restaurant_id(),
  title text not null,
  description text,
  assigned_to uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

create policy "restaurant members manage tasks"
  on public.tasks for all to authenticated
  using (restaurant_id in (select public.my_restaurant_ids()))
  with check (restaurant_id in (select public.my_restaurant_ids()));
