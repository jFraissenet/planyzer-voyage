-- Backfill: tools that were switched to 'restricted' before the UPDATE
-- trigger (migration 071) have an empty event_tool_members set and are now
-- invisible to everyone. Set fraissenet.jeremy@gmail.com as the admin member
-- on those orphan tools.

do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id
  from auth.users
  where email = 'fraissenet.jeremy@gmail.com'
  limit 1;

  if v_user_id is null then
    raise notice 'fraissenet.jeremy@gmail.com not found — skipping backfill';
    return;
  end if;

  insert into public.event_tool_members (
    event_tool_member_event_tool_id,
    event_tool_member_user_id,
    event_tool_member_role_code
  )
  select t.event_tool_id, v_user_id, 'admin'
  from public.event_tools t
  where t.event_tool_visibility = 'restricted'
    and not exists (
      select 1 from public.event_tool_members m
      where m.event_tool_member_event_tool_id = t.event_tool_id
    )
  on conflict do nothing;
end $$;
