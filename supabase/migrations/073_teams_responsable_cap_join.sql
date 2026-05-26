-- ============================================================================
-- Teams phase 3: optional responsable, optional max-members cap (strict),
-- and self-join / self-leave RPCs.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Schema additions
-- ---------------------------------------------------------------------------
alter table public.event_tool_team
  add column event_tool_team_responsable_id uuid
    references auth.users(id) on delete set null;

alter table public.event_tool_team
  add column event_tool_team_max_members int
    check (
      event_tool_team_max_members is null
      or event_tool_team_max_members >= 1
    );

-- ---------------------------------------------------------------------------
-- Strict cap enforcement at the row level — any path that tries to insert
-- a member into a full team raises 'team_full'. Covers admin add, upsert
-- replace, self-join.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_event_tool_team_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cap int;
  v_count int;
begin
  select event_tool_team_max_members into v_cap
  from public.event_tool_team
  where event_tool_team_id = new.event_tool_team_member_team_id;

  if v_cap is null then return new; end if;

  select count(*) into v_count
  from public.event_tool_team_member
  where event_tool_team_member_team_id = new.event_tool_team_member_team_id;

  if v_count >= v_cap then
    raise exception 'team_full' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger event_tool_team_member_enforce_cap
  before insert on public.event_tool_team_member
  for each row execute function public.enforce_event_tool_team_cap();

-- ---------------------------------------------------------------------------
-- Refresh get_event_tool_teams to expose the new fields
-- ---------------------------------------------------------------------------
drop function if exists public.get_event_tool_teams(uuid);

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
-- Upsert: accept the new fields. Pre-check cap when replacing members.
-- If the new member set excludes the current responsable, null it.
-- ---------------------------------------------------------------------------
drop function if exists public.upsert_event_tool_team(
  uuid, uuid, text, text, text, timestamptz, timestamptz, boolean, jsonb, jsonb
);

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
  uuid, uuid, text, text, text, timestamptz, timestamptz, boolean, jsonb, jsonb, int
) to authenticated;

-- ---------------------------------------------------------------------------
-- Self-join: any participant who can see the team's tool can join, subject
-- to the cap.
-- ---------------------------------------------------------------------------
create or replace function public.join_event_tool_team(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_tool_id uuid;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  select event_tool_team_event_tool_id into v_tool_id
  from public.event_tool_team where event_tool_team_id = p_team_id;
  if v_tool_id is null then raise exception 'not_found'; end if;
  if not public.can_see_event_tool(v_tool_id, v_user_id) then
    raise exception 'not_authorized';
  end if;

  insert into public.event_tool_team_member (
    event_tool_team_member_team_id,
    event_tool_team_member_user_id
  ) values (p_team_id, v_user_id)
  on conflict do nothing;

  perform public.sync_event_tool_team_planning_slots(p_team_id);
end;
$$;

grant execute on function public.join_event_tool_team(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Self-leave: remove yourself from the team. If you were the responsable,
-- the slot is cleared.
-- ---------------------------------------------------------------------------
create or replace function public.leave_event_tool_team(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;

  delete from public.event_tool_team_member
  where event_tool_team_member_team_id = p_team_id
    and event_tool_team_member_user_id = v_user_id;

  update public.event_tool_team
  set event_tool_team_responsable_id = null
  where event_tool_team_id = p_team_id
    and event_tool_team_responsable_id = v_user_id;

  perform public.sync_event_tool_team_planning_slots(p_team_id);
end;
$$;

grant execute on function public.leave_event_tool_team(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Claim responsable: only members can claim, only if the slot is null or
-- already mine (idempotent). Setting it when someone else holds it raises
-- 'responsable_taken'.
-- ---------------------------------------------------------------------------
create or replace function public.claim_event_tool_team_responsable(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_current uuid;
  v_is_member boolean;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;

  select exists (
    select 1 from public.event_tool_team_member
    where event_tool_team_member_team_id = p_team_id
      and event_tool_team_member_user_id = v_user_id
  ) into v_is_member;
  if not v_is_member then raise exception 'not_a_member'; end if;

  select event_tool_team_responsable_id into v_current
  from public.event_tool_team where event_tool_team_id = p_team_id;
  if v_current is not null and v_current is distinct from v_user_id then
    raise exception 'responsable_taken' using errcode = 'P0001';
  end if;

  update public.event_tool_team
  set event_tool_team_responsable_id = v_user_id
  where event_tool_team_id = p_team_id;
end;
$$;

grant execute on function public.claim_event_tool_team_responsable(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Release responsable: only the current responsable (or a tool admin) can
-- release the slot.
-- ---------------------------------------------------------------------------
create or replace function public.release_event_tool_team_responsable(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_current uuid;
  v_tool uuid;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;

  select event_tool_team_responsable_id, event_tool_team_event_tool_id
    into v_current, v_tool
  from public.event_tool_team where event_tool_team_id = p_team_id;
  if v_tool is null then raise exception 'not_found'; end if;
  if v_current is null then return; end if;
  if v_current is distinct from v_user_id
     and not public.is_event_tool_admin(v_tool, v_user_id) then
    raise exception 'not_authorized';
  end if;

  update public.event_tool_team
  set event_tool_team_responsable_id = null
  where event_tool_team_id = p_team_id;
end;
$$;

grant execute on function public.release_event_tool_team_responsable(uuid) to authenticated;
