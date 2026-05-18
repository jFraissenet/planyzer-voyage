-- ============================================================================
-- Planning tool: a calendar/timeline attached to an event. Each slot is a
-- scheduled moment (titre + dates + lieu) optionally tied to:
--   - participants (event members who attend that slot)
--   - other tools or specific items inside them (recipes, vehicles,
--     proposals, notes…) so the planning becomes a hub linking everything.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enum of what a slot link can target. 'tool' = the whole linked tool;
-- the other kinds point to a specific row inside that tool's tables.
-- Closed for v1; extend with ALTER TYPE ADD VALUE in a follow-up migration.
-- ---------------------------------------------------------------------------
create type public.planning_link_kind as enum (
  'tool',
  'meal_recipe',
  'carpool_vehicle',
  'proposal',
  'note'
);

-- ---------------------------------------------------------------------------
-- Slots: one row per moment on the planning timeline.
-- ---------------------------------------------------------------------------
create table public.event_tool_planning_slot (
  event_tool_planning_slot_id uuid primary key default gen_random_uuid(),
  event_tool_planning_slot_event_tool_id uuid not null
    references public.event_tools(event_tool_id) on delete cascade,
  event_tool_planning_slot_title text not null,
  event_tool_planning_slot_description text,
  event_tool_planning_slot_location text,
  event_tool_planning_slot_location_url text,
  event_tool_planning_slot_starts_at timestamptz not null,
  -- ends_at nullable so a slot can be a single timestamp ("Vendredi 19h")
  -- without forcing the user to pick an end time.
  event_tool_planning_slot_ends_at timestamptz,
  -- false = the slot covers a whole day (or several), times ignored at display.
  event_tool_planning_slot_has_time boolean not null default true,
  event_tool_planning_slot_author_id uuid references auth.users(id)
    on delete set null,
  event_tool_planning_slot_created_at timestamptz not null default now(),
  event_tool_planning_slot_updated_at timestamptz not null default now(),
  -- Sanity check: end >= start when both set.
  constraint event_tool_planning_slot_dates_ordered check (
    event_tool_planning_slot_ends_at is null
    or event_tool_planning_slot_ends_at >= event_tool_planning_slot_starts_at
  )
);

create index event_tool_planning_slots_tool_idx
  on public.event_tool_planning_slot(event_tool_planning_slot_event_tool_id);

create index event_tool_planning_slots_starts_idx
  on public.event_tool_planning_slot(event_tool_planning_slot_starts_at);

create or replace function public.set_event_tool_planning_slot_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.event_tool_planning_slot_updated_at = now();
  return new;
end;
$$;

create trigger event_tool_planning_slot_set_updated_at
  before update on public.event_tool_planning_slot
  for each row execute function public.set_event_tool_planning_slot_updated_at();

-- ---------------------------------------------------------------------------
-- Links: a slot can point to other tools/items in the same event.
-- target_id is nullable: when null + kind='tool', the whole tool is linked.
-- ---------------------------------------------------------------------------
create table public.event_tool_planning_slot_link (
  event_tool_planning_slot_link_id uuid primary key default gen_random_uuid(),
  event_tool_planning_slot_link_slot_id uuid not null
    references public.event_tool_planning_slot(event_tool_planning_slot_id)
    on delete cascade,
  event_tool_planning_slot_link_target_tool_id uuid not null
    references public.event_tools(event_tool_id) on delete cascade,
  event_tool_planning_slot_link_kind public.planning_link_kind not null,
  -- When kind='tool', target_id IS NULL (the whole tool is linked).
  -- Otherwise it points to a specific row of the matching table; FK integrity
  -- isn't enforced at the DB level (polymorphic) — the client is in charge
  -- of writing a valid id.
  event_tool_planning_slot_link_target_id uuid,
  event_tool_planning_slot_link_created_at timestamptz not null default now(),
  -- One (slot, target_tool, kind, target_id) tuple at most.
  constraint event_tool_planning_slot_link_unique unique (
    event_tool_planning_slot_link_slot_id,
    event_tool_planning_slot_link_target_tool_id,
    event_tool_planning_slot_link_kind,
    event_tool_planning_slot_link_target_id
  ),
  -- kind='tool' must come with target_id=null, and inversely.
  constraint event_tool_planning_slot_link_target_consistency check (
    (event_tool_planning_slot_link_kind = 'tool'
      and event_tool_planning_slot_link_target_id is null)
    or (event_tool_planning_slot_link_kind <> 'tool'
      and event_tool_planning_slot_link_target_id is not null)
  )
);

create index event_tool_planning_slot_link_slot_idx
  on public.event_tool_planning_slot_link(event_tool_planning_slot_link_slot_id);

