-- Get event_tool_members with user info (for the "Manage access" modal)
-- Reuses can_see_event_tool to gate access
create or replace function public.get_event_tool_members(p_tool_id uuid)
returns table (
  user_id uuid,
  full_name text,
  avatar_url text,
  role_code text,
  added_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    u.id as user_id,
    u.full_name,
    u.avatar_url,
    m.event_tool_member_role_code as role_code,
    m.event_tool_member_added_at as added_at
  from public.event_tool_members m
  join public.users u on u.id = m.event_tool_member_user_id
  where m.event_tool_member_event_tool_id = p_tool_id
    and public.can_see_event_tool(p_tool_id, auth.uid())
  order by m.event_tool_member_added_at;
$$;

grant execute on function public.get_event_tool_members(uuid) to authenticated;
