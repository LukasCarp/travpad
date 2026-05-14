-- TravPad migration: review + rating system for pins.
-- Idempotent: safe to re-run.

create table if not exists public.pin_reviews (
  id           uuid primary key default gen_random_uuid(),
  pin_id       uuid not null references public.pins(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  rating       integer not null check (rating between 1 and 5),
  text         text,
  author_label text not null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique (pin_id, user_id)
);

create index if not exists pin_reviews_pin_id_idx on public.pin_reviews(pin_id);

alter table public.pin_reviews enable row level security;

drop policy if exists "pin_reviews_read" on public.pin_reviews;
create policy "pin_reviews_read"
  on public.pin_reviews for select using (true);

drop policy if exists "pin_reviews_insert_own" on public.pin_reviews;
create policy "pin_reviews_insert_own"
  on public.pin_reviews for insert
  with check (auth.uid() = user_id);

drop policy if exists "pin_reviews_update_own" on public.pin_reviews;
create policy "pin_reviews_update_own"
  on public.pin_reviews for update
  using (auth.uid() = user_id);

drop policy if exists "pin_reviews_delete_own" on public.pin_reviews;
create policy "pin_reviews_delete_own"
  on public.pin_reviews for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- upsert_review — write or update the caller's review for a pin.
-- Derives author_label server-side from auth.users.email so the client can't
-- spoof someone else's name.
-- ---------------------------------------------------------------------------
create or replace function public.upsert_review(
  p_pin_id uuid,
  p_rating integer,
  p_text   text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_label text;
  v_id    uuid;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;
  if p_rating < 1 or p_rating > 5 then
    raise exception 'rating must be between 1 and 5';
  end if;

  -- Snapshot the author label from the email's local part. SECURITY DEFINER
  -- is needed here because auth.users is not readable under invoker rights.
  select email into v_email from auth.users where id = v_uid;
  v_label := coalesce(nullif(split_part(coalesce(v_email, ''), '@', 1), ''), 'anonym');

  insert into public.pin_reviews (pin_id, user_id, rating, text, author_label)
  values (p_pin_id, v_uid, p_rating, nullif(trim(p_text), ''), v_label)
  on conflict (pin_id, user_id) do update
    set rating     = excluded.rating,
        text       = excluded.text,
        updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;
