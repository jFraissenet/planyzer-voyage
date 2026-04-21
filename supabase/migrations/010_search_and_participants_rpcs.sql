-- Search users by full_name (for invitation flow)
create or replace function public.search_users(p_query text)
returns table (
  user_id uuid,
  full_name text,
  avatar_url text
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    u.id as user_id,
    u.full_name,
    u.avatar_url
  from public.users u
  where
    p_query is not null
    and length(trim(p_query)) >= 2
    and u.full_name is not null
    and u.full_name ilike '%' || trim(p_query) || '%'
  order by u.full_name
  limit 20;
$$;

grant execute on function public.search_users(text) to authenticated;

-- Get participants of an event with their user info
-- Only event participants can read this
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
    and exists (
      select 1 from public.event_participants
      where event_participant_event_id = p_event_id
        and event_participant_user_id = auth.uid()
    )
  order by p.event_participant_joined_at;
$$;

grant execute on function public.get_event_participants(uuid) to authenticated;
