-- Expenses table
create table public.event_tool_expenses (
  event_tool_expense_id uuid primary key default gen_random_uuid(),
  event_tool_expense_event_tool_id uuid not null
    references public.event_tools(event_tool_id) on delete cascade,
  event_tool_expense_label text not null,
  event_tool_expense_amount numeric(12, 2) not null
    check (event_tool_expense_amount > 0),
  event_tool_expense_currency text not null default 'EUR',
  event_tool_expense_paid_by uuid references auth.users(id) on delete set null,
  event_tool_expense_creator_id uuid references auth.users(id) on delete set null,
  event_tool_expense_order integer not null default 0,
  event_tool_expense_created_at timestamptz not null default now(),
  event_tool_expense_updated_at timestamptz not null default now()
);

create index event_tool_expenses_tool_idx
  on public.event_tool_expenses(event_tool_expense_event_tool_id);

-- Shares table
create table public.event_tool_expense_shares (
  event_tool_expense_share_expense_id uuid not null
    references public.event_tool_expenses(event_tool_expense_id) on delete cascade,
  event_tool_expense_share_user_id uuid not null
    references auth.users(id) on delete cascade,
  event_tool_expense_share_mode text not null
    check (event_tool_expense_share_mode in ('equal', 'percent', 'amount')),
  event_tool_expense_share_value numeric(12, 2),
  primary key (
    event_tool_expense_share_expense_id,
    event_tool_expense_share_user_id
  )
);

-- Trigger updated_at
create or replace function public.set_event_tool_expense_updated_at()
returns trigger language plpgsql as $$
begin
  new.event_tool_expense_updated_at = now();
  return new;
end;
$$;

create trigger event_tool_expenses_set_updated_at
  before update on public.event_tool_expenses
  for each row execute function public.set_event_tool_expense_updated_at();

-- RLS
alter table public.event_tool_expenses enable row level security;
alter table public.event_tool_expense_shares enable row level security;

create policy "Users with tool access can read expenses"
  on public.event_tool_expenses for select
  using (public.can_see_event_tool(event_tool_expense_event_tool_id, auth.uid()));

create policy "Users with tool access can create expenses"
  on public.event_tool_expenses for insert
  with check (
    event_tool_expense_creator_id = auth.uid()
    and public.can_see_event_tool(event_tool_expense_event_tool_id, auth.uid())
  );

create policy "Creator or payer can update expenses"
  on public.event_tool_expenses for update
  using (
    event_tool_expense_creator_id = auth.uid()
    or event_tool_expense_paid_by = auth.uid()
  );

create policy "Creator or payer can delete expenses"
  on public.event_tool_expenses for delete
  using (
    event_tool_expense_creator_id = auth.uid()
    or event_tool_expense_paid_by = auth.uid()
  );

create policy "Users with expense access can read shares"
  on public.event_tool_expense_shares for select
  using (
    exists (
      select 1 from public.event_tool_expenses e
      where e.event_tool_expense_id = event_tool_expense_share_expense_id
        and public.can_see_event_tool(
          e.event_tool_expense_event_tool_id, auth.uid()
        )
    )
  );

create policy "Creator or payer can manage shares"
  on public.event_tool_expense_shares for all
  using (
    exists (
      select 1 from public.event_tool_expenses e
      where e.event_tool_expense_id = event_tool_expense_share_expense_id
        and (
          e.event_tool_expense_creator_id = auth.uid()
          or e.event_tool_expense_paid_by = auth.uid()
        )
    )
  )
  with check (
    exists (
      select 1 from public.event_tool_expenses e
      where e.event_tool_expense_id = event_tool_expense_share_expense_id
        and (
          e.event_tool_expense_creator_id = auth.uid()
          or e.event_tool_expense_paid_by = auth.uid()
        )
    )
  );

-- Effective members (participants for 'all' tools, tool_members for 'restricted')
create or replace function public.get_event_tool_effective_members(p_tool_id uuid)
returns table (
  user_id uuid,
  full_name text,
  avatar_url text
)
language sql security definer stable set search_path = '' as $$
  with tool as (
    select event_tool_visibility, event_tool_event_id
    from public.event_tools
    where event_tool_id = p_tool_id
  )
  select distinct u.id, u.full_name, u.avatar_url
  from public.event_participants p
  join public.users u on u.id = p.event_participant_user_id
  join tool t on true
  where t.event_tool_visibility = 'all'
    and p.event_participant_event_id = t.event_tool_event_id
    and public.can_see_event_tool(p_tool_id, auth.uid())
  union
  select distinct u.id, u.full_name, u.avatar_url
  from public.event_tool_members m
  join public.users u on u.id = m.event_tool_member_user_id
  join tool t on true
  where t.event_tool_visibility = 'restricted'
    and m.event_tool_member_event_tool_id = p_tool_id
    and public.can_see_event_tool(p_tool_id, auth.uid());
$$;

grant execute on function public.get_event_tool_effective_members(uuid) to authenticated;

-- Expenses with author + payer info
create or replace function public.get_event_tool_expenses(p_tool_id uuid)
returns table (
  expense_id uuid,
  label text,
  amount numeric,
  currency text,
  paid_by uuid,
  paid_by_name text,
  paid_by_avatar text,
  creator_id uuid,
  creator_name text,
  creator_avatar text,
  expense_order integer,
  created_at timestamptz,
  updated_at timestamptz
)
language sql security definer stable set search_path = '' as $$
  select
    e.event_tool_expense_id,
    e.event_tool_expense_label,
    e.event_tool_expense_amount,
    e.event_tool_expense_currency,
    e.event_tool_expense_paid_by,
    p.full_name,
    p.avatar_url,
    e.event_tool_expense_creator_id,
    c.full_name,
    c.avatar_url,
    e.event_tool_expense_order,
    e.event_tool_expense_created_at,
    e.event_tool_expense_updated_at
  from public.event_tool_expenses e
  left join public.users p on p.id = e.event_tool_expense_paid_by
  left join public.users c on c.id = e.event_tool_expense_creator_id
  where e.event_tool_expense_event_tool_id = p_tool_id
    and public.can_see_event_tool(p_tool_id, auth.uid())
  order by e.event_tool_expense_order asc;
$$;

grant execute on function public.get_event_tool_expenses(uuid) to authenticated;
