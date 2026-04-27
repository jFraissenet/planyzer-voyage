-- Allow event members (not just admins) to add tools to an event. Visitors
-- still can't. Update/delete remain governed by is_event_tool_admin.

drop policy if exists "Event admins can insert tools" on public.event_tools;

create policy "Event participants can insert tools"
  on public.event_tools for insert
  with check (
    public.event_role(event_tool_event_id, auth.uid()) in ('admin', 'member')
  );
