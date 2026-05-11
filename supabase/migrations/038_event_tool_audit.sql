-- Generic audit log for tool-level parameter changes (vote style, mode,
-- deadline, lock...). Visible to every member of the tool — transparency
-- matters when a manager's setting change retroactively impacts users'
-- existing votes.
--
-- Writes only happen through SECURITY DEFINER RPCs (no insert/update/delete
-- policies). The first concrete change_type is 'vote_style_change'.

create table public.event_tool_audit (
  event_tool_audit_id uuid primary key default gen_random_uuid(),
  event_tool_audit_tool_id uuid not null
    references public.event_tools(event_tool_id) on delete cascade,
  event_tool_audit_changed_by uuid references auth.users(id) on delete set null,
  event_tool_audit_changed_at timestamptz not null default now(),
  event_tool_audit_change_type text not null,
  event_tool_audit_from_value jsonb,
  event_tool_audit_to_value jsonb,
  event_tool_audit_removed_votes_count int not null default 0,
  event_tool_audit_kept_for_resolution jsonb,
  event_tool_audit_affected_user_ids uuid[] not null default array[]::uuid[]
);

create index event_tool_audit_tool_idx
  on public.event_tool_audit(event_tool_audit_tool_id);
create index event_tool_audit_changed_at_idx
  on public.event_tool_audit(event_tool_audit_tool_id, event_tool_audit_changed_at desc);

alter table public.event_tool_audit enable row level security;

create policy "Tool members can read audit"
  on public.event_tool_audit for select
  using (public.can_see_event_tool(event_tool_audit_tool_id, auth.uid()));

-- ---------------------------------------------------------------------------
-- Bypass for the "proposals closed" trigger when an audited admin operation
-- needs to mutate votes (e.g. style change while the deadline is past).
-- The variable is transaction-scoped — it dies on commit/rollback.
-- ---------------------------------------------------------------------------
create or replace function public.block_if_proposals_closed_vote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proposal_id uuid;
  v_tool_id uuid;
begin
  if current_setting('planyzer.bypass_close_block', true) = 'on' then
    if tg_op = 'DELETE' then
      return old;
    else
      return new;
    end if;
  end if;
  if tg_op = 'DELETE' then
    v_proposal_id := old.event_tool_proposal_vote_proposal_id;
  else
    v_proposal_id := new.event_tool_proposal_vote_proposal_id;
  end if;
  select event_tool_proposal_event_tool_id
    into v_tool_id
  from public.event_tool_proposals
  where event_tool_proposal_id = v_proposal_id;
  if public.is_proposals_closed(v_tool_id) then
    raise exception 'proposals_closed'
      using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Preview RPC — non-mutating; describes the impact of a hypothetical change.
