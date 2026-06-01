-- 0019: Add per-image attribution metadata so Wikimedia Commons photos
-- can carry photographer + license inline (CC BY/SA requires the credit
-- to be visible at the work, not three clicks away on /credits).
-- Idempotent.

alter table public.pin_images
  add column if not exists credit_json jsonb;

-- Anyone can read it (it's already public attribution data) — RLS on
-- pin_images already allows select to all.

-- Re-create pins_view so each image carries its credit alongside the path.
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
        jsonb_build_object(
          'id', pi.id,
          'storage_path', pi.storage_path,
          'credit_json', pi.credit_json
        )
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
