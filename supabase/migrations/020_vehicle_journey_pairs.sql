-- Migrate to "1 véhicule = 1 trajet, paires optionnelles" model.
-- Each vehicle is now an independent journey with its own seats.
-- Round-trip pairs link two vehicles via linked_vehicle_id.

alter table public.event_tool_vehicles
  add column event_tool_vehicle_journey_type text not null default 'one_way'
    check (event_tool_vehicle_journey_type in ('one_way', 'outbound', 'return')),
  add column event_tool_vehicle_linked_vehicle_id uuid
    references public.event_tool_vehicles(event_tool_vehicle_id) on delete set null;

-- Migrate existing is_round_trip=true rows into paired vehicles
do $$
declare
  r record;
  new_return_id uuid;
begin
  for r in
    select
      v.event_tool_vehicle_id,
      v.event_tool_vehicle_event_tool_id,
      v.event_tool_vehicle_description,
      v.event_tool_vehicle_departure_location,
      v.event_tool_vehicle_arrival_location,
      v.event_tool_vehicle_return_date,
      v.event_tool_vehicle_seat_count,
      v.event_tool_vehicle_seat_layout,
      v.event_tool_vehicle_created_by
    from public.event_tool_vehicles v
    where v.event_tool_vehicle_is_round_trip = true
  loop
    insert into public.event_tool_vehicles (
      event_tool_vehicle_event_tool_id,
      event_tool_vehicle_description,
      event_tool_vehicle_departure_location,
      event_tool_vehicle_departure_date,
      event_tool_vehicle_arrival_location,
      event_tool_vehicle_seat_count,
      event_tool_vehicle_seat_layout,
      event_tool_vehicle_created_by,
      event_tool_vehicle_journey_type,
      event_tool_vehicle_linked_vehicle_id
    ) values (
      r.event_tool_vehicle_event_tool_id,
      r.event_tool_vehicle_description,
      r.event_tool_vehicle_arrival_location,
      r.event_tool_vehicle_return_date,
      r.event_tool_vehicle_departure_location,
      r.event_tool_vehicle_seat_count,
      r.event_tool_vehicle_seat_layout,
      r.event_tool_vehicle_created_by,
      'return',
      r.event_tool_vehicle_id
    )
    returning event_tool_vehicle_id into new_return_id;

    insert into public.event_tool_vehicle_seats (
      event_tool_vehicle_seat_vehicle_id,
      event_tool_vehicle_seat_index,
      event_tool_vehicle_seat_user_id,
      event_tool_vehicle_seat_label,
      event_tool_vehicle_seat_added_by
    )
    select
      new_return_id,
      event_tool_vehicle_seat_index,
      event_tool_vehicle_seat_user_id,
      event_tool_vehicle_seat_label,
      event_tool_vehicle_seat_added_by
    from public.event_tool_vehicle_seats
    where event_tool_vehicle_seat_vehicle_id = r.event_tool_vehicle_id;

    insert into public.event_tool_vehicle_stops (
      event_tool_vehicle_stop_vehicle_id,
      event_tool_vehicle_stop_label,
      event_tool_vehicle_stop_order
    )
    select
      new_return_id,
      event_tool_vehicle_stop_label,
      event_tool_vehicle_stop_order
    from public.event_tool_vehicle_stops
    where event_tool_vehicle_stop_vehicle_id = r.event_tool_vehicle_id;

    update public.event_tool_vehicles
    set
      event_tool_vehicle_journey_type = 'outbound',
      event_tool_vehicle_linked_vehicle_id = new_return_id
    where event_tool_vehicle_id = r.event_tool_vehicle_id;
  end loop;
end $$;

alter table public.event_tool_vehicles
  drop column event_tool_vehicle_is_round_trip,
  drop column event_tool_vehicle_return_date;

-- Rebuild RPC with new columns
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
  order by v.event_tool_vehicle_created_at asc;
$$;

grant execute on function public.get_event_tool_vehicles(uuid) to authenticated;
