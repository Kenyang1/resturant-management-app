-- One-time data hygiene: delete leftover empty solo restaurants created by test
-- accounts BEFORE the cleanup-on-invite-accept fix existed (Milestone 2's
-- 20260714010000 migration only cleans up at accept time, so accounts that had
-- already accepted kept their stray solo restaurant).
--
-- Targets only restaurants that are: single-member, owned by that member,
-- completely empty of data, AND whose owner also belongs to another restaurant.
-- A genuine solo user (no other membership) is never touched.
--
-- Run once in the Supabase SQL Editor.

delete from public.restaurants r
where (select count(*) from public.restaurant_members m where m.restaurant_id = r.id) = 1
  and exists (
    select 1 from public.restaurant_members m2
    where m2.restaurant_id = r.id and m2.user_id = r.owner_id and m2.role = 'owner'
  )
  and exists (
    select 1 from public.restaurant_members m3
    where m3.user_id = r.owner_id and m3.restaurant_id <> r.id
  )
  and not exists (select 1 from public.inventory_log where restaurant_id = r.id)
  and not exists (select 1 from public.management_log where restaurant_id = r.id)
  and not exists (select 1 from public.finance_entries where restaurant_id = r.id)
  and not exists (select 1 from public.tasks where restaurant_id = r.id)
  and not exists (select 1 from public.shifts where restaurant_id = r.id);