-- Anyone with read access on the tool can call it (used by the confirmation
-- modal that the manager sees, but cheap and side-effect-free).
-- ---------------------------------------------------------------------------
create or replace function public.preview_proposals_vote_style_change(
  p_tool_id uuid,
  p_new_style text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_current text;
  v_removed_count int := 0;
  v_extra_for int := 0;
  v_affected uuid[] := array[]::uuid[];
  v_multi_for uuid[] := array[]::uuid[];
begin
  if not public.can_see_event_tool(p_tool_id, auth.uid()) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  if p_new_style not in ('tri', 'check', 'single') then
    raise exception 'invalid_style' using errcode = 'P0001';
  end if;

  select coalesce(event_tool_settings->>'vote_style', '')
    into v_current
  from public.event_tools
  where event_tool_id = p_tool_id;

  -- against / neutral votes vanish on tri → check or tri → single
  if p_new_style in ('check', 'single') then
    select
      count(*)::int,
      coalesce(array_agg(distinct v.event_tool_proposal_vote_user_id), array[]::uuid[])
    into v_removed_count, v_affected
    from public.event_tool_proposal_votes v
    join public.event_tool_proposals p
      on p.event_tool_proposal_id = v.event_tool_proposal_vote_proposal_id
    where p.event_tool_proposal_event_tool_id = p_tool_id
      and v.event_tool_proposal_vote_value in ('against', 'neutral');
  end if;

  -- multi-`for` users when going to single — only the most recent is kept
  if p_new_style = 'single' then
    select
      coalesce(array_agg(uid), array[]::uuid[]),
      coalesce(sum(c - 1), 0)::int
    into v_multi_for, v_extra_for
    from (
      select
        v.event_tool_proposal_vote_user_id as uid,
        count(*) as c
      from public.event_tool_proposal_votes v
      join public.event_tool_proposals p
        on p.event_tool_proposal_id = v.event_tool_proposal_vote_proposal_id
      where p.event_tool_proposal_event_tool_id = p_tool_id
        and v.event_tool_proposal_vote_value = 'for'
      group by v.event_tool_proposal_vote_user_id
      having count(*) > 1
    ) sub;

    v_removed_count := v_removed_count + v_extra_for;
    v_affected := (
      select coalesce(array_agg(distinct u), array[]::uuid[])
      from unnest(v_affected || v_multi_for) as u
    );
  end if;

  return jsonb_build_object(
    'current_style', v_current,
    'new_style', p_new_style,
    'removed_votes_count', v_removed_count,
    'affected_user_ids', v_affected,
    'multi_for_user_ids', v_multi_for,
    'affected_users', (
      select coalesce(
        jsonb_agg(jsonb_build_object(
          'id', u.id,
          'full_name', u.full_name,
          'avatar_url', u.avatar_url
        )),
        '[]'::jsonb
      )
      from public.users u
      where u.id = any(v_affected)
    )
  );
end;
$$;

grant execute on function public.preview_proposals_vote_style_change(uuid, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Apply RPC — manager-only; mutates votes, updates settings, writes one
-- audit row, all in a single transaction. Bypasses the close-block trigger
-- because retroactive style changes must work even after the deadline.
-- ---------------------------------------------------------------------------
create or replace function public.apply_proposals_vote_style_change(
  p_tool_id uuid,
  p_new_style text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
volatile
as $$
declare
  v_current text;
  v_removed_count int := 0;
  v_affected uuid[] := array[]::uuid[];
  v_audit_id uuid;
begin
  if not public.is_event_tool_manager(p_tool_id, auth.uid()) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  if p_new_style not in ('tri', 'check', 'single') then
    raise exception 'invalid_style' using errcode = 'P0001';
  end if;

  perform set_config('planyzer.bypass_close_block', 'on', true);

  select coalesce(event_tool_settings->>'vote_style', '')
    into v_current
  from public.event_tools
  where event_tool_id = p_tool_id
  for update;

  if v_current = p_new_style then
    return jsonb_build_object(
      'change_id', null,
      'removed_votes_count', 0,
      'affected_user_ids', array[]::uuid[]
    );
  end if;

  -- A1: drop against/neutral when going to check or single
  if p_new_style in ('check', 'single') then
    with deleted as (
      delete from public.event_tool_proposal_votes v
      using public.event_tool_proposals p
      where p.event_tool_proposal_id = v.event_tool_proposal_vote_proposal_id
        and p.event_tool_proposal_event_tool_id = p_tool_id
        and v.event_tool_proposal_vote_value in ('against', 'neutral')
      returning v.event_tool_proposal_vote_user_id as uid
    )
    select count(*)::int,
           coalesce(array_agg(distinct uid), array[]::uuid[])
    into v_removed_count, v_affected
    from deleted;
  end if;

  -- B1: keep most recent `for` per user when going to single
  if p_new_style = 'single' then
    with ranked as (
      select
        v.event_tool_proposal_vote_id as vote_id,
        v.event_tool_proposal_vote_user_id as uid,
        row_number() over (
          partition by v.event_tool_proposal_vote_user_id
          order by v.event_tool_proposal_vote_updated_at desc,
                   v.event_tool_proposal_vote_created_at desc
        ) as rn
      from public.event_tool_proposal_votes v
      join public.event_tool_proposals p
        on p.event_tool_proposal_id = v.event_tool_proposal_vote_proposal_id
      where p.event_tool_proposal_event_tool_id = p_tool_id
        and v.event_tool_proposal_vote_value = 'for'
    ),
    deleted as (
      delete from public.event_tool_proposal_votes
      where event_tool_proposal_vote_id in (
        select vote_id from ranked where rn > 1
      )
      returning event_tool_proposal_vote_user_id as uid
    ),
    aggregated as (
      select count(*)::int as n,
             coalesce(array_agg(distinct uid), array[]::uuid[]) as uids
      from deleted
    )
    select
      v_removed_count + a.n,
      (
        select coalesce(array_agg(distinct u), array[]::uuid[])
        from unnest(v_affected || a.uids) as u
      )
    into v_removed_count, v_affected
    from aggregated a;
  end if;

  update public.event_tools
  set event_tool_settings = jsonb_set(
    coalesce(event_tool_settings, '{}'::jsonb),
    '{vote_style}',
    to_jsonb(p_new_style)
  )
  where event_tool_id = p_tool_id;

  insert into public.event_tool_audit (
    event_tool_audit_tool_id,
    event_tool_audit_changed_by,
    event_tool_audit_change_type,
    event_tool_audit_from_value,
    event_tool_audit_to_value,
    event_tool_audit_removed_votes_count,
    event_tool_audit_kept_for_resolution,
    event_tool_audit_affected_user_ids
  )
  values (
    p_tool_id,
    auth.uid(),
    'vote_style_change',
    jsonb_build_object('vote_style', nullif(v_current, '')),
    jsonb_build_object('vote_style', p_new_style),
    v_removed_count,
    case
      when p_new_style = 'single' then jsonb_build_object('strategy', 'most_recent')
      else null
    end,
    v_affected
  )
  returning event_tool_audit_id into v_audit_id;

  return jsonb_build_object(
    'change_id', v_audit_id,
    'removed_votes_count', v_removed_count,
    'affected_user_ids', v_affected
  );
end;
$$;

grant execute on function public.apply_proposals_vote_style_change(uuid, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- List RPC — paged audit entries, most recent first, with denormalized
-- author and affected-user info so the UI doesn't need a second round trip.
-- Names are read live (not snapshotted at write time) — desired behavior:
-- if a user renames themselves, the history reflects the new name.
-- ---------------------------------------------------------------------------
create or replace function public.list_event_tool_audit(
  p_tool_id uuid,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  audit_id uuid,
  changed_by uuid,
  changed_by_full_name text,
  changed_by_avatar_url text,
  changed_at timestamptz,
  change_type text,
  from_value jsonb,
  to_value jsonb,
  removed_votes_count int,
  kept_for_resolution jsonb,
  affected_user_ids uuid[],
  affected_users jsonb
)
language sql
security definer
set search_path = ''
stable
as $$
  with base as (
    select a.*
    from public.event_tool_audit a
    where a.event_tool_audit_tool_id = p_tool_id
      and public.can_see_event_tool(p_tool_id, auth.uid())
    order by a.event_tool_audit_changed_at desc
    limit p_limit offset p_offset
  ),
  affected as (
    select
      b.event_tool_audit_id as id,
      coalesce(
        jsonb_agg(jsonb_build_object(
          'id', u.id,
          'full_name', u.full_name,
          'avatar_url', u.avatar_url
        )) filter (where u.id is not null),
        '[]'::jsonb
      ) as users
    from base b
    left join lateral unnest(b.event_tool_audit_affected_user_ids) as uid on true
    left join public.users u on u.id = uid
    group by b.event_tool_audit_id
  )
  select
    b.event_tool_audit_id,
    b.event_tool_audit_changed_by,
    cb.full_name,
    cb.avatar_url,
    b.event_tool_audit_changed_at,
    b.event_tool_audit_change_type,
    b.event_tool_audit_from_value,
    b.event_tool_audit_to_value,
    b.event_tool_audit_removed_votes_count,
    b.event_tool_audit_kept_for_resolution,
    b.event_tool_audit_affected_user_ids,
    coalesce(af.users, '[]'::jsonb)
  from base b
  left join public.users cb on cb.id = b.event_tool_audit_changed_by
  left join affected af on af.id = b.event_tool_audit_id
  order by b.event_tool_audit_changed_at desc;
$$;

grant execute on function public.list_event_tool_audit(uuid, int, int)
  to authenticated;
