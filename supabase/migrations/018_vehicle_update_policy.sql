-- Missing UPDATE policy on event_tool_vehicles (RLS was blocking all edits).
create policy "Creator or driver can update vehicle"
  on public.event_tool_vehicles for update
  using (
    event_tool_vehicle_created_by = auth.uid()
    or public.is_vehicle_driver(event_tool_vehicle_id, auth.uid())
  );
