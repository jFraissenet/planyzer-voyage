-- ============================================================================
-- Planning tool RPCs:
--   - get_event_tool_planning_slots(tool_id): returns slots with their
--     participants (jsonb), links (jsonb) and the link labels resolved
--     per-kind (recipe title, vehicle description, proposal title, note
--     snippet, or just the linked tool name).
--   - upsert_event_tool_planning_slot(...): atomic create-or-replace of a
--     slot, its participants and its links.
--   - get_planning_links_for_event(event_id, kind, target_id): reverse
--     lookup — given an item in another tool, return the planning slots
--     that schedule it. Used to display "📅 Vendredi 19h" badges on recipe
--     and vehicle cards.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- LIST slots with all nested data
-- ---------------------------------------------------------------------------
create or replace function public.get_event_tool_planning_slots(p_tool_id uuid)
returns table (
  slot_id uuid,
  title text,
  description text,
  location text,
  location_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  has_time boolean,
  author_id uuid,
  author_full_name text,
  author_avatar_url text,
  created_at timestamptz,
  updated_at timestamptz,
  participants jsonb,
  links jsonb
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    s.event_tool_planning_slot_id,
    s.event_tool_planning_slot_title,
    s.event_tool_planning_slot_description,
    s.event_tool_planning_slot_location,
    s.event_tool_planning_slot_location_url,
    s.event_tool_planning_slot_starts_at,
    s.event_tool_planning_slot_ends_at,
    s.event_tool_planning_slot_has_time,
    s.event_tool_planning_slot_author_id,
    u.full_name,
    u.avatar_url,
    s.event_tool_planning_slot_created_at,
    s.event_tool_planning_slot_updated_at,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'user_id', pu.id,
            'full_name', pu.full_name,
            'avatar_url', pu.avatar_url
          )
          order by pu.full_name
        )
        from public.event_tool_planning_slot_participant p
        left join public.users pu
          on pu.id = p.event_tool_planning_slot_participant_user_id
        where p.event_tool_planning_slot_participant_slot_id
              = s.event_tool_planning_slot_id
      ),
      '[]'::jsonb
    ),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', l.event_tool_planning_slot_link_id,
            'target_tool_id', l.event_tool_planning_slot_link_target_tool_id,
            'target_tool_name', tt.event_tool_name,
            'target_tool_type_code', tt.event_tool_type_code,
            'kind', l.event_tool_planning_slot_link_kind,
            'target_id', l.event_tool_planning_slot_link_target_id,
            'target_label',
              case l.event_tool_planning_slot_link_kind
                when 'tool' then tt.event_tool_name
                when 'meal_recipe' then (
                  select event_tool_meal_recipe_title
                  from public.event_tool_meal_recipe
                  where event_tool_meal_recipe_id
                        = l.event_tool_planning_slot_link_target_id
                )
                when 'carpool_vehicle' then (
                  select event_tool_vehicle_description
                  from public.event_tool_vehicles
                  where event_tool_vehicle_id
                        = l.event_tool_planning_slot_link_target_id
                )
                when 'proposal' then (
                  select event_tool_proposal_title
                  from public.event_tool_proposals
                  where event_tool_proposal_id
                        = l.event_tool_planning_slot_link_target_id
                )
                when 'note' then (
                  select left(event_tool_note_text, 60)
                  from public.event_tool_notes
                  where event_tool_note_id
                        = l.event_tool_planning_slot_link_target_id
                )
              end
          )
          order by l.event_tool_planning_slot_link_created_at
        )
        from public.event_tool_planning_slot_link l
        left join public.event_tools tt
          on tt.event_tool_id = l.event_tool_planning_slot_link_target_tool_id
        where l.event_tool_planning_slot_link_slot_id
              = s.event_tool_planning_slot_id
      ),
      '[]'::jsonb
    )
  from public.event_tool_planning_slot s
  left join public.users u on u.id = s.event_tool_planning_slot_author_id
  where s.event_tool_planning_slot_event_tool_id = p_tool_id
    and public.can_see_event_tool(p_tool_id, auth.uid())
  order by
    s.event_tool_planning_slot_starts_at asc,
    s.event_tool_planning_slot_created_at asc;
$$;

