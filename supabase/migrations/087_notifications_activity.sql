-- ============================================================================
-- Notifications — Phase 1 (socle).
--
-- A single activity log (`activity`) + an optional per-user targeting array +
-- a per-user read cursor (`notification_state`). The bell only ever READS this
-- log, filtered for the current user. No fan-out (one row per action, not one
-- per recipient): relevance is computed at read time, reusing the existing
-- `is_event_participant` / `can_see_event_tool` access functions so tool
-- visibility (all / restricted / teams) is respected for free.
--
-- All access goes through security-definer RPCs; the tables themselves expose
-- nothing to clients (RLS on, no policies).
-- ============================================================================

create table public.activity (
  activity_id uuid primary key default gen_random_uuid(),
  -- Event the action belongs to — drives the participation filter.
  activity_event_id uuid not null references public.events(event_id) on delete cascade,
  -- Tool the action belongs to (null for event-level actions like adding a
  -- participant). When set, drives the visibility filter.
  activity_tool_id uuid references public.event_tools(event_tool_id) on delete cascade,
  -- Who acted. Never notified about their own action.
  activity_actor_id uuid references auth.users(id) on delete set null,
  -- Machine type, e.g. 'expense.created', 'participant.added'.
  activity_type text not null,
  -- Target object for the deep-link (expense id, proposal id...).
  activity_object_id uuid,
  -- NULL = broadcast to everyone who can see the event/tool (Tier B).
  -- Non-null = only these users are concerned (Tier A, personal).
  activity_target_user_ids uuid[],
  -- Display data (titles, snippets, counts) so the feed renders without joins.
  activity_payload jsonb not null default '{}'::jsonb,
  activity_created_at timestamptz not null default now()
);

create index activity_event_created_idx
  on public.activity (activity_event_id, activity_created_at desc);
create index activity_created_idx
  on public.activity (activity_created_at desc);
create index activity_target_users_idx
  on public.activity using gin (activity_target_user_ids);

alter table public.activity enable row level security;
-- No policies: direct client access is denied; everything goes through RPCs.

-- Per-user read cursor. Opening the Notifs tab bumps last_seen_at; the badge
-- counts relevant activity newer than it.
create table public.notification_state (
  notification_state_user_id uuid primary key references auth.users(id) on delete cascade,
  notification_state_last_seen_at timestamptz not null default now()
);

alter table public.notification_state enable row level security;

-- ---------------------------------------------------------------------------
-- Relevance: the activity a given user should see. INTERNAL ONLY — it takes a
-- user id as a parameter, so it must never be granted to clients (that would
-- let anyone read someone else's feed). The RPCs below call it with auth.uid().
-- ---------------------------------------------------------------------------
create or replace function public.relevant_activity(p_user uuid)
returns setof public.activity
language sql
security definer
stable
set search_path = ''
as $$
  select a.*
  from public.activity a
  where a.activity_actor_id is distinct from p_user
    and public.is_event_participant(a.activity_event_id, p_user)
    and (
      a.activity_tool_id is null
      or public.can_see_event_tool(a.activity_tool_id, p_user)
    )
    and (
      a.activity_target_user_ids is null
      or p_user = any (a.activity_target_user_ids)
    );
$$;

-- ---------------------------------------------------------------------------
-- log_activity: record an action. The actor is always the caller (no spoofing),
-- who must be a participant of the event.
-- ---------------------------------------------------------------------------
create or replace function public.log_activity(
  p_event_id uuid,
  p_tool_id uuid,
  p_type text,
  p_object_id uuid,
  p_target_user_ids uuid[],
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if not public.is_event_participant(p_event_id, v_user) then
    raise exception 'not_participant';
  end if;

  insert into public.activity (
    activity_event_id,
    activity_tool_id,
    activity_actor_id,
    activity_type,
    activity_object_id,
    activity_target_user_ids,
    activity_payload
  )
  values (
    p_event_id,
    p_tool_id,
    v_user,
    p_type,
    p_object_id,
    p_target_user_ids,
    coalesce(p_payload, '{}'::jsonb)
  )
  returning activity_id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- get_unread_count: number of relevant activities newer than my read cursor.
-- ---------------------------------------------------------------------------
create or replace function public.get_unread_count()
returns integer
language sql
security definer
stable
set search_path = ''
as $$
  select count(*)::int
  from public.relevant_activity(auth.uid()) a
  where a.activity_created_at > coalesce(
    (
      select notification_state_last_seen_at
      from public.notification_state
      where notification_state_user_id = auth.uid()
    ),
    'epoch'::timestamptz
  );
$$;

-- ---------------------------------------------------------------------------
-- list_activity: paginated relevant feed, newest first, with actor + event
-- display info and an is_unread flag (relative to my read cursor).
-- ---------------------------------------------------------------------------
create or replace function public.list_activity(
  p_limit int default 50,
  p_before timestamptz default null
)
returns table (
  activity_id uuid,
  event_id uuid,
  tool_id uuid,
  type text,
  object_id uuid,
  payload jsonb,
  created_at timestamptz,
  is_unread boolean,
  actor_id uuid,
  actor_name text,
  actor_avatar_url text,
  event_title text
)
language sql
security definer
stable
set search_path = ''
as $$
  with seen as (
    select coalesce(
      (
        select notification_state_last_seen_at
        from public.notification_state
        where notification_state_user_id = auth.uid()
      ),
      'epoch'::timestamptz
    ) as last_seen
  )
  select
    a.activity_id,
    a.activity_event_id,
    a.activity_tool_id,
    a.activity_type,
    a.activity_object_id,
    a.activity_payload,
    a.activity_created_at,
    a.activity_created_at > (select last_seen from seen),
    a.activity_actor_id,
    u.full_name,
    u.avatar_url,
    e.event_title
  from public.relevant_activity(auth.uid()) a
  left join public.users u on u.id = a.activity_actor_id
  left join public.events e on e.event_id = a.activity_event_id
  where a.activity_created_at < coalesce(p_before, 'infinity'::timestamptz)
  order by a.activity_created_at desc
  limit coalesce(p_limit, 50);
$$;

-- ---------------------------------------------------------------------------
-- mark_notifications_seen: move my read cursor to now (clears the badge).
-- ---------------------------------------------------------------------------
create or replace function public.mark_notifications_seen()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then return; end if;

  insert into public.notification_state (
    notification_state_user_id,
    notification_state_last_seen_at
  )
  values (v_user, now())
  on conflict (notification_state_user_id)
  do update set notification_state_last_seen_at = now();
end;
$$;

grant execute on function public.log_activity(uuid, uuid, text, uuid, uuid[], jsonb) to authenticated;
grant execute on function public.get_unread_count() to authenticated;
grant execute on function public.list_activity(int, timestamptz) to authenticated;
grant execute on function public.mark_notifications_seen() to authenticated;
