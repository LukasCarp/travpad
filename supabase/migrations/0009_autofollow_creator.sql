-- 0009: a pin's creator automatically follows it, so they get notified when
-- other users edit it. Also backfills follows for already-created pins.

-- ---------------------------------------------------------------------------
-- create_pin — auto-follow the new pin as its creator.
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

  insert into public.pin_follows (user_id, pin_id)
  values (v_uid, v_id)
  on conflict do nothing;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Backfill: make every existing pin's creator a follower of that pin.
-- ---------------------------------------------------------------------------
insert into public.pin_follows (user_id, pin_id)
select created_by, id
from public.pins
where created_by is not null
on conflict do nothing;
