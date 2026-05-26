-- Migration 073's rewrite of upsert_event_tool_team dropped the planning
-- link replace step, so teams stopped appearing on their linked plannings.
-- Restore the delete + insert of event_tool_team_planning_link rows.

create or replace function public.upsert_event_tool_team(
  p_team_id uuid,
  p_tool_id uuid,
  p_name text,
  p_type text,
  p_color text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_has_time boolean,
  p_member_ids jsonb,
  p_planning_tool_ids jsonb,
  p_max_members int
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_team_id uuid := p_team_id;
  v_existing_author uuid;
  v_existing_tool uuid;
  v_member_count int;
  v_resp uuid;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;

  v_member_count := case
    when jsonb_typeof(p_member_ids) = 'array'
    then jsonb_array_length(p_member_ids) else 0 end;

  if p_max_members is not null and v_member_count > p_max_members then
    raise exception 'team_full' using errcode = 'P0001';
  end if;

  if v_team_id is null then
    if not public.can_see_event_tool(p_tool_id, v_user_id) then
      raise exception 'not_authorized';
    end if;
    insert into public.event_tool_team (
      event_tool_team_event_tool_id,
      event_tool_team_name,
      event_tool_team_type,
      event_tool_team_color,
      event_tool_team_starts_at,
      event_tool_team_ends_at,
      event_tool_team_has_time,
      event_tool_team_author_id,
      event_tool_team_max_members
    ) values (
      p_tool_id,
      p_name,
      nullif(p_type, ''),
      coalesce(nullif(p_color, ''), '#10B981'),
      p_starts_at,
      p_ends_at,
      coalesce(p_has_time, true),
      v_user_id,
      p_max_members
    )
    returning event_tool_team_id into v_team_id;
  else
    select event_tool_team_author_id, event_tool_team_event_tool_id
      into v_existing_author, v_existing_tool
    from public.event_tool_team
    where event_tool_team_id = v_team_id;

    if v_existing_tool is null then raise exception 'not_found'; end if;
    if v_existing_author is distinct from v_user_id
       and not public.is_event_tool_manager(v_existing_tool, v_user_id) then
      raise exception 'not_authorized';
    end if;

    update public.event_tool_team set
      event_tool_team_name = p_name,
      event_tool_team_type = nullif(p_type, ''),
      event_tool_team_color = coalesce(nullif(p_color, ''), '#10B981'),
      event_tool_team_starts_at = p_starts_at,
      event_tool_team_ends_at = p_ends_at,
      event_tool_team_has_time = coalesce(p_has_time, true),
      event_tool_team_max_members = p_max_members
    where event_tool_team_id = v_team_id;
  end if;

  -- Replace members
  delete from public.event_tool_team_member
  where event_tool_team_member_team_id = v_team_id;

  if jsonb_typeof(p_member_ids) = 'array'
     and jsonb_array_length(p_member_ids) > 0 then
    insert into public.event_tool_team_member (
      event_tool_team_member_team_id,
      event_tool_team_member_user_id
    )
    select v_team_id, uid::uuid
    from jsonb_array_elements_text(p_member_ids) as uid
    on conflict do nothing;
  end if;

  -- Replace planning links (was lost in 073)
  delete from public.event_tool_team_planning_link
  where event_tool_team_planning_link_team_id = v_team_id;

  if jsonb_typeof(p_planning_tool_ids) = 'array'
     and jsonb_array_length(p_planning_tool_ids) > 0 then
    insert into public.event_tool_team_planning_link (
      event_tool_team_planning_link_team_id,
      event_tool_team_planning_link_planning_tool_id
    )
    select v_team_id, pid::uuid
    from jsonb_array_elements_text(p_planning_tool_ids) as pid
    on conflict do nothing;
  end if;

  -- Drop responsable if no longer a member
  select event_tool_team_responsable_id into v_resp
  from public.event_tool_team where event_tool_team_id = v_team_id;
  if v_resp is not null and not exists (
    select 1 from public.event_tool_team_member
    where event_tool_team_member_team_id = v_team_id
      and event_tool_team_member_user_id = v_resp
  ) then
    update public.event_tool_team
    set event_tool_team_responsable_id = null
    where event_tool_team_id = v_team_id;
  end if;

  perform public.sync_event_tool_team_planning_slots(v_team_id);
  return v_team_id;
end;
$$;
