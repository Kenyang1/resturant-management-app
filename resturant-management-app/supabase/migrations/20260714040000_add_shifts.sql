-- Milestone 3b: Shift scheduling.
--
-- `label` is a per-shift title ("Kitchen Lead", "Server") distinct from the
-- permanent owner/manager/staff role on restaurant_members — someone's
-- permission tier doesn't change shift to shift, but their job for that
-- shift might.
--
-- Unlike tasks (any member can manage), scheduling is owner/manager-only —
-- staff can view the schedule but not assign shifts to themselves or others.
-- Adds a reusable is_owner_or_manager() helper for that, since this is the
-- second place (after invites) that needs the same role check.
--
-- Run this entire file in the Supabase SQL Editor, top to bottom.

create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade default public.current_restaurant_id(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_by uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

alter table public.shifts enable row level security;

create or replace function public.is_owner_or_manager(target_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.restaurant_members
    where restaurant_id = target_restaurant_id
      and user_id = auth.uid()
      and role in ('owner', 'manager')
  )
$$;

create policy "restaurant members can view shifts"
  on public.shifts for select to authenticated
  using (restaurant_id in (select public.my_restaurant_ids()));

create policy "owners and managers can create shifts"
  on public.shifts for insert to authenticated
  with check (
    restaurant_id in (select public.my_restaurant_ids())
    and public.is_owner_or_manager(restaurant_id)
  );

create policy "owners and managers can update shifts"
  on public.shifts for update to authenticated
  using (
    restaurant_id in (select public.my_restaurant_ids())
    and public.is_owner_or_manager(restaurant_id)
  )
  with check (
    restaurant_id in (select public.my_restaurant_ids())
    and public.is_owner_or_manager(restaurant_id)
  );

create policy "owners and managers can delete shifts"
  on public.shifts for delete to authenticated
  using (
    restaurant_id in (select public.my_restaurant_ids())
    and public.is_owner_or_manager(restaurant_id)
  );
