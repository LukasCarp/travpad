-- ---------------------------------------------------------------------------
-- Carry the OAuth provider's avatar (Facebook / Google) into a new profile,
-- alongside the display name. avatar_path may hold either a Storage path or a
-- full URL; the app resolves both. Supersedes the function from 0013.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, display_name, avatar_path)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data->>'name'), ''),
      nullif(split_part(new.email, '@', 1), ''),
      'anonym'
    ),
    coalesce(
      nullif(btrim(new.raw_user_meta_data->>'avatar_url'), ''),
      nullif(btrim(new.raw_user_meta_data->>'picture'), '')
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
