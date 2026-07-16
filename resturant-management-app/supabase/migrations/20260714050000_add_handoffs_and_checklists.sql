-- Milestone 5: Shift handoffs & food safety checklists.
--
-- Two features:
-- 1. shift_handoffs — a simple running note feed so an outgoing employee can
--    flag something for whoever's on next. Any member reads/writes, same
--    permission pattern as tasks.
-- 2. checklist_templates / checklist_template_items — reusable checklists
--    (opening, closing, food safety). "Starting" a checklist doesn't need a
--    new runtime table: it just bulk-inserts rows into the existing `tasks`
--    table (tagged with `checklist_source`), so the whole Tasks UI —
--    checkboxes, assignment, progress bar — works for checklists for free.
--
-- Run this entire file in the Supabase SQL Editor, top to bottom.

-- 1. Shift handoff notes -------------------------------------------------

create table if not exists public.shift_handoffs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade default public.current_restaurant_id(),
  author_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  note text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.shift_handoffs enable row level security;

create policy "restaurant members manage handoff notes"
  on public.shift_handoffs for all to authenticated
  using (restaurant_id in (select public.my_restaurant_ids()))
  with check (restaurant_id in (select public.my_restaurant_ids()));

-- 2. Checklist templates ---------------------------------------------------

create table if not exists public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade default public.current_restaurant_id(),
  name text not null,
  category text not null default 'other' check (category in ('opening', 'closing', 'food_safety', 'other')),
  created_by uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.checklist_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.checklist_templates(id) on delete cascade,
  label text not null,
  position int not null default 0
);

alter table public.checklist_templates enable row level security;
alter table public.checklist_template_items enable row level security;

create policy "restaurant members manage checklist templates"
  on public.checklist_templates for all to authenticated
  using (restaurant_id in (select public.my_restaurant_ids()))
  with check (restaurant_id in (select public.my_restaurant_ids()));

create policy "restaurant members manage checklist template items"
  on public.checklist_template_items for all to authenticated
  using (template_id in (select id from public.checklist_templates where restaurant_id in (select public.my_restaurant_ids())))
  with check (template_id in (select id from public.checklist_templates where restaurant_id in (select public.my_restaurant_ids())));

-- Tag tasks bulk-created from a checklist run, so they can be grouped/filtered
-- (e.g. "show me today's Opening Checklist") without a separate runs table.
alter table public.tasks add column if not exists checklist_source text;

-- 3. Seed three default templates per restaurant --------------------------

create or replace function public.seed_default_checklist_templates_for(target_restaurant_id uuid, owner uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  opening_id uuid;
  closing_id uuid;
  safety_id uuid;
begin
  if exists (select 1 from public.checklist_templates where restaurant_id = target_restaurant_id) then
    return;
  end if;

  insert into public.checklist_templates (restaurant_id, name, category, created_by)
  values (target_restaurant_id, 'Opening Checklist', 'opening', owner)
  returning id into opening_id;
  insert into public.checklist_template_items (template_id, label, position) values
    (opening_id, 'Unlock doors and disarm alarm', 0),
    (opening_id, 'Turn on kitchen equipment', 1),
    (opening_id, 'Check walk-in cooler and freezer temps', 2),
    (opening_id, 'Restock prep stations', 3),
    (opening_id, 'Review today''s reservations and specials', 4);

  insert into public.checklist_templates (restaurant_id, name, category, created_by)
  values (target_restaurant_id, 'Closing Checklist', 'closing', owner)
  returning id into closing_id;
  insert into public.checklist_template_items (template_id, label, position) values
    (closing_id, 'Clean and sanitize prep surfaces', 0),
    (closing_id, 'Store food and label with dates', 1),
    (closing_id, 'Empty trash and recycling', 2),
    (closing_id, 'Turn off kitchen equipment', 3),
    (closing_id, 'Lock doors and arm alarm', 4);

  insert into public.checklist_templates (restaurant_id, name, category, created_by)
  values (target_restaurant_id, 'Food Safety Check', 'food_safety', owner)
  returning id into safety_id;
  insert into public.checklist_template_items (template_id, label, position) values
    (safety_id, 'Walk-in cooler temperature (target at or below 40F)', 0),
    (safety_id, 'Walk-in freezer temperature (target at or below 0F)', 1),
    (safety_id, 'Handwashing stations stocked', 2),
    (safety_id, 'No cross-contamination in prep areas', 3),
    (safety_id, 'Cleaning log up to date', 4);
end;
$$;

create or replace function public.handle_new_restaurant_checklists()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_default_checklist_templates_for(new.id, new.owner_id);
  return new;
end;
$$;

drop trigger if exists on_restaurant_created_seed_checklists on public.restaurants;
create trigger on_restaurant_created_seed_checklists
  after insert on public.restaurants
  for each row execute function public.handle_new_restaurant_checklists();

-- Backfill for restaurants that already existed before this migration.
do $$
declare
  r record;
begin
  for r in select id, owner_id from public.restaurants loop
    perform public.seed_default_checklist_templates_for(r.id, r.owner_id);
  end loop;
end $$;
