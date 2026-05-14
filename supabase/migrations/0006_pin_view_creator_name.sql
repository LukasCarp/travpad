-- TravPad: expose pin creator's display_name on pins_view so the client can
-- render "Skapad av X" without an extra query per pin.
-- Idempotent: safe to re-run.

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
  ) as images,
  (select display_name from public.profiles where id = p.created_by) as created_by_name
from public.pins p;

alter view public.pins_view set (security_invoker = true);