grant execute on function public.get_event_tool_planning_slots(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- UPSERT slot + participants + links atomically
--   p_participants : jsonb array of user_id strings
--   p_links        : jsonb array of objects with
--                    { target_tool_id, kind, target_id }
-- ---------------------------------------------------------------------------
create or replace function public.upsert_event_tool_planning_slot(
  p_slot_id uuid,
  p_tool_id uuid,
  p_title text,
  p_description text,
  p_location text,
  p_location_url text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_has_time boolean,
  p_participants jsonb,
  p_links jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_slot_id uuid := p_slot_id;
  v_existing_author uuid;
  v_existing_tool uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if v_slot_id is null then
    if not public.can_see_event_tool(p_tool_id, v_user_id) then
      raise exception 'not_authorized';
    end if;
    insert into public.event_tool_planning_slot (
      event_tool_planning_slot_event_tool_id,
      event_tool_planning_slot_title,
      event_tool_planning_slot_description,
      event_tool_planning_slot_location,
      event_tool_planning_slot_location_url,
      event_tool_planning_slot_starts_at,
      event_tool_planning_slot_ends_at,
      event_tool_planning_slot_has_time,
      event_tool_planning_slot_author_id
    ) values (
      p_tool_id,
      p_title,
      nullif(p_description, ''),
      nullif(p_location, ''),
      nullif(p_location_url, ''),
      p_starts_at,
      p_ends_at,
      coalesce(p_has_time, true),
      v_user_id
    )
    returning event_tool_planning_slot_id into v_slot_id;
  else
    select event_tool_planning_slot_author_id,
           event_tool_planning_slot_event_tool_id
      into v_existing_author, v_existing_tool
    from public.event_tool_planning_slot
    where event_tool_planning_slot_id = v_slot_id;

    if v_existing_tool is null then
      raise exception 'not_found';
    end if;
    if v_existing_author is distinct from v_user_id
       and not public.is_event_tool_manager(v_existing_tool, v_user_id) then
      raise exception 'not_authorized';
    end if;

    update public.event_tool_planning_slot set
      event_tool_planning_slot_title = p_title,
      event_tool_planning_slot_description = nullif(p_description, ''),
      event_tool_planning_slot_location = nullif(p_location, ''),
      event_tool_planning_slot_location_url = nullif(p_location_url, ''),
      event_tool_planning_slot_starts_at = p_starts_at,
      event_tool_planning_slot_ends_at = p_ends_at,
      event_tool_planning_slot_has_time = coalesce(p_has_time, true)
    where event_tool_planning_slot_id = v_slot_id;
  end if;

  -- Replace participants
  delete from public.event_tool_planning_slot_participant
  where event_tool_planning_slot_participant_slot_id = v_slot_id;

  if jsonb_typeof(p_participants) = 'array'
     and jsonb_array_length(p_participants) > 0 then
    insert into public.event_tool_planning_slot_participant (
      event_tool_planning_slot_participant_slot_id,
      event_tool_planning_slot_participant_user_id
    )
    select v_slot_id, uid::uuid
    from jsonb_array_elements_text(p_participants) as uid
    on conflict do nothing;
  end if;

  -- Replace links
  delete from public.event_tool_planning_slot_link
  where event_tool_planning_slot_link_slot_id = v_slot_id;

  if jsonb_typeof(p_links) = 'array'
     and jsonb_array_length(p_links) > 0 then
    insert into public.event_tool_planning_slot_link (
      event_tool_planning_slot_link_slot_id,
      event_tool_planning_slot_link_target_tool_id,
      event_tool_planning_slot_link_kind,
      event_tool_planning_slot_link_target_id
    )
    select
      v_slot_id,
      (lnk->>'target_tool_id')::uuid,
      (lnk->>'kind')::public.planning_link_kind,
      case when nullif(lnk->>'target_id', '') is null
        then null
        else (lnk->>'target_id')::uuid
      end
    from jsonb_array_elements(p_links) as lnk
    on conflict do nothing;
  end if;

  return v_slot_id;
end;
$$;

grant execute on function public.upsert_event_tool_planning_slot(
  uuid, uuid, text, text, text, text, timestamptz, timestamptz, boolean,
  jsonb, jsonb
) to authenticated;

-- ---------------------------------------------------------------------------
-- REVERSE lookup: which planning slots schedule a given item (or whole tool)?
-- p_kind = 'tool' + p_target_id null → matches links to the whole tool.
-- Returns minimal slot info needed for the "📅 schedule" badge on the item.
-- ---------------------------------------------------------------------------
create or replace function public.get_planning_links_for_event(
  p_event_id uuid,
  p_kind public.planning_link_kind,
  p_target_id uuid
)
returns table (
  slot_id uuid,
  planning_tool_id uuid,
  title text,
  starts_at timestamptz,
  ends_at timestamptz,
  has_time boolean
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    s.event_tool_planning_slot_id,
    s.event_tool_planning_slot_event_tool_id,
    s.event_tool_planning_slot_title,
    s.event_tool_planning_slot_starts_at,
    s.event_tool_planning_slot_ends_at,
    s.event_tool_planning_slot_has_time
  from public.event_tool_planning_slot_link l
  join public.event_tool_planning_slot s
    on s.event_tool_planning_slot_id = l.event_tool_planning_slot_link_slot_id
  join public.event_tools planning_tool
    on planning_tool.event_tool_id = s.event_tool_planning_slot_event_tool_id
  where planning_tool.event_tool_event_id = p_event_id
    and l.event_tool_planning_slot_link_kind = p_kind
    and (
      (p_target_id is null and l.event_tool_planning_slot_link_target_id is null)
      or l.event_tool_planning_slot_link_target_id = p_target_id
    )
    and public.can_see_event_tool(
      s.event_tool_planning_slot_event_tool_id, auth.uid()
    )
  order by s.event_tool_planning_slot_starts_at asc;
$$;

grant execute on function public.get_planning_links_for_event(
  uuid, public.planning_link_kind, uuid
) to authenticated;
