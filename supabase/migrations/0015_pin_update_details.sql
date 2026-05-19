-- ---------------------------------------------------------------------------
-- update_pin now also accepts and stores the `details` jsonb — used for a
-- pin's website / phone / email. The old 11-arg signature is dropped first so
-- the function isn't left as an overload.
-- ---------------------------------------------------------------------------
drop function if exists public.update_pin(
  uuid, text, text, double precision, double precision,
  text, text, text, jsonb, text[], boolean
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
  p_secret            boolean  default false,
  p_details           jsonb    default '{}'::jsonb
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
    details           = coalesce(p_details, '{}'::jsonb),
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
      'secret', coalesce(p_secret, false),
      'details', coalesce(p_details, '{}'::jsonb)
    )
  );
end;
$$;
