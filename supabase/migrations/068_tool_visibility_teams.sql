-- ============================================================================
-- Tool visibility mode 'teams' (phase 2 of the Teams tool).
-- A tool can now be visible to all participants ('all'), to an explicit list
-- of users ('restricted'), or to the members of one or several teams
-- ('teams'). The 'teams' mode is mutually exclusive with 'restricted' — no
-- combination is supported, by design.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Extend the check constraint to accept 'teams'
-- ---------------------------------------------------------------------------
alter table public.event_tools
  drop constraint if exists event_tools_event_tool_visibility_check;

alter table public.event_tools
  add constraint event_tools_event_tool_visibility_check
  check (event_tool_visibility in ('all', 'restricted', 'teams'));

-- ---------------------------------------------------------------------------
-- Join table: which teams grant access to a tool when visibility = 'teams'.
-- Rows are ignored for other visibility modes.
-- ---------------------------------------------------------------------------
create table public.event_tool_teams_access (
  event_tool_teams_access_event_tool_id uuid not null
    references public.event_tools(event_tool_id) on delete cascade,
  event_tool_teams_access_team_id uuid not null
    references public.event_tool_team(event_tool_team_id) on delete cascade,
  event_tool_teams_access_added_at timestamptz not null default now(),
  primary key (
    event_tool_teams_access_event_tool_id,
    event_tool_teams_access_team_id
  )
);

create index event_tool_teams_access_team_idx
  on public.event_tool_teams_access(event_tool_teams_access_team_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.event_tool_teams_access enable row level security;

create policy "Tool members can read team access rows"
  on public.event_tool_teams_access for select
  using (public.can_see_event_tool(
    event_tool_teams_access_event_tool_id, auth.uid()
  ));

create policy "Tool admins can write team access rows"
  on public.event_tool_teams_access for all
  using (public.is_event_tool_admin(
    event_tool_teams_access_event_tool_id, auth.uid()
  ))
  with check (public.is_event_tool_admin(
    event_tool_teams_access_event_tool_id, auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- Replace can_see_event_tool to handle the 'teams' branch
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Extend effective members of a tool to handle 'teams' mode (union of all
-- members of the accessed teams, deduplicated).
-- ---------------------------------------------------------------------------
create or replace function public.get_event_tool_effective_members(p_tool_id uuid)
returns table (
  user_id uuid,
  full_name text,
  avatar_url text
)
language sql security definer stable set search_path = '' as $$
  with tool as (
    select event_tool_visibility, event_tool_event_id
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
    and public.can_see_event_tool(p_tool_id, auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- RPC: list the teams in an event where the caller is a member. Used by the
-- 3rd-mode dropdown in the tool-rights modal (effet surprise: only my teams).
-- ---------------------------------------------------------------------------
create or replace function public.list_my_event_tool_teams(p_event_id uuid)
returns table (
  team_id uuid,
  name text,
  color text,
  type text
)
language sql
security definer
stable
set search_path = ''
as $$
  select distinct
    t.event_tool_team_id,
    t.event_tool_team_name,
    t.event_tool_team_color,
    t.event_tool_team_type
  from public.event_tool_team t
  join public.event_tools tool
    on tool.event_tool_id = t.event_tool_team_event_tool_id
  join public.event_tool_team_member m
    on m.event_tool_team_member_team_id = t.event_tool_team_id
  where tool.event_tool_event_id = p_event_id
    and m.event_tool_team_member_user_id = auth.uid()
  order by t.event_tool_team_name;
$$;

grant execute on function public.list_my_event_tool_teams(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: list teams currently granting access to a tool (visibility='teams').
-- Returns ALL accessed teams, even those the caller is not a member of, as
-- long as the caller can see the tool — used to render the current selection
-- in the edit modal for tool admins.
-- ---------------------------------------------------------------------------
create or replace function public.get_event_tool_teams_access(p_tool_id uuid)
returns table (
  team_id uuid,
  name text,
  color text,
  type text
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    t.event_tool_team_id,
    t.event_tool_team_name,
    t.event_tool_team_color,
    t.event_tool_team_type
  from public.event_tool_teams_access a
  join public.event_tool_team t
    on t.event_tool_team_id = a.event_tool_teams_access_team_id
  where a.event_tool_teams_access_event_tool_id = p_tool_id
    and public.can_see_event_tool(p_tool_id, auth.uid())
  order by t.event_tool_team_name;
$$;

grant execute on function public.get_event_tool_teams_access(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: replace the tool's accessed-teams set atomically. Only tool admins
-- can call it. Does not touch the visibility column itself — the caller is
-- expected to also set event_tool_visibility='teams' on the tool.
-- ---------------------------------------------------------------------------
create or replace function public.set_event_tool_teams_access(
  p_tool_id uuid,
  p_team_ids jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  if not public.is_event_tool_admin(p_tool_id, v_user_id) then
    raise exception 'not_authorized';
  end if;

  delete from public.event_tool_teams_access
  where event_tool_teams_access_event_tool_id = p_tool_id;

  if jsonb_typeof(p_team_ids) = 'array'
     and jsonb_array_length(p_team_ids) > 0 then
    insert into public.event_tool_teams_access (
      event_tool_teams_access_event_tool_id,
      event_tool_teams_access_team_id
    )
    select p_tool_id, tid::uuid
    from jsonb_array_elements_text(p_team_ids) as tid
    on conflict do nothing;
  end if;
end;
$$;

grant execute on function public.set_event_tool_teams_access(uuid, jsonb) to authenticated;
