-- TravPad migration: "Secret Spot" flag on pins.
-- A pin can be marked as a secret spot regardless of its category. Secret pins
-- get a distinct marker on the map and can be filtered to on their own.
-- Idempotent: safe to re-run in the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- 1. New column on `pins`
-- ---------------------------------------------------------------------------
alter table public.pins
  add column if not exists secret boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. Read view — expose `secret`
-- ---------------------------------------------------------------------------
-- Drop + recreate rather than `create or replace`: the latter cannot change
-- column order, which fails when `secret` is added among existing columns.
drop view if exists public.pins_view;

create view public.pins_view as
select
  p.id,
  p.title,
  p.category,
  p.subcategory,
  p.short_description,
  p.description,
  p.services,
  p.secret,
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
  ) as images,
  (select display_name from public.profiles where id = p.created_by) as created_by_name
from public.pins p;

alter view public.pins_view set (security_invoker = true);

-- ---------------------------------------------------------------------------
-- 3. Insert RPC — accept `p_secret`
-- ---------------------------------------------------------------------------
drop function if exists public.create_pin(
  text, text, double precision, double precision,
  text, text, text, jsonb, jsonb, text[]
);

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

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Update RPC — accept `p_secret`
-- ---------------------------------------------------------------------------
drop function if exists public.update_pin(
  uuid, text, text, double precision, double precision,
  text, text, text, jsonb, text[]
);

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
  where id         = p_pin_id
    and created_by = v_uid;

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'pin not found or not owned';
  end if;

  delete from public.pin_images where pin_id = p_pin_id;

  if array_length(p_image_paths, 1) is not null then
    insert into public.pin_images (pin_id, storage_path, created_by)
    select p_pin_id, unnest(p_image_paths), v_uid;
  end if;
end;
$$;
