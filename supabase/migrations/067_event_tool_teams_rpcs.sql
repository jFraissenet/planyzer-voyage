-- ============================================================================
-- Teams tool RPCs:
--   - get_event_tool_teams(tool_id): list teams with members & linked plannings
--   - upsert_event_tool_team(...): atomic create-or-replace of a team, its
--     members and its planning links — materializes planning slots when the
--     team has dates set
--   - delete_event_tool_team(team_id): cascade-delete (members + links +
--     mirrored slots via FK cascade)
--   - list_event_planning_tools(event_id): list planning tools of an event
--     (filtered by the caller's access) for the team-edit dropdown
--   - sync_event_tool_team_planning_slots(team_id): internal helper that
--     re-materializes the team's slots based on its current dates + members +
--     links. Called by upsert and by the trigger below.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Internal: re-sync the planning slots of a team based on its current state.
-- For each (team, planning_link):
--   - if team has no starts_at → delete any mirrored slot
--   - else → upsert the slot (title/dates/has_time) and replace its
--     participants with the team's members
-- Slots whose planning link no longer exists are removed.
-- ---------------------------------------------------------------------------
create or replace function public.sync_event_tool_team_planning_slots(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team record;
  v_link record;
  v_slot_id uuid;
begin
  select * into v_team from public.event_tool_team
  where event_tool_team_id = p_team_id;
  if not found then return; end if;

  -- Remove slots whose planning is no longer linked
  delete from public.event_tool_planning_slot
  where event_tool_planning_slot_team_id = p_team_id
    and event_tool_planning_slot_event_tool_id not in (
      select event_tool_team_planning_link_planning_tool_id
      from public.event_tool_team_planning_link
      where event_tool_team_planning_link_team_id = p_team_id
    );

  for v_link in
    select event_tool_team_planning_link_planning_tool_id as planning_tool_id
    from public.event_tool_team_planning_link
    where event_tool_team_planning_link_team_id = p_team_id
  loop
    if v_team.event_tool_team_starts_at is null then
      delete from public.event_tool_planning_slot
      where event_tool_planning_slot_team_id = p_team_id
        and event_tool_planning_slot_event_tool_id = v_link.planning_tool_id;
    else
      select event_tool_planning_slot_id into v_slot_id
      from public.event_tool_planning_slot
      where event_tool_planning_slot_team_id = p_team_id
        and event_tool_planning_slot_event_tool_id = v_link.planning_tool_id
      limit 1;

      if v_slot_id is null then
        insert into public.event_tool_planning_slot (
          event_tool_planning_slot_event_tool_id,
          event_tool_planning_slot_title,
          event_tool_planning_slot_starts_at,
          event_tool_planning_slot_ends_at,
          event_tool_planning_slot_has_time,
          event_tool_planning_slot_author_id,
          event_tool_planning_slot_team_id
        ) values (
          v_link.planning_tool_id,
          v_team.event_tool_team_name,
          v_team.event_tool_team_starts_at,
          v_team.event_tool_team_ends_at,
          coalesce(v_team.event_tool_team_has_time, true),
          coalesce(v_team.event_tool_team_author_id, auth.uid()),
          p_team_id
        )
        returning event_tool_planning_slot_id into v_slot_id;
      else
        update public.event_tool_planning_slot set
          event_tool_planning_slot_title = v_team.event_tool_team_name,
          event_tool_planning_slot_starts_at = v_team.event_tool_team_starts_at,
          event_tool_planning_slot_ends_at = v_team.event_tool_team_ends_at,
          event_tool_planning_slot_has_time = coalesce(v_team.event_tool_team_has_time, true)
        where event_tool_planning_slot_id = v_slot_id;
      end if;

      delete from public.event_tool_planning_slot_participant
      where event_tool_planning_slot_participant_slot_id = v_slot_id;

      insert into public.event_tool_planning_slot_participant (
        event_tool_planning_slot_participant_slot_id,
        event_tool_planning_slot_participant_user_id
      )
      select v_slot_id, event_tool_team_member_user_id
      from public.event_tool_team_member
      where event_tool_team_member_team_id = p_team_id
      on conflict do nothing;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- LIST teams of a teams-tool instance
-- ---------------------------------------------------------------------------
create or replace function public.get_event_tool_teams(p_tool_id uuid)
returns table (
  team_id uuid,
  name text,
  type text,
  color text,
  starts_at timestamptz,
  ends_at timestamptz,
  has_time boolean,
  author_id uuid,
  author_full_name text,
  author_avatar_url text,
  created_at timestamptz,
  updated_at timestamptz,
  members jsonb,
  planning_tool_ids jsonb
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    t.event_tool_team_id,
    t.event_tool_team_name,
    t.event_tool_team_type,
    t.event_tool_team_color,
    t.event_tool_team_starts_at,
    t.event_tool_team_ends_at,
    t.event_tool_team_has_time,
    t.event_tool_team_author_id,
    u.full_name,
    u.avatar_url,
    t.event_tool_team_created_at,
    t.event_tool_team_updated_at,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'user_id', mu.id,
            'full_name', mu.full_name,
            'avatar_url', mu.avatar_url
          )
          order by mu.full_name
        )
        from public.event_tool_team_member m
        left join public.users mu
          on mu.id = m.event_tool_team_member_user_id
        where m.event_tool_team_member_team_id = t.event_tool_team_id
      ),
      '[]'::jsonb
    ),
    coalesce(
      (
        select jsonb_agg(
          l.event_tool_team_planning_link_planning_tool_id
          order by l.event_tool_team_planning_link_created_at
        )
        from public.event_tool_team_planning_link l
        where l.event_tool_team_planning_link_team_id = t.event_tool_team_id
      ),
      '[]'::jsonb
    )
  from public.event_tool_team t
  left join public.users u on u.id = t.event_tool_team_author_id
  where t.event_tool_team_event_tool_id = p_tool_id
    and public.can_see_event_tool(p_tool_id, auth.uid())
  order by
    coalesce(t.event_tool_team_starts_at, t.event_tool_team_created_at) asc,
    t.event_tool_team_created_at asc;
