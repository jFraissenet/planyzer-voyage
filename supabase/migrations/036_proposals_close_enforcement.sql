-- Enforce the proposals tool's "closed" state on the database.
-- A proposals tool is closed when:
--   - settings.proposals_locked is true, OR
--   - settings.vote_deadline is set and has passed.
--
-- When closed:
--   - new votes can't be inserted, updated or deleted;
--   - new proposals can't be inserted.
-- Existing proposals can still be edited or deleted (so authors/managers
-- can fix typos / clean up after a poll closes).
-- Managers re-open by editing settings (unlock or push the deadline).

create or replace function public.is_proposals_closed(p_tool_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(
           (event_tool_settings->>'proposals_locked')::boolean,
           false
         )
      or coalesce(
           (event_tool_settings->>'vote_deadline')::timestamptz < now(),
           false
         )
  from public.event_tools
  where event_tool_id = p_tool_id;
$$;

create or replace function public.block_if_proposals_closed_vote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proposal_id uuid;
  v_tool_id uuid;
begin
  if tg_op = 'DELETE' then
    v_proposal_id := old.event_tool_proposal_vote_proposal_id;
  else
    v_proposal_id := new.event_tool_proposal_vote_proposal_id;
  end if;
  select event_tool_proposal_event_tool_id
    into v_tool_id
  from public.event_tool_proposals
  where event_tool_proposal_id = v_proposal_id;
  if public.is_proposals_closed(v_tool_id) then
    raise exception 'proposals_closed'
      using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;

drop trigger if exists event_tool_proposal_votes_block_when_closed
  on public.event_tool_proposal_votes;
create trigger event_tool_proposal_votes_block_when_closed
  before insert or update or delete on public.event_tool_proposal_votes
  for each row execute function public.block_if_proposals_closed_vote();

create or replace function public.block_if_proposals_closed_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_proposals_closed(new.event_tool_proposal_event_tool_id) then
    raise exception 'proposals_closed'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists event_tool_proposals_block_when_closed
  on public.event_tool_proposals;
create trigger event_tool_proposals_block_when_closed
  before insert on public.event_tool_proposals
  for each row execute function public.block_if_proposals_closed_insert();
