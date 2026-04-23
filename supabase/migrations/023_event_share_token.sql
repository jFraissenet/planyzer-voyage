-- Share token per event: any member can share the link; joining via the link
-- adds the visitor as a member of the event. Token is rotatable / disableable
-- by admins.

alter table public.events
  add column if not exists event_share_token text unique;

create index if not exists events_event_share_token_idx
  on public.events (event_share_token)
  where event_share_token is not null;

-- Generate a URL-safe random token (64 hex chars, 256 bits of entropy).
create or replace function public.generate_share_token()
returns text
language sql
volatile
as $$
  select replace(gen_random_uuid()::text, '-', '')
      || replace(gen_random_uuid()::text, '-', '');
$$;

-- Ensure a token exists for an event and return it. Any member can call.
create or replace function public.ensure_event_share_token(p_event_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  if not public.is_event_participant(p_event_id, auth.uid()) then
    raise exception 'not a participant';
  end if;

  select event_share_token into v_token
    from public.events
    where event_id = p_event_id;

  if v_token is null then
    v_token := public.generate_share_token();
    update public.events
      set event_share_token = v_token
      where event_id = p_event_id;
  end if;

  return v_token;
end;
$$;

grant execute on function public.ensure_event_share_token(uuid) to authenticated;

-- Rotate the token (admin only). Returns the new token.
create or replace function public.rotate_event_share_token(p_event_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  if public.event_role(p_event_id, auth.uid()) <> 'admin' then
    raise exception 'admin only';
  end if;

  v_token := public.generate_share_token();
  update public.events
    set event_share_token = v_token
    where event_id = p_event_id;

  return v_token;
end;
$$;

grant execute on function public.rotate_event_share_token(uuid) to authenticated;

-- Disable the token (admin only).
create or replace function public.disable_event_share_token(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.event_role(p_event_id, auth.uid()) <> 'admin' then
    raise exception 'admin only';
  end if;

  update public.events
    set event_share_token = null
    where event_id = p_event_id;
end;
$$;

grant execute on function public.disable_event_share_token(uuid) to authenticated;

-- Public preview: anyone with a valid token can read minimal event info.
create or replace function public.get_event_by_share_token(p_token text)
returns table (
  event_id uuid,
  event_title text,
  event_description text,
  event_start_date timestamptz,
  event_end_date timestamptz,
  organizer_name text,
  organizer_avatar_url text,
  participant_count int
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    e.event_id,
    e.event_title,
    e.event_description,
    e.event_start_date,
    e.event_end_date,
    u.full_name as organizer_name,
    u.avatar_url as organizer_avatar_url,
    (
      select count(*)::int
      from public.event_participants p
      where p.event_participant_event_id = e.event_id
    ) as participant_count
  from public.events e
  left join public.users u on u.id = e.event_creator_id
  where e.event_share_token = p_token
  limit 1;
$$;

grant execute on function public.get_event_by_share_token(text) to anon, authenticated;

-- Join via token: adds the caller as a member. Idempotent.
-- Returns the event_id on success. Raises if token invalid.
create or replace function public.join_event_via_token(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  select event_id into v_event_id
    from public.events
    where event_share_token = p_token;

  if v_event_id is null then
    raise exception 'invalid or disabled token';
  end if;

  insert into public.event_participants (
    event_participant_event_id,
    event_participant_user_id,
    event_participant_role_code
  ) values (v_event_id, v_user_id, 'member')
  on conflict (event_participant_event_id, event_participant_user_id)
  do update set event_participant_archived_at = null;

  return v_event_id;
end;
$$;

grant execute on function public.join_event_via_token(text) to authenticated;
