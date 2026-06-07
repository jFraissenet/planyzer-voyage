-- ============================================================================
-- Notifications — let log_activity derive the event from the tool.
--
-- Most tool write paths know the tool id but not the event id. Allow passing a
-- null event id: when a tool id is given, resolve the event from event_tools.
-- ============================================================================

create or replace function public.log_activity(
  p_event_id uuid,
  p_tool_id uuid,
  p_type text,
  p_object_id uuid,
  p_target_user_ids uuid[],
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_event uuid := p_event_id;
  v_id uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  if v_event is null and p_tool_id is not null then
    select event_tool_event_id
    into v_event
    from public.event_tools
    where event_tool_id = p_tool_id;
  end if;

  if v_event is null then raise exception 'event_required'; end if;
  if not public.is_event_participant(v_event, v_user) then
    raise exception 'not_participant';
  end if;

  insert into public.activity (
    activity_event_id,
    activity_tool_id,
    activity_actor_id,
    activity_type,
    activity_object_id,
    activity_target_user_ids,
    activity_payload
  )
  values (
    v_event,
    p_tool_id,
    v_user,
    p_type,
    p_object_id,
    p_target_user_ids,
    coalesce(p_payload, '{}'::jsonb)
  )
  returning activity_id into v_id;

  return v_id;
end;
$$;
