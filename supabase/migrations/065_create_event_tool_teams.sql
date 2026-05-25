-- ============================================================================
-- Teams tool: groups of event members usable across the event. A team has
-- members, an optional time-window (starts/ends), and can be linked to one or
-- more planning tools — when linked + dates set, a planning slot is mirrored
-- so the team appears on those plannings.
--
-- Future use: a team will also be selectable as an access mode on any tool
-- ("équipes" visibility, alongside 'all' and 'restricted'). Phase 2.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Teams: one row per team, attached to a 'teams' event_tool instance.
-- ---------------------------------------------------------------------------
create table public.event_tool_team (
  event_tool_team_id uuid primary key default gen_random_uuid(),
  event_tool_team_event_tool_id uuid not null
    references public.event_tools(event_tool_id) on delete cascade,
  event_tool_team_name text not null,
  event_tool_team_type text,
  event_tool_team_color text not null default '#10B981',
  event_tool_team_starts_at timestamptz,
  event_tool_team_ends_at timestamptz,
  event_tool_team_has_time boolean not null default true,
  event_tool_team_author_id uuid references auth.users(id) on delete set null,
  event_tool_team_created_at timestamptz not null default now(),
  event_tool_team_updated_at timestamptz not null default now(),
  constraint event_tool_team_dates_ordered check (
    event_tool_team_ends_at is null
    or event_tool_team_starts_at is null
    or event_tool_team_ends_at >= event_tool_team_starts_at
  )
);

create index event_tool_team_tool_idx
  on public.event_tool_team(event_tool_team_event_tool_id);

create or replace function public.set_event_tool_team_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.event_tool_team_updated_at = now();
  return new;
end;
$$;

create trigger event_tool_team_set_updated_at
  before update on public.event_tool_team
  for each row execute function public.set_event_tool_team_updated_at();

-- ---------------------------------------------------------------------------
-- Members of a team. Composite PK forbids duplicates.
-- ---------------------------------------------------------------------------
create table public.event_tool_team_member (
  event_tool_team_member_team_id uuid not null
    references public.event_tool_team(event_tool_team_id) on delete cascade,
  event_tool_team_member_user_id uuid not null
    references auth.users(id) on delete cascade,
  event_tool_team_member_added_at timestamptz not null default now(),
  primary key (event_tool_team_member_team_id, event_tool_team_member_user_id)
);

create index event_tool_team_member_user_idx
  on public.event_tool_team_member(event_tool_team_member_user_id);

-- ---------------------------------------------------------------------------
-- Planning links: which planning tools this team is mirrored into.
-- Stored separately from the materialized slot because the team may have no
-- dates yet — we keep the intent, and create/destroy slots as dates change.
-- ---------------------------------------------------------------------------
create table public.event_tool_team_planning_link (
  event_tool_team_planning_link_team_id uuid not null
    references public.event_tool_team(event_tool_team_id) on delete cascade,
  event_tool_team_planning_link_planning_tool_id uuid not null
    references public.event_tools(event_tool_id) on delete cascade,
  event_tool_team_planning_link_created_at timestamptz not null default now(),
  primary key (
    event_tool_team_planning_link_team_id,
    event_tool_team_planning_link_planning_tool_id
  )
);

-- ---------------------------------------------------------------------------
-- Materialization on the planning side: a planning slot may be team-owned.
-- When set, the slot is read-only from the planning UI; edits must go through
-- the team. Cascading delete keeps the planning clean if the team disappears.
-- ---------------------------------------------------------------------------
alter table public.event_tool_planning_slot
  add column event_tool_planning_slot_team_id uuid
    references public.event_tool_team(event_tool_team_id) on delete cascade;

create index event_tool_planning_slot_team_idx
  on public.event_tool_planning_slot(event_tool_planning_slot_team_id);

-- ===========================================================================
-- RLS
-- ===========================================================================

alter table public.event_tool_team enable row level security;

create policy "Tool members can read teams"
  on public.event_tool_team for select
  using (public.can_see_event_tool(
    event_tool_team_event_tool_id, auth.uid()
  ));

create policy "Tool members can create teams"
  on public.event_tool_team for insert
  with check (
    event_tool_team_author_id = auth.uid()
    and public.can_see_event_tool(
      event_tool_team_event_tool_id, auth.uid()
    )
  );

create policy "Authors or tool managers can update teams"
  on public.event_tool_team for update
  using (
    event_tool_team_author_id = auth.uid()
    or public.is_event_tool_manager(
      event_tool_team_event_tool_id, auth.uid()
    )
  );

create policy "Authors or tool admins can delete teams"
  on public.event_tool_team for delete
  using (
    event_tool_team_author_id = auth.uid()
    or public.is_event_tool_admin(
      event_tool_team_event_tool_id, auth.uid()
    )
  );

alter table public.event_tool_team_member enable row level security;

create policy "Tool members can read team members"
  on public.event_tool_team_member for select
  using (
    exists (
      select 1 from public.event_tool_team t
      where t.event_tool_team_id = event_tool_team_member_team_id
        and public.can_see_event_tool(
          t.event_tool_team_event_tool_id, auth.uid()
        )
    )
  );

create policy "Team authors or managers can write team members"
  on public.event_tool_team_member for all
  using (
    exists (
      select 1 from public.event_tool_team t
      where t.event_tool_team_id = event_tool_team_member_team_id
        and (
          t.event_tool_team_author_id = auth.uid()
          or public.is_event_tool_manager(
            t.event_tool_team_event_tool_id, auth.uid()
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.event_tool_team t
      where t.event_tool_team_id = event_tool_team_member_team_id
        and (
          t.event_tool_team_author_id = auth.uid()
          or public.is_event_tool_manager(
            t.event_tool_team_event_tool_id, auth.uid()
          )
        )
    )
  );

alter table public.event_tool_team_planning_link enable row level security;

create policy "Tool members can read team planning links"
  on public.event_tool_team_planning_link for select
  using (
    exists (
      select 1 from public.event_tool_team t
      where t.event_tool_team_id = event_tool_team_planning_link_team_id
        and public.can_see_event_tool(
          t.event_tool_team_event_tool_id, auth.uid()
        )
    )
  );

create policy "Team authors or managers can write team planning links"
  on public.event_tool_team_planning_link for all
  using (
    exists (
      select 1 from public.event_tool_team t
      where t.event_tool_team_id = event_tool_team_planning_link_team_id
        and (
          t.event_tool_team_author_id = auth.uid()
          or public.is_event_tool_manager(
            t.event_tool_team_event_tool_id, auth.uid()
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.event_tool_team t
      where t.event_tool_team_id = event_tool_team_planning_link_team_id
        and (
          t.event_tool_team_author_id = auth.uid()
          or public.is_event_tool_manager(
            t.event_tool_team_event_tool_id, auth.uid()
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Restrictive policies on the planning side: team-owned slots can only be
-- edited/deleted via the team RPCs (which are security-definer and bypass
-- these). Direct edits on a team-owned slot are denied.
-- ---------------------------------------------------------------------------
create policy "Team-owned planning slots block direct updates"
  on public.event_tool_planning_slot
  as restrictive
  for update
  using (event_tool_planning_slot_team_id is null);

create policy "Team-owned planning slots block direct deletes"
  on public.event_tool_planning_slot
  as restrictive
  for delete
  using (event_tool_planning_slot_team_id is null);
