-- 0008: wiki editing + pin history + pin follows + notification tracking.
-- Idempotent: safe to re-run in the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- 1. Wiki editing — any authenticated user may edit a pin (delete stays with
--    the creator, enforced by delete_pin). Permissive policies OR together.
-- ---------------------------------------------------------------------------
drop policy if exists "pins_update_any_authenticated" on public.pins;
create policy "pins_update_any_authenticated"
  on public.pins for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- pin_images: any authenticated user can manage a pin's image rows.
drop policy if exists "pin_images_insert_own" on public.pin_images;
drop policy if exists "pin_images_insert" on public.pin_images;
create policy "pin_images_insert"
  on public.pin_images for insert
  with check (auth.uid() is not null);

drop policy if exists "pin_images_delete_own" on public.pin_images;
drop policy if exists "pin_images_delete" on public.pin_images;
create policy "pin_images_delete"
  on public.pin_images for delete
  using (auth.uid() is not null);

-- Storage: any authenticated user can delete pin-images blobs (wiki edits
-- may remove images uploaded by another user).
drop policy if exists "pin_images_storage_delete_own" on storage.objects;
drop policy if exists "pin_images_storage_delete" on storage.objects;
create policy "pin_images_storage_delete"
  on storage.objects for delete
  using (bucket_id = 'pin-images' and auth.uid() is not null);

-- ---------------------------------------------------------------------------
-- 2. pin_history — append-only change log.
-- Dropped + recreated so the schema is correct even if an older manual
-- pin_history table already exists. NOTE: re-running this migration wipes
-- pin_history / pin_follows — run it once.
-- ---------------------------------------------------------------------------
drop table if exists public.pin_history cascade;

create table public.pin_history (
  id         uuid primary key default gen_random_uuid(),
  pin_id     uuid not null references public.pins(id) on delete cascade,
  edited_by  uuid references auth.users(id),
  action     text not null check (action in ('created', 'updated')),
  snapshot   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists pin_history_pin_id_idx
  on public.pin_history (pin_id);
create index if not exists pin_history_created_at_idx
  on public.pin_history (created_at desc);

alter table public.pin_history enable row level security;

drop policy if exists "pin_history_read" on public.pin_history;
create policy "pin_history_read"
  on public.pin_history for select using (true);

drop policy if exists "pin_history_insert" on public.pin_history;
create policy "pin_history_insert"
  on public.pin_history for insert
  with check (auth.uid() = edited_by);

-- ---------------------------------------------------------------------------
-- 3. pin_follows — a user following a pin.
-- ---------------------------------------------------------------------------
drop table if exists public.pin_follows cascade;

create table public.pin_follows (
  user_id    uuid not null references auth.users(id) on delete cascade,
  pin_id     uuid not null references public.pins(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, pin_id)
);

create index if not exists pin_follows_pin_id_idx
  on public.pin_follows (pin_id);

alter table public.pin_follows enable row level security;

drop policy if exists "pin_follows_read" on public.pin_follows;
create policy "pin_follows_read"
  on public.pin_follows for select using (true);

drop policy if exists "pin_follows_insert_own" on public.pin_follows;
create policy "pin_follows_insert_own"
  on public.pin_follows for insert
  with check (auth.uid() = user_id);

drop policy if exists "pin_follows_delete_own" on public.pin_follows;
create policy "pin_follows_delete_own"
  on public.pin_follows for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4. Notification read-marker on profiles.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists notifications_seen_at timestamptz not null
  default now();

-- ---------------------------------------------------------------------------
-- 5. History feed view — joins pin title + editor name for the client.
-- ---------------------------------------------------------------------------
create or replace view public.pin_history_view as
select
  h.id,
  h.pin_id,
  h.edited_by,
  h.action,
  h.snapshot,
  h.created_at,
  p.title as pin_title,
  (select display_name from public.profiles pr where pr.id = h.edited_by)
    as editor_name
from public.pin_history h
join public.pins p on p.id = h.pin_id;

alter view public.pin_history_view set (security_invoker = true);

-- ---------------------------------------------------------------------------
-- 6. create_pin — also record a 'created' history row.
-- ---------------------------------------------------------------------------
create or replace function public.create_pin(
  p_title             text,
  p_category          text,
  p_lat               double precision,
  p_lng               double precision,
  p_subcategory       text     default null,
  p_short_description text     default null,
  p_description       text     default null,
  p_services          jsonb    default '[]'::jsonb,
  p_details           jsonb    default '{}'::jsonb,
  p_image_paths       text[]   default '{}',
  p_secret            boolean  default false
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_id  uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;

  insert into public.pins (
    title, category, subcategory, short_description, description,
    services, location, details, secret, created_by
  )
  values (
    p_title,
    p_category,
    p_subcategory,
    p_short_description,
    p_description,
    coalesce(p_services, '[]'::jsonb),
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
    coalesce(p_details, '{}'::jsonb),
    coalesce(p_secret, false),
    v_uid
  )
  returning id into v_id;

  if array_length(p_image_paths, 1) is not null then
    insert into public.pin_images (pin_id, storage_path, created_by)
    select v_id, unnest(p_image_paths), v_uid;
  end if;

  insert into public.pin_history (pin_id, edited_by, action, snapshot)
  values (
    v_id, v_uid, 'created',
    jsonb_build_object(
      'title', p_title,
      'category', p_category,
      'subcategory', p_subcategory,
      'short_description', p_short_description,
      'description', p_description,
      'services', coalesce(p_services, '[]'::jsonb),
      'secret', coalesce(p_secret, false)
    )
  );

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. update_pin — editable by any authenticated user; record 'updated' row.
-- ---------------------------------------------------------------------------
create or replace function public.update_pin(
  p_pin_id            uuid,
  p_title             text,
  p_category          text,
  p_lat               double precision,
  p_lng               double precision,
  p_subcategory       text     default null,
  p_short_description text     default null,
  p_description       text     default null,
  p_services          jsonb    default '[]'::jsonb,
  p_image_paths       text[]   default '{}',
  p_secret            boolean  default false
)
returns void
language plpgsql
security invoker
as $$
declare
  v_uid   uuid := auth.uid();
  v_count int;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;

  update public.pins set
    title             = p_title,
    category          = p_category,
    subcategory       = p_subcategory,
    short_description = p_short_description,
    description       = p_description,
    services          = coalesce(p_services, '[]'::jsonb),
    secret            = coalesce(p_secret, false),
    location          = st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
    updated_at        = now()
  where id = p_pin_id;

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'pin not found';
  end if;

  delete from public.pin_images where pin_id = p_pin_id;

  if array_length(p_image_paths, 1) is not null then
    insert into public.pin_images (pin_id, storage_path, created_by)
    select p_pin_id, unnest(p_image_paths), v_uid;
  end if;

  insert into public.pin_history (pin_id, edited_by, action, snapshot)
  values (
    p_pin_id, v_uid, 'updated',
    jsonb_build_object(
      'title', p_title,
      'category', p_category,
      'subcategory', p_subcategory,
      'short_description', p_short_description,
      'description', p_description,
      'services', coalesce(p_services, '[]'::jsonb),
      'secret', coalesce(p_secret, false)
    )
  );
end;
$$;
