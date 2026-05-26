-- Resolve a team's name as the link's target_label when a planning slot
-- link points at a team. Mirrors the existing per-kind cases.

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
        from public.event_tool_planning_slot_participant pp
        left join public.users pu
          on pu.id = pp.event_tool_planning_slot_participant_user_id
        where pp.event_tool_planning_slot_participant_slot_id
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
                when 'team' then (
                  select event_tool_team_name
                  from public.event_tool_team
                  where event_tool_team_id
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
