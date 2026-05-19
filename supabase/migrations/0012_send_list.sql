-- ---------------------------------------------------------------------------
-- send_list — copies a list (and its pins) into a followed user's account.
-- The recipient owns the copy, so it shows up on their profile's Lists tab.
-- security definer so it can insert a list owned by someone else; the body
-- enforces that the caller follows the recipient.
-- ---------------------------------------------------------------------------
create or replace function public.send_list(
  p_list_id      uuid,
  p_recipient_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_name   text;
  v_new_id uuid;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;

  if p_recipient_id = v_uid then
    raise exception 'cannot send a list to yourself';
  end if;

  -- The caller must follow the recipient.
  if not exists (
    select 1 from public.follows
    where follower_id = v_uid and following_id = p_recipient_id
  ) then
    raise exception 'you can only send lists to people you follow';
  end if;

  select name into v_name from public.lists where id = p_list_id;
  if v_name is null then
    raise exception 'list not found';
  end if;

  insert into public.lists (owner, name)
  values (p_recipient_id, v_name)
  returning id into v_new_id;

  insert into public.list_pins (list_id, pin_id, added_at)
  select v_new_id, pin_id, now()
  from public.list_pins
  where list_id = p_list_id;

  return v_new_id;
end;
$$;

grant execute on function public.send_list(uuid, uuid) to authenticated;
