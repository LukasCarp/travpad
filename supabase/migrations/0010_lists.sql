-- 0010: shareable pin lists. A user curates pins into named lists that are
-- public on their profile. Only the list owner can edit a list's pins.
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- lists
-- ---------------------------------------------------------------------------
create table if not exists public.lists (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

create index if not exists lists_owner_idx on public.lists (owner);

alter table public.lists enable row level security;

drop policy if exists "lists_read" on public.lists;
create policy "lists_read" on public.lists for select using (true);

drop policy if exists "lists_insert_own" on public.lists;
create policy "lists_insert_own" on public.lists for insert
  with check (auth.uid() = owner);

drop policy if exists "lists_update_own" on public.lists;
create policy "lists_update_own" on public.lists for update
  using (auth.uid() = owner) with check (auth.uid() = owner);

drop policy if exists "lists_delete_own" on public.lists;
create policy "lists_delete_own" on public.lists for delete
  using (auth.uid() = owner);

-- ---------------------------------------------------------------------------
-- list_pins — pins belonging to a list
-- ---------------------------------------------------------------------------
create table if not exists public.list_pins (
  list_id  uuid not null references public.lists(id) on delete cascade,
  pin_id   uuid not null references public.pins(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (list_id, pin_id)
);

create index if not exists list_pins_pin_id_idx on public.list_pins (pin_id);

alter table public.list_pins enable row level security;

drop policy if exists "list_pins_read" on public.list_pins;
create policy "list_pins_read" on public.list_pins for select using (true);

-- Only the owner of the parent list may add/remove pins.
drop policy if exists "list_pins_insert" on public.list_pins;
create policy "list_pins_insert" on public.list_pins for insert
  with check (
    exists (
      select 1 from public.lists l
      where l.id = list_id and l.owner = auth.uid()
    )
  );

drop policy if exists "list_pins_delete" on public.list_pins;
create policy "list_pins_delete" on public.list_pins for delete
  using (
    exists (
      select 1 from public.lists l
      where l.id = list_id and l.owner = auth.uid()
    )
  );
