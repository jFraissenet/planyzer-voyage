-- The handle_restricted_tool_creator trigger was wired on INSERT only. When
-- an existing tool was switched from 'all' / 'teams' to 'restricted',
-- event_tool_members stayed empty so every user (including the editor) lost
-- access. Mirror the trigger on UPDATE so the user performing the switch is
-- registered as an admin member.

create trigger event_tools_update_creator_member
  after update of event_tool_visibility on public.event_tools
  for each row
  when (
    new.event_tool_visibility = 'restricted'
    and (old.event_tool_visibility is distinct from new.event_tool_visibility)
  )
  execute function public.handle_restricted_tool_creator();
