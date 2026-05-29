-- 0018: Replace the email-prefix fallback for display_name with a
-- neutral "Traveler-xxxx" so a new user's real name isn't auto-published
-- before they consciously pick one. Backfills any existing profile
-- whose display_name *exactly* matches that user's email prefix, so
-- manually-edited names are left alone.
-- Idempotent.

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
      'Traveler-' || substr(encode(gen_random_bytes(4), 'hex'), 1, 4)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Backfill — only touches rows where the current display_name literally
-- equals the email prefix. If the user edited their name (even to the
-- same string by coincidence is fine — we still consider that "email
-- prefix that leaked"), we accept the false positive over the privacy
-- leak. If their name has spaces, capitals, or anything that diverges
-- from the email prefix, they're left alone.
update public.profiles p
set display_name = 'Traveler-' || substr(encode(gen_random_bytes(4), 'hex'), 1, 4)
from auth.users u
where p.id = u.id
  and p.display_name is not null
  and length(p.display_name) > 0
  and p.display_name = split_part(coalesce(u.email, ''), '@', 1);
