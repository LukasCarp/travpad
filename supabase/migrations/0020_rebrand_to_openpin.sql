-- 0020: Rename brand references in seeded data from "TravPad" to "OpenPin".
-- Idempotent — running it twice does nothing.

update public.badges
set description = 'Added your first pin to OpenPin.'
where slug = 'first_pin';
