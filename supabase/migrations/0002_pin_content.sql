-- TravPad migration: pin content fields + image relation + storage bucket.
-- Idempotent: safe to re-run in the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- 1. New columns on `pins`
-- ---------------------------------------------------------------------------
alter table public.pins
  add column if not exists subcategory       text,
  add column if not exists short_description text,
  add column if not exists description       text,
  add column if not exists services          jsonb default '[]'::jsonb;

alter table public.pins
  drop constraint if exists pins_short_description_length;
alter table public.pins
  add constraint pins_short_description_length
    check (short_description is null or char_length(short_description) <= 200);

-- ---------------------------------------------------------------------------
-- 2. `pin_images` relation
-- ---------------------------------------------------------------------------
create table if not exists public.pin_images (
  id           uuid primary key default gen_random_uuid(),
  pin_id       uuid not null references public.pins(id) on delete cascade,
  storage_path text not null,
  width        integer,
  height       integer,
  created_by   uuid references auth.users(id),
  created_at   timestamptz default now()
);

create index if not exists pin_images_pin_id_idx on public.pin_images (pin_id);

alter table public.pin_images enable row level security;

drop policy if exists "pin_images_read" on public.pin_images;
create policy "pin_images_read"
  on public.pin_images for select using (true);

drop policy if exists "pin_images_insert_own" on public.pin_images;
create policy "pin_images_insert_own"
  on public.pin_images for insert
  with check (auth.uid() = created_by);

drop policy if exists "pin_images_delete_own" on public.pin_images;
create policy "pin_images_delete_own"
  on public.pin_images for delete using (auth.uid() = created_by);

-- ---------------------------------------------------------------------------
-- 3. Updated read view
-- ---------------------------------------------------------------------------
create or replace view public.pins_view as
select
  p.id,
  p.title,
  p.category,
  p.subcategory,
  p.short_description,
  p.description,
  p.services,
  p.details,
  st_y(p.location::geometry) as lat,
  st_x(p.location::geometry) as lng,
  p.created_by,
  p.created_at,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object('id', pi.id, 'storage_path', pi.storage_path)
        order by pi.created_at
      )
      from public.pin_images pi
      where pi.pin_id = p.id
    ),
    '[]'::jsonb
  ) as images
from public.pins p;

alter view public.pins_view set (security_invoker = true);

-- ---------------------------------------------------------------------------
-- 4. Updated insert RPC
-- ---------------------------------------------------------------------------
-- Drop the old signature explicitly so we can replace it with one that has
-- different default-arg shape.
drop function if exists public.create_pin(text, text, double precision, double precision, jsonb);

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
  p_image_paths       text[]   default '{}'
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
    services, location, details, created_by
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
    v_uid
  )
  returning id into v_id;

  if array_length(p_image_paths, 1) is not null then
    insert into public.pin_images (pin_id, storage_path, created_by)
    select v_id, unnest(p_image_paths), v_uid;
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Storage bucket + policies for pin images (public read)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('pin-images', 'pin-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "pin_images_storage_read" on storage.objects;
create policy "pin_images_storage_read"
  on storage.objects for select
  using (bucket_id = 'pin-images');

-- Uploads must land under a folder named with the user's uid:  <uid>/<filename>
drop policy if exists "pin_images_storage_insert" on storage.objects;
create policy "pin_images_storage_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'pin-images'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "pin_images_storage_delete_own" on storage.objects;
create policy "pin_images_storage_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'pin-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
