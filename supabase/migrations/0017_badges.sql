-- 0017: Phase 1 badge system. Five badges driven entirely from existing
-- tables (pins, pin_images, list_pins) — no new event log, no scoring
-- engine. Server-side triggers re-evaluate on the events that can move
-- a user past a threshold.
-- Idempotent.

-- ---------------------------------------------------------------------------
-- catalogue
-- ---------------------------------------------------------------------------
create table if not exists public.badges (
  slug        text primary key,
  name        text not null,
  description text not null,
  icon        text not null,           -- lucide-react component name
  sort_order  int  not null default 0
);

alter table public.badges enable row level security;

drop policy if exists "badges_read" on public.badges;
create policy "badges_read" on public.badges for select using (true);

-- Earned badges. One row per (user, badge); earned_at frozen on first award.
create table if not exists public.user_badges (
  user_id   uuid not null references auth.users(id) on delete cascade,
  badge     text not null references public.badges(slug) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge)
);

create index if not exists user_badges_user_idx on public.user_badges (user_id);

alter table public.user_badges enable row level security;

drop policy if exists "user_badges_read" on public.user_badges;
create policy "user_badges_read" on public.user_badges for select using (true);

-- Seed the Phase 1 catalogue. Re-runnable thanks to ON CONFLICT.
insert into public.badges (slug, name, description, icon, sort_order) values
  ('first_pin',     'First Pin',     'Added your first pin to OpenPin.',                                   'Sparkles',   10),
  ('explorer',      'Explorer',      'Added 10 pins to the map.',                                          'Compass',    20),
  ('wanderer',      'Wanderer',      'Pinned places in 5 different areas around the world.',              'Globe',      30),
  ('sharp_eye',     'Sharp Eye',     'At least 70% of your pins have a photo and a thoughtful write-up.',  'BadgeCheck', 40),
  ('saved_by_many', 'Saved by Many', 'Your pins have been added to other people''s lists 10 times.',      'Bookmark',   50)
on conflict (slug) do update set
  name        = excluded.name,
  description = excluded.description,
  icon        = excluded.icon,
  sort_order  = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- evaluator
-- ---------------------------------------------------------------------------
-- Evaluate every Phase 1 badge for one user and insert any newly earned
-- ones. Cheap (a handful of counts) and idempotent (existing rows survive
-- via ON CONFLICT DO NOTHING).
create or replace function public.award_badges(target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pin_count    int;
  area_count   int;
  quality_pins int;
  saved_count  int;
begin
  if target_user is null then
    return;
  end if;

  select count(*) into pin_count
    from public.pins
    where created_by = target_user;

  if pin_count >= 1 then
    insert into public.user_badges (user_id, badge)
      values (target_user, 'first_pin')
      on conflict do nothing;
  end if;

  if pin_count >= 10 then
    insert into public.user_badges (user_id, badge)
      values (target_user, 'explorer')
      on conflict do nothing;
  end if;

  -- Wanderer — distinct ~55 km cells (half-degree grid). Rough proxy for
  -- "visited five different city-sized areas".
  select count(*) into area_count
    from (
      select distinct floor(lat * 2) as ly, floor(lng * 2) as lx
        from public.pins
        where created_by = target_user
    ) cells;

  if area_count >= 5 then
    insert into public.user_badges (user_id, badge)
      values (target_user, 'wanderer')
      on conflict do nothing;
  end if;

  -- Sharp Eye — needs at least five pins so the ratio is meaningful,
  -- and ≥70% of those pins must have BOTH an image and a description
  -- of ≥80 characters.
  if pin_count >= 5 then
    select count(*) into quality_pins
      from public.pins p
      where p.created_by = target_user
        and coalesce(char_length(p.description), 0) >= 80
        and exists (
          select 1 from public.pin_images pi where pi.pin_id = p.id
        );

    if quality_pins::numeric / pin_count::numeric >= 0.7 then
      insert into public.user_badges (user_id, badge)
        values (target_user, 'sharp_eye')
        on conflict do nothing;
    end if;
  end if;

  -- Saved by Many — total list-inclusions of this user's pins by other
  -- users (own lists don't count).
  select count(*) into saved_count
    from public.list_pins lp
    join public.pins  p on p.id = lp.pin_id
    join public.lists l on l.id = lp.list_id
    where p.created_by = target_user
      and l.owner     <> target_user;

  if saved_count >= 10 then
    insert into public.user_badges (user_id, badge)
      values (target_user, 'saved_by_many')
      on conflict do nothing;
  end if;
end;
$$;

grant execute on function public.award_badges(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- triggers — recompute on the events that can move a threshold.
-- ---------------------------------------------------------------------------
create or replace function public.trg_award_after_pin_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.award_badges(coalesce(new.created_by, old.created_by));
  return new;
end;
$$;

drop trigger if exists pins_award_badges on public.pins;
create trigger pins_award_badges
  after insert or update of description, lat, lng on public.pins
  for each row execute function public.trg_award_after_pin_change();

create or replace function public.trg_award_after_pin_image_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
begin
  select created_by into owner_id
    from public.pins
    where id = coalesce(new.pin_id, old.pin_id);
  perform public.award_badges(owner_id);
  return new;
end;
$$;

drop trigger if exists pin_images_award_badges on public.pin_images;
create trigger pin_images_award_badges
  after insert or delete on public.pin_images
  for each row execute function public.trg_award_after_pin_image_change();

create or replace function public.trg_award_after_list_pin_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
begin
  select created_by into owner_id
    from public.pins
    where id = coalesce(new.pin_id, old.pin_id);
  perform public.award_badges(owner_id);
  return new;
end;
$$;

drop trigger if exists list_pins_award_badges on public.list_pins;
create trigger list_pins_award_badges
  after insert or delete on public.list_pins
  for each row execute function public.trg_award_after_list_pin_change();

-- ---------------------------------------------------------------------------
-- backfill — give every existing pin owner the badges they already qualify
-- for, so the system doesn't start everyone at zero.
-- ---------------------------------------------------------------------------
do $$
declare
  uid uuid;
begin
  for uid in
    select distinct created_by
      from public.pins
      where created_by is not null
  loop
    perform public.award_badges(uid);
  end loop;
end $$;
