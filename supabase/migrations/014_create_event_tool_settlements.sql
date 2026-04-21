create table public.event_tool_settlements (
  event_tool_settlement_id uuid primary key default gen_random_uuid(),
  event_tool_settlement_event_tool_id uuid not null
    references public.event_tools(event_tool_id) on delete cascade,
  event_tool_settlement_from_user_id uuid not null
    references auth.users(id) on delete cascade,
  event_tool_settlement_to_user_id uuid not null
    references auth.users(id) on delete cascade,
  event_tool_settlement_amount numeric(12, 2) not null
    check (event_tool_settlement_amount > 0),
  event_tool_settlement_created_by uuid references auth.users(id) on delete set null,
  event_tool_settlement_created_at timestamptz not null default now(),
  event_tool_settlement_updated_at timestamptz not null default now(),
  check (event_tool_settlement_from_user_id <> event_tool_settlement_to_user_id)
);

create index event_tool_settlements_tool_idx
  on public.event_tool_settlements(event_tool_settlement_event_tool_id);

create or replace function public.set_event_tool_settlement_updated_at()
returns trigger language plpgsql as $$
begin
  new.event_tool_settlement_updated_at = now();
  return new;
end;
$$;

create trigger event_tool_settlements_set_updated_at
  before update on public.event_tool_settlements
  for each row execute function public.set_event_tool_settlement_updated_at();

alter table public.event_tool_settlements enable row level security;

create policy "Users with tool access can read settlements"
  on public.event_tool_settlements for select
  using (
    public.can_see_event_tool(event_tool_settlement_event_tool_id, auth.uid())
  );

create policy "Users with tool access can create settlements"
  on public.event_tool_settlements for insert
  with check (
    event_tool_settlement_created_by = auth.uid()
    and public.can_see_event_tool(
      event_tool_settlement_event_tool_id, auth.uid()
    )
  );

create policy "Creator can delete settlements"
  on public.event_tool_settlements for delete
  using (event_tool_settlement_created_by = auth.uid());

create or replace function public.get_event_tool_settlements(p_tool_id uuid)
returns table (
  settlement_id uuid,
  from_user_id uuid,
  from_full_name text,
  from_avatar_url text,
  to_user_id uuid,
  to_full_name text,
  to_avatar_url text,
  amount numeric,
  created_by uuid,
  created_at timestamptz
)
language sql security definer stable set search_path = '' as $$
  select
    s.event_tool_settlement_id,
    s.event_tool_settlement_from_user_id,
    uf.full_name,
    uf.avatar_url,
    s.event_tool_settlement_to_user_id,
    ut.full_name,
    ut.avatar_url,
    s.event_tool_settlement_amount,
    s.event_tool_settlement_created_by,
    s.event_tool_settlement_created_at
  from public.event_tool_settlements s
  left join public.users uf on uf.id = s.event_tool_settlement_from_user_id
  left join public.users ut on ut.id = s.event_tool_settlement_to_user_id
  where s.event_tool_settlement_event_tool_id = p_tool_id
    and public.can_see_event_tool(p_tool_id, auth.uid())
  order by s.event_tool_settlement_created_at desc;
$$;

grant execute on function public.get_event_tool_settlements(uuid) to authenticated;
