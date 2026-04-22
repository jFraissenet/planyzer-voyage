drop function if exists public.get_event_tool_vehicles(uuid);

create or replace function public.get_event_tool_vehicles(p_tool_id uuid)
returns table (
  vehicle_id uuid,
  description text,
  departure_location text,
  departure_date timestamptz,
  arrival_location text,
  journey_type text,
  linked_vehicle_id uuid,
  seat_count integer,
  seat_layout text,
  created_by uuid,
  created_at timestamptz,
  driver_id uuid,
  driver_full_name text,
  driver_avatar_url text,
  occupied_count integer
)
language sql security definer stable set search_path = '' as $$
  select
    v.event_tool_vehicle_id,
    v.event_tool_vehicle_description,
    v.event_tool_vehicle_departure_location,
    v.event_tool_vehicle_departure_date,
    v.event_tool_vehicle_arrival_location,
    v.event_tool_vehicle_journey_type,
    v.event_tool_vehicle_linked_vehicle_id,
    v.event_tool_vehicle_seat_count,
    v.event_tool_vehicle_seat_layout,
    v.event_tool_vehicle_created_by,
    v.event_tool_vehicle_created_at,
    driver_seat.event_tool_vehicle_seat_user_id,
    du.full_name,
    du.avatar_url,
    coalesce(occupied.cnt, 0)::integer
  from public.event_tool_vehicles v
  left join public.event_tool_vehicle_seats driver_seat
    on driver_seat.event_tool_vehicle_seat_vehicle_id = v.event_tool_vehicle_id
    and driver_seat.event_tool_vehicle_seat_index = 0
  left join public.users du on du.id = driver_seat.event_tool_vehicle_seat_user_id
  left join lateral (
    select count(*)::integer as cnt
    from public.event_tool_vehicle_seats
    where event_tool_vehicle_seat_vehicle_id = v.event_tool_vehicle_id
  ) occupied on true
  where v.event_tool_vehicle_event_tool_id = p_tool_id
    and public.can_see_event_tool(p_tool_id, auth.uid())
  order by
    v.event_tool_vehicle_departure_date asc nulls last,
    v.event_tool_vehicle_created_at asc;
$$;

grant execute on function public.get_event_tool_vehicles(uuid) to authenticated;
