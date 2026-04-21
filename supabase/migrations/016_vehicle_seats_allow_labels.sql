-- Allow seats to hold a free-form label instead of a user (pet, luggage, non-member…)
-- Seat 0 (driver) must still be a real user.

alter table public.event_tool_vehicle_seats
  alter column event_tool_vehicle_seat_user_id drop not null;

alter table public.event_tool_vehicle_seats
  add column event_tool_vehicle_seat_label text;

alter table public.event_tool_vehicle_seats
  add constraint event_tool_vehicle_seat_occupant_check
  check (
    (event_tool_vehicle_seat_user_id is not null
      and event_tool_vehicle_seat_label is null)
    or
    (event_tool_vehicle_seat_user_id is null
      and event_tool_vehicle_seat_label is not null
      and length(trim(event_tool_vehicle_seat_label)) > 0)
  );

alter table public.event_tool_vehicle_seats
  add constraint event_tool_vehicle_seat_driver_must_be_user
  check (
    event_tool_vehicle_seat_index > 0
    or event_tool_vehicle_seat_user_id is not null
  );

-- RPC: include label + allow null user
drop function if exists public.get_event_tool_vehicle_seats(uuid);

create or replace function public.get_event_tool_vehicle_seats(p_vehicle_id uuid)
returns table (
  seat_index integer,
  user_id uuid,
  full_name text,
  avatar_url text,
  label text,
  added_by uuid,
  added_at timestamptz
)
language sql security definer stable set search_path = '' as $$
  select
    s.event_tool_vehicle_seat_index,
    s.event_tool_vehicle_seat_user_id,
    u.full_name,
    u.avatar_url,
    s.event_tool_vehicle_seat_label,
    s.event_tool_vehicle_seat_added_by,
    s.event_tool_vehicle_seat_added_at
  from public.event_tool_vehicle_seats s
  left join public.users u on u.id = s.event_tool_vehicle_seat_user_id
  join public.event_tool_vehicles v
    on v.event_tool_vehicle_id = s.event_tool_vehicle_seat_vehicle_id
  where s.event_tool_vehicle_seat_vehicle_id = p_vehicle_id
    and public.can_see_event_tool(v.event_tool_vehicle_event_tool_id, auth.uid())
  order by s.event_tool_vehicle_seat_index asc;
$$;

grant execute on function public.get_event_tool_vehicle_seats(uuid) to authenticated;
