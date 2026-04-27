-- Treat the user who created an event_tool as a tool admin so they can
-- update/delete it, manage its members, and govern its child tables (notes,
-- vehicles, etc.) on equal footing with event admins. is_event_tool_manager
-- becomes effectively the same as is_event_tool_admin and is kept as an
-- alias for the proposals code that already calls it.

create or replace function public.is_event_tool_admin(p_tool_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select
    public.event_tool_member_role(p_tool_id, p_user_id) = 'admin'
    or exists (
      select 1
      from public.event_tools t
      where t.event_tool_id = p_tool_id
        and (
          public.event_role(t.event_tool_event_id, p_user_id) = 'admin'
          or t.event_tool_created_by = p_user_id
        )
    );
$$;