$$;

grant execute on function public.get_event_tool_teams(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- UPSERT a team + members + planning links atomically
--   p_member_ids        : jsonb array of user_id strings
--   p_planning_tool_ids : jsonb array of planning event_tool_id strings
-- Slots in linked plannings are materialized/synced (when team has dates).
-- ---------------------------------------------------------------------------
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
  p_planning_tool_ids jsonb
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
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
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
      event_tool_team_author_id
    ) values (
      p_tool_id,
      p_name,
      nullif(p_type, ''),
      coalesce(nullif(p_color, ''), '#10B981'),
      p_starts_at,
      p_ends_at,
      coalesce(p_has_time, true),
      v_user_id
    )
    returning event_tool_team_id into v_team_id;
  else
    select event_tool_team_author_id, event_tool_team_event_tool_id
      into v_existing_author, v_existing_tool
    from public.event_tool_team
    where event_tool_team_id = v_team_id;

    if v_existing_tool is null then
      raise exception 'not_found';
    end if;
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
      event_tool_team_has_time = coalesce(p_has_time, true)
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

  -- Replace planning links
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

  perform public.sync_event_tool_team_planning_slots(v_team_id);

  return v_team_id;
end;
$$;

grant execute on function public.upsert_event_tool_team(
  uuid, uuid, text, text, text, timestamptz, timestamptz, boolean, jsonb, jsonb
) to authenticated;

-- ---------------------------------------------------------------------------
-- DELETE a team (cascades to members, links, mirrored slots via FKs)
-- ---------------------------------------------------------------------------
create or replace function public.delete_event_tool_team(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_author uuid;
  v_tool uuid;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  select event_tool_team_author_id, event_tool_team_event_tool_id
    into v_author, v_tool
  from public.event_tool_team where event_tool_team_id = p_team_id;
  if v_tool is null then raise exception 'not_found'; end if;
  if v_author is distinct from v_user_id
     and not public.is_event_tool_admin(v_tool, v_user_id) then
    raise exception 'not_authorized';
  end if;
  delete from public.event_tool_team where event_tool_team_id = p_team_id;
end;
$$;

grant execute on function public.delete_event_tool_team(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- List planning tools of an event the caller can see (for the team-edit
-- dropdown). RLS would naturally filter event_tools, but we expose a clean
-- typed RPC limited to type 'planning'.
-- ---------------------------------------------------------------------------
create or replace function public.list_event_planning_tools(p_event_id uuid)
returns table (
  tool_id uuid,
  name text
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    t.event_tool_id,
    t.event_tool_name
  from public.event_tools t
  where t.event_tool_event_id = p_event_id
    and t.event_tool_type_code = 'planning'
    and public.can_see_event_tool(t.event_tool_id, auth.uid())
  order by t.event_tool_name;
$$;

grant execute on function public.list_event_planning_tools(uuid) to authenticated;
