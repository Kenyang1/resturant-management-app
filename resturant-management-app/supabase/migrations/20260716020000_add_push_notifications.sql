-- Milestone 6 (part 2 of 2): Push notifications — device token registry.
--
-- The client hook (lib/hooks/usePushNotifications.ts) already calls
-- register_push_token(device_token, device_platform) on sign-in; this migration
-- supplies the table and RPC that call expects. Tokens are Expo push tokens
-- ("ExponentPushToken[...]"), one row per physical device.
--
-- Scope note: this covers *registration* only. Actually sending pushes
-- (overdue tasks, low stock) requires calling Expo's push API from a server —
-- that will be a Supabase Edge Function reading this table; it cannot be done
-- from SQL alone.
--
-- Run this entire file in the Supabase SQL Editor, top to bottom.

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The Edge Function will look up tokens by user when fanning out a notification.
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

-- Users can see and remove their own device tokens (removal supports a future
-- sign-out cleanup). No insert/update policies on purpose — writes go through
-- the SECURITY DEFINER RPC below, which pins user_id to the caller.
create policy "users can view their own push tokens"
  on public.push_tokens for select to authenticated
  using (user_id = auth.uid());

create policy "users can delete their own push tokens"
  on public.push_tokens for delete to authenticated
  using (user_id = auth.uid());

-- Upsert keyed on the token, not the user: a device has one stable Expo token,
-- but the person signed in on it can change. Re-registering hands the token to
-- the current account so a device never pushes to its previous user.
create or replace function public.register_push_token(device_token text, device_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to register a push token';
  end if;
  if device_platform not in ('ios', 'android') then
    raise exception 'Unsupported platform: %', device_platform;
  end if;
  if device_token is null or device_token = '' then
    raise exception 'Push token must not be empty';
  end if;

  insert into public.push_tokens (user_id, token, platform)
  values (auth.uid(), device_token, device_platform)
  on conflict (token) do update
    set user_id = auth.uid(),
        platform = excluded.platform,
        updated_at = now();
end;
$$;

grant execute on function public.register_push_token(text, text) to authenticated;
