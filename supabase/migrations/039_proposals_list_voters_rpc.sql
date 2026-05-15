-- ============================================================================
-- Proposals: list voters of a single proposal with display info.
-- Powers the "who voted what" modal opened by tapping on a vote count.
-- Read-restricted to users with tool access (mirrors the SELECT RLS on votes).
-- ============================================================================

create or replace function public.list_event_tool_proposal_voters(p_proposal_id uuid)
returns table (
  user_id uuid,
  full_name text,
  avatar_url text,
  vote_value text,
  voted_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    v.event_tool_proposal_vote_user_id,
    u.full_name,
    u.avatar_url,
    v.event_tool_proposal_vote_value,
    coalesce(
      v.event_tool_proposal_vote_updated_at,
      v.event_tool_proposal_vote_created_at
    )
  from public.event_tool_proposal_votes v
  left join public.users u
    on u.id = v.event_tool_proposal_vote_user_id
  join public.event_tool_proposals p
    on p.event_tool_proposal_id = v.event_tool_proposal_vote_proposal_id
  where v.event_tool_proposal_vote_proposal_id = p_proposal_id
    and public.can_see_event_tool(p.event_tool_proposal_event_tool_id, auth.uid())
  -- Stable order: 'for' first, then 'neutral', then 'against'; alphabetical
  -- inside each bucket so the modal sections render predictably.
  order by
    case v.event_tool_proposal_vote_value
      when 'for' then 0
      when 'neutral' then 1
      when 'against' then 2
      else 3
    end,
    u.full_name nulls last;
$$;

grant execute on function public.list_event_tool_proposal_voters(uuid) to authenticated;
