-- Reapply can_see_event_tool without the event-admin backdoor that was
-- inadvertently introduced in 068. Behavior for non-team visibilities now
-- matches what existed before 068.
create or replace function public.can_see_event_tool(p_tool_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select
    case
      when exists (
        select 1
        from public.event_tools t
        where t.event_tool_id = p_tool_id
          and t.event_tool_visibility = 'all'
          and public.is_event_participant(t.event_tool_event_id, p_user_id)
      ) then true
      when exists (
        select 1 from public.event_tool_members
        where event_tool_member_event_tool_id = p_tool_id
          and event_tool_member_user_id = p_user_id
      ) then true
      when exists (
        select 1
        from public.event_tools t
        join public.event_tool_teams_access a
          on a.event_tool_teams_access_event_tool_id = t.event_tool_id
        join public.event_tool_team_member m
          on m.event_tool_team_member_team_id = a.event_tool_teams_access_team_id
        where t.event_tool_id = p_tool_id
          and t.event_tool_visibility = 'teams'
          and m.event_tool_team_member_user_id = p_user_id
      ) then true
      else false
    end;
$$;
