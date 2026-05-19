-- ---------------------------------------------------------------------------
-- Use the OAuth provider's name (Facebook / Google) as the new profile's
-- display name. Falls back to the email prefix, then "anonym".
-- Replaces the handle_new_user function from 0005; the trigger already
-- points at it by name, so no trigger change is needed.
-- ---------------------------------------------------------------------------
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
    coalesce(
      nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data->>'name'), ''),
      nullif(split_part(new.email, '@', 1), ''),
      'anonym'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