create index event_tool_planning_slot_link_target_idx
  on public.event_tool_planning_slot_link(
    event_tool_planning_slot_link_kind,
    event_tool_planning_slot_link_target_id
  );

-- ---------------------------------------------------------------------------
-- Participants: which event members are attending a slot.
-- ---------------------------------------------------------------------------
create table public.event_tool_planning_slot_participant (
  event_tool_planning_slot_participant_slot_id uuid not null
    references public.event_tool_planning_slot(event_tool_planning_slot_id)
    on delete cascade,
  event_tool_planning_slot_participant_user_id uuid not null
    references auth.users(id) on delete cascade,
  event_tool_planning_slot_participant_added_at timestamptz not null default now(),
  primary key (
    event_tool_planning_slot_participant_slot_id,
    event_tool_planning_slot_participant_user_id
  )
);

create index event_tool_planning_slot_participants_user_idx
  on public.event_tool_planning_slot_participant(
    event_tool_planning_slot_participant_user_id
  );

-- ===========================================================================
-- RLS
-- ===========================================================================

alter table public.event_tool_planning_slot enable row level security;

create policy "Tool members can read planning slots"
  on public.event_tool_planning_slot for select
  using (public.can_see_event_tool(
    event_tool_planning_slot_event_tool_id, auth.uid()
  ));

create policy "Tool members can create planning slots"
  on public.event_tool_planning_slot for insert
  with check (
    event_tool_planning_slot_author_id = auth.uid()
    and public.can_see_event_tool(
      event_tool_planning_slot_event_tool_id, auth.uid()
    )
  );

create policy "Authors or tool managers can update planning slots"
  on public.event_tool_planning_slot for update
  using (
    event_tool_planning_slot_author_id = auth.uid()
    or public.is_event_tool_manager(
      event_tool_planning_slot_event_tool_id, auth.uid()
    )
  );

create policy "Authors or tool admins can delete planning slots"
  on public.event_tool_planning_slot for delete
  using (
    event_tool_planning_slot_author_id = auth.uid()
    or public.is_event_tool_admin(
      event_tool_planning_slot_event_tool_id, auth.uid()
    )
  );

alter table public.event_tool_planning_slot_link enable row level security;

create policy "Tool members can read planning links"
  on public.event_tool_planning_slot_link for select
  using (
    exists (
      select 1 from public.event_tool_planning_slot s
      where s.event_tool_planning_slot_id = event_tool_planning_slot_link_slot_id
        and public.can_see_event_tool(
          s.event_tool_planning_slot_event_tool_id, auth.uid()
        )
    )
  );

create policy "Slot authors or managers can write planning links"
  on public.event_tool_planning_slot_link for all
  using (
    exists (
      select 1 from public.event_tool_planning_slot s
      where s.event_tool_planning_slot_id = event_tool_planning_slot_link_slot_id
        and (
          s.event_tool_planning_slot_author_id = auth.uid()
          or public.is_event_tool_manager(
            s.event_tool_planning_slot_event_tool_id, auth.uid()
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.event_tool_planning_slot s
      where s.event_tool_planning_slot_id = event_tool_planning_slot_link_slot_id
        and (
          s.event_tool_planning_slot_author_id = auth.uid()
          or public.is_event_tool_manager(
            s.event_tool_planning_slot_event_tool_id, auth.uid()
          )
        )
    )
  );

alter table public.event_tool_planning_slot_participant enable row level security;

create policy "Tool members can read planning participants"
  on public.event_tool_planning_slot_participant for select
  using (
    exists (
      select 1 from public.event_tool_planning_slot s
      where s.event_tool_planning_slot_id
        = event_tool_planning_slot_participant_slot_id
        and public.can_see_event_tool(
          s.event_tool_planning_slot_event_tool_id, auth.uid()
        )
    )
  );

create policy "Slot authors or managers can write planning participants"
  on public.event_tool_planning_slot_participant for all
  using (
    exists (
      select 1 from public.event_tool_planning_slot s
      where s.event_tool_planning_slot_id
        = event_tool_planning_slot_participant_slot_id
        and (
          s.event_tool_planning_slot_author_id = auth.uid()
          or public.is_event_tool_manager(
            s.event_tool_planning_slot_event_tool_id, auth.uid()
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.event_tool_planning_slot s
      where s.event_tool_planning_slot_id
        = event_tool_planning_slot_participant_slot_id
        and (
          s.event_tool_planning_slot_author_id = auth.uid()
          or public.is_event_tool_manager(
            s.event_tool_planning_slot_event_tool_id, auth.uid()
          )
        )
    )
  );
