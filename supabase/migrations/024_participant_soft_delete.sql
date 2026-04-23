-- Soft-delete participants: instead of DELETE, we flag them with a
-- `event_participant_left_at` timestamp. Their historical contributions
-- (expenses, vehicles, seats, notes) remain visible to the event, but
-- the user loses access and disappears from the active participant list.
-- Admins can re-integrate a former member from the invite modal.

alter table public.event_participants
  add column if not exists event_participant_left_at timestamptz;

create index if not exists event_participants_left_at_idx
  on public.event_participants (event_participant_event_id)
  where event_participant_left_at is not null;

-- Update helpers: a "left" row does not count as a participant anymore.
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
      and event_participant_left_at is null
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
    and event_participant_left_at is null
  limit 1;
$$;

-- get_event_participants already filters via is_event_participant, but the
-- inner select must also exclude left members. Recreate it.
create or replace function public.get_event_participants(p_event_id uuid)
returns table (
  user_id uuid,
  full_name text,
  avatar_url text,
  role_code text,
  joined_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    u.id as user_id,
    u.full_name,
    u.avatar_url,
    p.event_participant_role_code as role_code,
    p.event_participant_joined_at as joined_at
  from public.event_participants p
  join public.users u on u.id = p.event_participant_user_id
  where p.event_participant_event_id = p_event_id
    and p.event_participant_left_at is null
    and exists (
      select 1 from public.event_participants
      where event_participant_event_id = p_event_id
        and event_participant_user_id = auth.uid()
        and event_participant_left_at is null
    )
  order by p.event_participant_joined_at;
$$;

-- New: former participants of an event (admin only).
create or replace function public.get_event_former_participants(p_event_id uuid)
returns table (
  user_id uuid,
  full_name text,
  avatar_url text,
  role_code text,
  left_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    u.id as user_id,
    u.full_name,
    u.avatar_url,
    p.event_participant_role_code as role_code,
    p.event_participant_left_at as left_at
  from public.event_participants p
  join public.users u on u.id = p.event_participant_user_id
  where p.event_participant_event_id = p_event_id
    and p.event_participant_left_at is not null
    and public.event_role(p_event_id, auth.uid()) = 'admin'
  order by p.event_participant_left_at desc;
$$;

grant execute on function public.get_event_former_participants(uuid) to authenticated;

-- Soft-remove: admin-only. Flags left_at instead of deleting the row.
create or replace function public.soft_remove_participant(
  p_event_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.event_role(p_event_id, auth.uid()) <> 'admin' then
    raise exception 'admin only';
  end if;

  update public.event_participants
    set event_participant_left_at = now()
    where event_participant_event_id = p_event_id
      and event_participant_user_id = p_user_id
      and event_participant_left_at is null;
end;
$$;

grant execute on function public.soft_remove_participant(uuid, uuid) to authenticated;

-- Rejoin: admin-only. Clears left_at so the former member regains access.
create or replace function public.rejoin_participant(
  p_event_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.event_role(p_event_id, auth.uid()) <> 'admin' then
    raise exception 'admin only';
  end if;

  update public.event_participants
    set event_participant_left_at = null
    where event_participant_event_id = p_event_id
      and event_participant_user_id = p_user_id
      and event_participant_left_at is not null;
end;
$$;

grant execute on function public.rejoin_participant(uuid, uuid) to authenticated;
