-- Milestone 2b: Avatar upload.
--
-- Avatar lives on restaurant_members (not auth.users metadata) so teammates
-- can actually see it — a client can only read its OWN auth.users metadata,
-- but restaurant_members is already the table the Team list queries for
-- everyone in the restaurant.
--
-- Run this entire file in the Supabase SQL Editor, top to bottom.

-- 1. Column ------------------------------------------------------------

alter table public.restaurant_members add column if not exists avatar_url text;

-- 2. Self-service update, restricted to avatar_url/display_name only ------
-- (role changes stay admin-only — nothing grants that column here)

revoke update on public.restaurant_members from authenticated;
grant update (avatar_url, display_name) on public.restaurant_members to authenticated;

create policy "members can update their own avatar and display name"
  on public.restaurant_members for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 3. Storage bucket ------------------------------------------------------
-- Public bucket: reads bypass RLS entirely via the public URL endpoint, so
-- only the write path (insert/update/delete) needs policies below.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Convention: object path is "{user_id}/avatar.<ext>" — each user can only
-- write inside their own folder.

create policy "users can upload their own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can update their own avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can delete their own avatar"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
