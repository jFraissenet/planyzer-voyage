-- ============================================================================
-- Teams: add an optional free-text description per team, shown on the card
-- under the participants. Extends get_event_tool_teams (returns it) and
-- upsert_event_tool_team (accepts it).
-- ============================================================================

alter table public.event_tool_team
  add column if not exists event_tool_team_description text;

-- ---------------------------------------------------------------------------
-- get_event_tool_teams — add `description`. Return type changes, so drop first.
-- ---------------------------------------------------------------------------
drop function if exists public.get_event_tool_teams(uuid);

create or replace function public.get_event_tool_teams(p_tool_id uuid)
returns table (
  team_id uuid,
  name text,
  type text,
  description text,
  color text,
  starts_at timestamptz,
  ends_at timestamptz,
  has_time boolean,
  author_id uuid,
  author_full_name text,
  author_avatar_url text,
  responsable_id uuid,
  responsable_full_name text,
  responsable_avatar_url text,
  max_members int,
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
    t.event_tool_team_description,
    t.event_tool_team_color,
    t.event_tool_team_starts_at,
    t.event_tool_team_ends_at,
    t.event_tool_team_has_time,
    t.event_tool_team_author_id,
    u.full_name,
    u.avatar_url,
    t.event_tool_team_responsable_id,
    ru.full_name,
    ru.avatar_url,
    t.event_tool_team_max_members,
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
  left join public.users ru on ru.id = t.event_tool_team_responsable_id
  where t.event_tool_team_event_tool_id = p_tool_id
    and public.can_see_event_tool(p_tool_id, auth.uid())
  order by
    coalesce(t.event_tool_team_starts_at, t.event_tool_team_created_at) asc,
    t.event_tool_team_created_at asc;
$$;

grant execute on function public.get_event_tool_teams(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- upsert_event_tool_team — accept p_description. New arg list → drop the old
-- 11-arg signature, then recreate with the extra param.
-- ---------------------------------------------------------------------------
drop function if exists public.upsert_event_tool_team(
  uuid, uuid, text, text, text, timestamptz, timestamptz, boolean, jsonb, jsonb, int
);

create or replace function public.upsert_event_tool_team(
  p_team_id uuid,
  p_tool_id uuid,
  p_name text,
  p_type text,
  p_description text,
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
      event_tool_team_description,
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
      nullif(p_description, ''),
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
      event_tool_team_description = nullif(p_description, ''),
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

grant execute on function public.upsert_event_tool_team(
  uuid, uuid, text, text, text, text, timestamptz, timestamptz, boolean, jsonb, jsonb, int
) to authenticated;
