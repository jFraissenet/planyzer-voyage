-- Track who created each event_tool so that tool-specific features (proposals, etc.)
-- can grant manage rights to the creator even for 'all' visibility tools.
alter table public.event_tools
  add column event_tool_created_by uuid references auth.users(id) on delete set null;

create index event_tools_created_by_idx on public.event_tools(event_tool_created_by);

-- Auto-populate created_by on insert from the current auth user.
create or replace function public.set_event_tool_created_by()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.event_tool_created_by is null then
    new.event_tool_created_by = auth.uid();
  end if;
  return new;
end;
$$;

create trigger event_tools_set_created_by
  before insert on public.event_tools
  for each row execute function public.set_event_tool_created_by();
