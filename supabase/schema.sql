-- OpenPin — helper view + RPC for working with PostGIS pins from the JS client.
-- Run this in the Supabase SQL editor once. Adjust column names if your `pins`
-- table uses different ones than the assumptions below.
--
-- Assumed `pins` columns:
--   id          uuid (default gen_random_uuid())
--   title       text
--   category    text
--   location    geography(Point, 4326)
--   details     jsonb
--   created_by  uuid references auth.users(id)
--   created_at  timestamptz
--   updated_at  timestamptz

-- View that exposes the PostGIS point as plain lat/lng so the JS client can
-- consume it without GIS-aware tooling.
create or replace view public.pins_view as
select
  id,
  title,
  category,
  details,
  st_y(location::geometry) as lat,
  st_x(location::geometry) as lng,
  created_by,
  created_at
from public.pins;

-- Insert helper: takes lat/lng, builds the PostGIS point on the server side,
-- and stamps the row with the authenticated user via auth.uid().
create or replace function public.create_pin(
  p_title    text,
  p_category text,
  p_lat      double precision,
  p_lng      double precision,
  p_details  jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_id uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;

  insert into public.pins (title, category, location, details, created_by)
  values (
    p_title,
    p_category,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
    coalesce(p_details, '{}'::jsonb),
    v_uid
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- Make sure RLS on the view falls back to the underlying table's policies.
alter view public.pins_view set (security_invoker = true);
