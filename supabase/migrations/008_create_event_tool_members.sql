create table public.event_tool_members (
  event_tool_member_event_tool_id uuid not null references public.event_tools(event_tool_id) on delete cascade,
  event_tool_member_user_id uuid not null references auth.users(id) on delete cascade,
  event_tool_member_role_code text not null references public.roles(role_code),
  event_tool_member_added_at timestamptz not null default now(),
  primary key (event_tool_member_event_tool_id, event_tool_member_user_id)
);

create index event_tool_members_user_idx
  on public.event_tool_members(event_tool_member_user_id);

-- Helpers
create or replace function public.event_tool_member_role(p_tool_id uuid, p_user_id uuid)
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select event_tool_member_role_code
  from public.event_tool_members
  where event_tool_member_event_tool_id = p_tool_id
    and event_tool_member_user_id = p_user_id
  limit 1;
$$;

create or replace function public.can_see_event_tool(p_tool_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select
    case
      when exists (
        select 1
        from public.event_tools t
        where t.event_tool_id = p_tool_id
          and t.event_tool_visibility = 'all'
          and public.is_event_participant(t.event_tool_event_id, p_user_id)
      ) then true
      when exists (
        select 1 from public.event_tool_members
        where event_tool_member_event_tool_id = p_tool_id
          and event_tool_member_user_id = p_user_id
      ) then true
      else false
    end;
$$;

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
        and public.event_role(t.event_tool_event_id, p_user_id) = 'admin'
    );
$$;

-- Replace the previous basic SELECT policy on event_tools with the full logic
drop policy "Participants can read all-visibility tools" on public.event_tools;

create policy "Users can read tools they have access to"
  on public.event_tools for select
  using (public.can_see_event_tool(event_tool_id, auth.uid()));

-- Allow tool admins (not only event admins) to update/delete their tool
drop policy "Event admins can update tools" on public.event_tools;
drop policy "Event admins can delete tools" on public.event_tools;

create policy "Tool or event admins can update tools"
  on public.event_tools for update
  using (public.is_event_tool_admin(event_tool_id, auth.uid()));

create policy "Tool or event admins can delete tools"
  on public.event_tools for delete
  using (public.is_event_tool_admin(event_tool_id, auth.uid()));

-- RLS on event_tool_members
alter table public.event_tool_members enable row level security;

create policy "Users with tool access can read member list"
  on public.event_tool_members for select
  using (public.can_see_event_tool(event_tool_member_event_tool_id, auth.uid()));

create policy "Tool admins can add members"
  on public.event_tool_members for insert
  with check (public.is_event_tool_admin(event_tool_member_event_tool_id, auth.uid()));

create policy "Tool admins can update members"
  on public.event_tool_members for update
  using (public.is_event_tool_admin(event_tool_member_event_tool_id, auth.uid()));

create policy "Tool admins can remove members"
  on public.event_tool_members for delete
  using (public.is_event_tool_admin(event_tool_member_event_tool_id, auth.uid()));

-- Trigger: if a tool is created with visibility='restricted', auto-add creator as admin member
create or replace function public.handle_restricted_tool_creator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.event_tool_visibility = 'restricted' then
    insert into public.event_tool_members (
      event_tool_member_event_tool_id,
      event_tool_member_user_id,
      event_tool_member_role_code
    ) values (new.event_tool_id, auth.uid(), 'admin')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger event_tools_insert_creator_member
  after insert on public.event_tools
  for each row execute function public.handle_restricted_tool_creator();
