create table public.tool_types (
  tool_type_code text primary key,
  tool_type_icon text,
  tool_type_default_visibility text not null default 'all'
    check (tool_type_default_visibility in ('all', 'restricted')),
  tool_type_is_active boolean not null default true,
  tool_type_created_at timestamptz not null default now()
);

alter table public.tool_types enable row level security;

create policy "Authenticated users can read tool types"
  on public.tool_types for select
  to authenticated
  using (true);
