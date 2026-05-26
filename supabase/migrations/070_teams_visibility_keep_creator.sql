-- Ensure the tool creator keeps access when visibility = 'teams', even if
-- they are not a member of any selected team. Same behavior as 'restricted'
-- (where the creator is auto-added to event_tool_members via trigger).

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
      when exists (
        -- Creator of a 'teams'-visibility tool keeps access even when not in
        -- any selected team (parity with the auto-admin trigger that covers
        -- the 'restricted' case via event_tool_members).
        select 1
        from public.event_tools t
        where t.event_tool_id = p_tool_id
          and t.event_tool_visibility = 'teams'
          and t.event_tool_created_by = p_user_id
      ) then true
      else false
    end;
$$;

-- Make sure the creator appears in the effective-members list too (used by
-- expenses, settlements, etc.).
create or replace function public.get_event_tool_effective_members(p_tool_id uuid)
returns table (
  user_id uuid,
  full_name text,
  avatar_url text
)
language sql security definer stable set search_path = '' as $$
  with tool as (
    select event_tool_visibility, event_tool_event_id, event_tool_created_by
    from public.event_tools
    where event_tool_id = p_tool_id
  )
  select distinct u.id, u.full_name, u.avatar_url
  from public.event_participants p
  join public.users u on u.id = p.event_participant_user_id
  join tool t on true
  where t.event_tool_visibility = 'all'
    and p.event_participant_event_id = t.event_tool_event_id
    and public.can_see_event_tool(p_tool_id, auth.uid())
  union
  select distinct u.id, u.full_name, u.avatar_url
  from public.event_tool_members m
  join public.users u on u.id = m.event_tool_member_user_id
  join tool t on true
  where t.event_tool_visibility = 'restricted'
    and m.event_tool_member_event_tool_id = p_tool_id
    and public.can_see_event_tool(p_tool_id, auth.uid())
  union
  select distinct u.id, u.full_name, u.avatar_url
  from public.event_tool_teams_access a
  join public.event_tool_team_member tm
    on tm.event_tool_team_member_team_id = a.event_tool_teams_access_team_id
  join public.users u on u.id = tm.event_tool_team_member_user_id
  join tool t on true
  where t.event_tool_visibility = 'teams'
    and a.event_tool_teams_access_event_tool_id = p_tool_id
    and public.can_see_event_tool(p_tool_id, auth.uid())
  union
  select u.id, u.full_name, u.avatar_url
  from public.users u
  join tool t on t.event_tool_created_by = u.id
  where t.event_tool_visibility = 'teams'
    and public.can_see_event_tool(p_tool_id, auth.uid());
$$;
