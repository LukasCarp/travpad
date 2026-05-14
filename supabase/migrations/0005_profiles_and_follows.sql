-- TravPad migration: profiles + follows + avatars storage.
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  display_name          text not null,
  bio                   text,
  avatar_path           text,
  compass_text          text,
  compass_generated_at  timestamptz,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read" on public.profiles for select using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on new auth user, with email-prefix as default name.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(split_part(new.email, '@', 1), ''), 'anonym')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill profiles for existing users.
insert into public.profiles (id, display_name)
select
  u.id,
  coalesce(nullif(split_part(u.email, '@', 1), ''), 'anonym')
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- follows  (FK to profiles so we can join cleanly)
-- ---------------------------------------------------------------------------
create table if not exists public.follows (
  follower_id  uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists follows_following_id_idx on public.follows(following_id);

alter table public.follows enable row level security;

drop policy if exists "follows_read" on public.follows;
create policy "follows_read" on public.follows for select using (true);

drop policy if exists "follows_insert_own" on public.follows;
create policy "follows_insert_own" on public.follows for insert
  with check (auth.uid() = follower_id);

drop policy if exists "follows_delete_own" on public.follows;
create policy "follows_delete_own" on public.follows for delete
  using (auth.uid() = follower_id);

-- ---------------------------------------------------------------------------
-- avatars storage bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "avatars_storage_read" on storage.objects;
create policy "avatars_storage_read" on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_storage_insert" on storage.objects;
create policy "avatars_storage_insert" on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_storage_update" on storage.objects;
create policy "avatars_storage_update" on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_storage_delete" on storage.objects;
create policy "avatars_storage_delete" on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
