-- TravPad: migrate existing pins from the old Swedish taxonomy to the new
-- English taxonomy. Run once in the Supabase SQL editor.
--
-- The new taxonomy has no clean 1:1 mapping (no Transport/Other category), so
-- pins are mapped to the nearest category and their subcategory + services are
-- cleared — re-edit each migrated pin to pick a proper subcategory and chips.
--
-- Assumes pins.category / pins.subcategory are free-text columns. If a CHECK
-- constraint or enum exists, update it first.

update pins set
  category = case category
    when 'Mat'        then 'Eat/Drink'
    when 'Boende'     then 'Sleep'
    when 'Sevärdhet'  then 'See/Do'
    when 'Aktivitet'  then 'See/Do'
    when 'Transport'  then 'See/Do'
    when 'Annat'      then 'See/Do'
    else category
  end,
  subcategory = null,
  services = '{}'
where category in ('Mat', 'Boende', 'Sevärdhet', 'Aktivitet', 'Transport', 'Annat');
