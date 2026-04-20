create table public.event_tools (
  event_tool_id uuid primary key default gen_random_uuid(),
  event_tool_event_id uuid not null references public.events(event_id) on delete cascade,
  event_tool_type_code text not null references public.tool_types(tool_type_code),
  event_tool_name text not null,
  event_tool_visibility text not null default 'all'
    check (event_tool_visibility in ('all', 'restricted')),
  event_tool_settings jsonb not null default '{}'::jsonb,
  event_tool_created_at timestamptz not null default now(),
  event_tool_updated_at timestamptz not null default now()
);

create index event_tools_event_idx on public.event_tools(event_tool_event_id);

-- Updated_at trigger
create or replace function public.set_event_tool_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.event_tool_updated_at = now();
  return new;
end;
$$;

create trigger event_tools_set_updated_at
  before update on public.event_tools
  for each row execute function public.set_event_tool_updated_at();

-- Basic RLS (refined in migration 008 once event_tool_members exists)
alter table public.event_tools enable row level security;

create policy "Participants can read all-visibility tools"
  on public.event_tools for select
  using (
    event_tool_visibility = 'all'
    and public.is_event_participant(event_tool_event_id, auth.uid())
  );

create policy "Event admins can insert tools"
  on public.event_tools for insert
  with check (public.event_role(event_tool_event_id, auth.uid()) = 'admin');

create policy "Event admins can update tools"
  on public.event_tools for update
  using (public.event_role(event_tool_event_id, auth.uid()) = 'admin');

create policy "Event admins can delete tools"
  on public.event_tools for delete
  using (public.event_role(event_tool_event_id, auth.uid()) = 'admin');
