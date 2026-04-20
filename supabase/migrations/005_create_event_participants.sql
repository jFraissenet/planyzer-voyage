create table public.event_participants (
  event_participant_event_id uuid not null references public.events(event_id) on delete cascade,
  event_participant_user_id uuid not null references auth.users(id) on delete cascade,
  event_participant_role_code text not null references public.roles(role_code),
  event_participant_invited_by uuid references auth.users(id) on delete set null,
  event_participant_joined_at timestamptz not null default now(),
  event_participant_archived_at timestamptz,
  primary key (event_participant_event_id, event_participant_user_id)
);

create index event_participants_user_idx
  on public.event_participants(event_participant_user_id);

-- Helpers (security definer to avoid RLS recursion)
create or replace function public.is_event_participant(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.event_participants
    where event_participant_event_id = p_event_id
      and event_participant_user_id = p_user_id
  );
$$;

create or replace function public.event_role(p_event_id uuid, p_user_id uuid)
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select event_participant_role_code
  from public.event_participants
  where event_participant_event_id = p_event_id
    and event_participant_user_id = p_user_id
  limit 1;
$$;

-- RLS on event_participants
alter table public.event_participants enable row level security;

create policy "Participants can see event member list"
  on public.event_participants for select
  using (public.is_event_participant(event_participant_event_id, auth.uid()));

create policy "Admins can add participants"
  on public.event_participants for insert
  with check (public.event_role(event_participant_event_id, auth.uid()) = 'admin');

create policy "Admins or self can update participant"
  on public.event_participants for update
  using (
    event_participant_user_id = auth.uid()
    or public.event_role(event_participant_event_id, auth.uid()) = 'admin'
  );

create policy "Admins can remove participants"
  on public.event_participants for delete
  using (public.event_role(event_participant_event_id, auth.uid()) = 'admin');

-- Expand events SELECT and UPDATE policies to include participants
drop policy if exists "Users can read own events" on public.events;
drop policy if exists "Users can update own events" on public.events;

create policy "Participants and creator can read event"
  on public.events for select
  using (
    auth.uid() = event_creator_id
    or public.is_event_participant(event_id, auth.uid())
  );

create policy "Admins can update event"
  on public.events for update
  using (
    auth.uid() = event_creator_id
    or public.event_role(event_id, auth.uid()) = 'admin'
  );

-- Trigger: auto-insert creator as admin participant on event creation
create or replace function public.handle_event_creator_participant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.event_participants (
    event_participant_event_id,
    event_participant_user_id,
    event_participant_role_code
  ) values (new.event_id, new.event_creator_id, 'admin')
  on conflict do nothing;
  return new;
end;
$$;

create trigger events_insert_creator_participant
  after insert on public.events
  for each row execute function public.handle_event_creator_participant();
