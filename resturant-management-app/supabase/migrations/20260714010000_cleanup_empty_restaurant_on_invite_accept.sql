-- Fixes a gap Milestone 1's current_restaurant_id() explicitly flagged as a
-- risk: it assumes one restaurant per user (`limit 1`). Now that invites are
-- real (Milestone 2), a user can end up in two restaurants — their
-- auto-created solo one from signup, plus whatever team they just joined —
-- which makes that `limit 1` non-deterministic and breaks the Team list
-- (it shows members mixed across both restaurants).
--
-- Fix: when accept_restaurant_invite() succeeds, delete any OTHER restaurant
-- this user solely owns — but only if it has no other members and no data in
-- any of the three tables, so real work is never destroyed. This covers the
-- common case (signed up specifically to join a team, never used the solo
-- restaurant) without touching anyone who'd already used theirs standalone.
--
-- Run this entire file in the Supabase SQL Editor.

create or replace function public.accept_restaurant_invite(invite_token uuid)
returns public.restaurant_members
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.restaurant_invites;
  new_member public.restaurant_members;
  caller_email text;
  empty_restaurant record;
begin
  caller_email := auth.jwt() ->> 'email';

  select * into inv from public.restaurant_invites where token = invite_token;

  if inv.id is null then
    raise exception 'Invite not found';
  end if;
  if inv.status <> 'pending' then
    raise exception 'This invite has already been used or revoked';
  end if;
  if inv.expires_at < now() then
    raise exception 'This invite has expired';
  end if;
  if lower(inv.email) <> lower(coalesce(caller_email, '')) then
    raise exception 'This invite was sent to a different email address';
  end if;

  insert into public.restaurant_members (restaurant_id, user_id, role, display_name)
  values (inv.restaurant_id, auth.uid(), inv.role, caller_email)
  on conflict (restaurant_id, user_id) do update set role = excluded.role
  returning * into new_member;

  update public.restaurant_invites set status = 'accepted', accepted_at = now() where id = inv.id;

  for empty_restaurant in
    select r.id
    from public.restaurants r
    join public.restaurant_members m
      on m.restaurant_id = r.id and m.user_id = auth.uid() and m.role = 'owner'
    where r.owner_id = auth.uid()
      and r.id <> inv.restaurant_id
      and (select count(*) from public.restaurant_members m2 where m2.restaurant_id = r.id) = 1
      and not exists (select 1 from public.inventory_log where restaurant_id = r.id)
      and not exists (select 1 from public.management_log where restaurant_id = r.id)
      and not exists (select 1 from public.finance_entries where restaurant_id = r.id)
  loop
    delete from public.restaurants where id = empty_restaurant.id;
  end loop;

  return new_member;
end;
$$;
