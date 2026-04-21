-- Fix infinite recursion in event_tool_vehicle_seats policies by using a
-- security-definer helper that bypasses RLS when checking seat 0 membership.

create or replace function public.is_vehicle_driver(p_vehicle_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.event_tool_vehicle_seats
    where event_tool_vehicle_seat_vehicle_id = p_vehicle_id
      and event_tool_vehicle_seat_index = 0
      and event_tool_vehicle_seat_user_id = p_user_id
  );
$$;

grant execute on function public.is_vehicle_driver(uuid, uuid) to authenticated;

-- Vehicle DELETE
drop policy if exists "Creator or driver can delete vehicle"
  on public.event_tool_vehicles;

create policy "Creator or driver can delete vehicle"
  on public.event_tool_vehicles for delete
  using (
    event_tool_vehicle_created_by = auth.uid()
    or public.is_vehicle_driver(event_tool_vehicle_id, auth.uid())
  );

-- Stops manage
drop policy if exists "Creator or driver can manage stops"
  on public.event_tool_vehicle_stops;

create policy "Creator or driver can manage stops"
  on public.event_tool_vehicle_stops for all
  using (
    exists (
      select 1 from public.event_tool_vehicles v
      where v.event_tool_vehicle_id = event_tool_vehicle_stop_vehicle_id
        and (
          v.event_tool_vehicle_created_by = auth.uid()
          or public.is_vehicle_driver(v.event_tool_vehicle_id, auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from public.event_tool_vehicles v
      where v.event_tool_vehicle_id = event_tool_vehicle_stop_vehicle_id
        and (
          v.event_tool_vehicle_created_by = auth.uid()
          or public.is_vehicle_driver(v.event_tool_vehicle_id, auth.uid())
        )
    )
  );

-- Seats UPDATE and DELETE (the recursive ones)
drop policy if exists "Authorized users can modify seats"
  on public.event_tool_vehicle_seats;
drop policy if exists "Authorized users can remove seats"
  on public.event_tool_vehicle_seats;

create policy "Authorized users can modify seats"
  on public.event_tool_vehicle_seats for update
  using (
    event_tool_vehicle_seat_user_id = auth.uid()
    or event_tool_vehicle_seat_added_by = auth.uid()
    or exists (
      select 1 from public.event_tool_vehicles v
      where v.event_tool_vehicle_id = event_tool_vehicle_seat_vehicle_id
        and v.event_tool_vehicle_created_by = auth.uid()
    )
    or public.is_vehicle_driver(event_tool_vehicle_seat_vehicle_id, auth.uid())
  );

create policy "Authorized users can remove seats"
  on public.event_tool_vehicle_seats for delete
  using (
    event_tool_vehicle_seat_user_id = auth.uid()
    or event_tool_vehicle_seat_added_by = auth.uid()
    or exists (
      select 1 from public.event_tool_vehicles v
      where v.event_tool_vehicle_id = event_tool_vehicle_seat_vehicle_id
        and v.event_tool_vehicle_created_by = auth.uid()
    )
    or public.is_vehicle_driver(event_tool_vehicle_seat_vehicle_id, auth.uid())
  );
