-- ---------------------------------------------------------------------------
-- Split the See/Do category into Sights + Activities. Adventure & Sports
-- and Workshops & Classes move under Activities; everything else stays as
-- Sights (passive sightseeing).
--
-- Run once. Idempotent in practice because the WHERE clause excludes pins
-- whose category has already been migrated.
-- ---------------------------------------------------------------------------
update public.pins
set category = case
  when subcategory in ('Adventure & Sports', 'Workshops & Classes')
    then 'Activities'
  else 'Sights'
end
where category = 'See/Do';
