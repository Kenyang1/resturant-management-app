-- Milestone 6 (part 1 of 2): Activity log + manager approvals.
--
-- 1. activity_log — an audit trail of who changed what, when, across the three
--    business-record tables (inventory_log, management_log, finance_entries).
--    Rows are written ONLY by database triggers; clients can read their
--    restaurant's trail but never insert/update/delete it directly. Tasks are
--    deliberately excluded — checklists bulk-insert 5 rows at a time and
--    completing tasks is high-churn, which would drown the trail in noise.
--
-- 2. approval_requests — staff can no longer write finance entries directly;
--    they submit a request that an owner/manager approves or rejects. Approval
--    applies the entry via a SECURITY DEFINER RPC. Owners/managers keep writing
--    finance entries directly, unchanged. (The table's `kind` is generic so
--    stock adjustments can use the same flow later; only 'expense' is
--    implemented now.)
--
-- Run this entire file in the Supabase SQL Editor, top to bottom.

-- 0. Repo-history repair -----------------------------------------------------
-- my_restaurant_ids() is referenced by the tasks/shifts/checklists migrations
-- and already exists in the live database, but was originally created ad hoc in
-- the SQL editor and never captured in a migration file. Defined here (idempotent)
-- so this repo's migrations are self-contained.

create or replace function public.my_restaurant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select restaurant_id from public.restaurant_members where user_id = auth.uid()
$$;

-- 1. Activity log -------------------------------------------------------------

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  table_name text not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  record_summary text not null,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_restaurant_created_idx
  on public.activity_log (restaurant_id, created_at desc);

alter table public.activity_log enable row level security;

-- Read-only for members; no insert/update/delete policies on purpose —
-- the trigger function below is SECURITY DEFINER and bypasses RLS.
create policy "restaurant members can view their activity log"
  on public.activity_log for select to authenticated
  using (restaurant_id in (select public.my_restaurant_ids()));

create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec jsonb;
  summary text;
begin
  if tg_op = 'DELETE' then
    rec := to_jsonb(old);
  else
    rec := to_jsonb(new);
  end if;

  -- One human-readable line per table: item name, log title, or expense/revenue amount.
  summary := coalesce(
    rec->>'item_name',
    rec->>'title',
    nullif(concat_ws(' ', rec->>'kind', '$' || (rec->>'amount'), rec->>'category'), ' $'),
    'record'
  );

  insert into public.activity_log (restaurant_id, actor_id, table_name, action, record_summary)
  values ((rec->>'restaurant_id')::uuid, auth.uid(), tg_table_name, lower(tg_op), left(summary, 120));

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists log_inventory_activity on public.inventory_log;
create trigger log_inventory_activity
  after insert or update or delete on public.inventory_log
  for each row execute function public.log_activity();

drop trigger if exists log_management_activity on public.management_log;
create trigger log_management_activity
  after insert or update or delete on public.management_log
  for each row execute function public.log_activity();

drop trigger if exists log_finance_activity on public.finance_entries;
create trigger log_finance_activity
  after insert or update or delete on public.finance_entries
  for each row execute function public.log_activity();

-- 2. Manager approvals ---------------------------------------------------------

create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade default public.current_restaurant_id(),
  requested_by uuid not null references auth.users(id) on delete cascade default auth.uid(),
  kind text not null check (kind in ('expense', 'stock_adjustment')),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.approval_requests enable row level security;

create policy "restaurant members can view approval requests"
  on public.approval_requests for select to authenticated
  using (restaurant_id in (select public.my_restaurant_ids()));

create policy "restaurant members can submit approval requests"
  on public.approval_requests for insert to authenticated
  with check (
    requested_by = auth.uid()
    and restaurant_id in (select public.my_restaurant_ids())
  );

-- No update/delete policies: decisions happen only through the RPC below.

create or replace function public.decide_approval_request(request_id uuid, decision text)
returns public.approval_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.approval_requests;
begin
  if decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;

  select * into req from public.approval_requests where id = request_id;
  if req.id is null then
    raise exception 'Request not found';
  end if;
  if req.status <> 'pending' then
    raise exception 'This request has already been decided';
  end if;
  if not public.is_owner_or_manager(req.restaurant_id) then
    raise exception 'Only an owner or manager can decide approval requests';
  end if;

  if decision = 'approved' and req.kind = 'expense' then
    insert into public.finance_entries (restaurant_id, user_id, kind, amount, category, notes, occurred_on)
    values (
      req.restaurant_id,
      req.requested_by,
      req.payload->>'kind',
      (req.payload->>'amount')::numeric,
      req.payload->>'category',
      nullif(req.payload->>'notes', ''),
      (req.payload->>'occurred_on')::date
    );
  end if;

  update public.approval_requests
    set status = decision, decided_by = auth.uid(), decided_at = now()
    where id = request_id
    returning * into req;

  return req;
end;
$$;

grant execute on function public.decide_approval_request(uuid, text) to authenticated;

-- 3. Gate finance writes to owner/manager ---------------------------------------
-- Staff keep read access; their write path is now approval_requests. The old
-- all-members policy is replaced with a read policy plus role-gated writes.

drop policy if exists "restaurant members manage finance_entries" on public.finance_entries;

create policy "restaurant members can view finance_entries"
  on public.finance_entries for select to authenticated
  using (restaurant_id in (select public.my_restaurant_ids()));

create policy "owners and managers can insert finance_entries"
  on public.finance_entries for insert to authenticated
  with check (
    restaurant_id in (select public.my_restaurant_ids())
    and public.is_owner_or_manager(restaurant_id)
  );

create policy "owners and managers can update finance_entries"
  on public.finance_entries for update to authenticated
  using (
    restaurant_id in (select public.my_restaurant_ids())
    and public.is_owner_or_manager(restaurant_id)
  )
  with check (
    restaurant_id in (select public.my_restaurant_ids())
    and public.is_owner_or_manager(restaurant_id)
  );

create policy "owners and managers can delete finance_entries"
  on public.finance_entries for delete to authenticated
  using (
    restaurant_id in (select public.my_restaurant_ids())
    and public.is_owner_or_manager(restaurant_id)
  );
