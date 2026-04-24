-- Allow a price/capacity RANGE (min/max) per proposal so that e.g. a gift
-- proposal can be expressed as "50–80 €" and a venue as "8–12 people".

alter table public.event_tool_proposals
  rename column event_tool_proposal_price to event_tool_proposal_price_min;

alter table public.event_tool_proposals
  rename column event_tool_proposal_capacity to event_tool_proposal_capacity_min;

alter table public.event_tool_proposals
  add column event_tool_proposal_price_max numeric(12, 2);

alter table public.event_tool_proposals
  add column event_tool_proposal_capacity_max int;

-- Recreate RPC with the new columns in the return row.
drop function if exists public.get_event_tool_proposals(uuid);

create or replace function public.get_event_tool_proposals(p_tool_id uuid)
returns table (
  proposal_id uuid,
  title text,
  description text,
  price_min numeric,
  price_max numeric,
  location text,
  location_url text,
  date_start timestamptz,
  date_end timestamptz,
  capacity_min int,
  capacity_max int,
  status text,
  author_id uuid,
  author_full_name text,
  author_avatar_url text,
  created_at timestamptz,
  updated_at timestamptz,
  votes_for int,
  votes_against int,
  votes_neutral int,
  my_vote text,
  comments_count int,
  images jsonb,
  links jsonb
)
language sql
security definer
set search_path = ''
stable
as $$
  with vote_counts as (
    select
      event_tool_proposal_vote_proposal_id as proposal_id,
      count(*) filter (where event_tool_proposal_vote_value = 'for') as c_for,
      count(*) filter (where event_tool_proposal_vote_value = 'against') as c_against,
      count(*) filter (where event_tool_proposal_vote_value = 'neutral') as c_neutral
    from public.event_tool_proposal_votes
    group by event_tool_proposal_vote_proposal_id
  ),
  my_votes as (
    select
      event_tool_proposal_vote_proposal_id as proposal_id,
      event_tool_proposal_vote_value as value
    from public.event_tool_proposal_votes
    where event_tool_proposal_vote_user_id = auth.uid()
  ),
  comment_counts as (
    select
      event_tool_proposal_comment_proposal_id as proposal_id,
      count(*) as n
    from public.event_tool_proposal_comments
    group by event_tool_proposal_comment_proposal_id
  ),
  prop_images as (
    select
      event_tool_proposal_image_proposal_id as proposal_id,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', event_tool_proposal_image_id,
            'url', event_tool_proposal_image_url,
            'position', event_tool_proposal_image_position
          )
          order by event_tool_proposal_image_position asc,
                   event_tool_proposal_image_created_at asc
        ),
        '[]'::jsonb
      ) as items
    from public.event_tool_proposal_images
    group by event_tool_proposal_image_proposal_id
  ),
  prop_links as (
    select
      event_tool_proposal_link_proposal_id as proposal_id,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', event_tool_proposal_link_id,
            'label', event_tool_proposal_link_label,
            'url', event_tool_proposal_link_url,
            'position', event_tool_proposal_link_position
          )
          order by event_tool_proposal_link_position asc,
                   event_tool_proposal_link_created_at asc
        ),
        '[]'::jsonb
      ) as items
    from public.event_tool_proposal_links
    group by event_tool_proposal_link_proposal_id
  )
  select
    p.event_tool_proposal_id,
    p.event_tool_proposal_title,
    p.event_tool_proposal_description,
    p.event_tool_proposal_price_min,
    p.event_tool_proposal_price_max,
    p.event_tool_proposal_location,
    p.event_tool_proposal_location_url,
    p.event_tool_proposal_date_start,
    p.event_tool_proposal_date_end,
    p.event_tool_proposal_capacity_min,
    p.event_tool_proposal_capacity_max,
    p.event_tool_proposal_status,
    p.event_tool_proposal_author_id,
    a.full_name,
    a.avatar_url,
    p.event_tool_proposal_created_at,
    p.event_tool_proposal_updated_at,
    coalesce(vc.c_for, 0)::int,
    coalesce(vc.c_against, 0)::int,
    coalesce(vc.c_neutral, 0)::int,
    mv.value,
    coalesce(cc.n, 0)::int,
    coalesce(pi.items, '[]'::jsonb),
    coalesce(pl.items, '[]'::jsonb)
  from public.event_tool_proposals p
  left join public.users a on a.id = p.event_tool_proposal_author_id
  left join vote_counts vc on vc.proposal_id = p.event_tool_proposal_id
  left join my_votes mv on mv.proposal_id = p.event_tool_proposal_id
  left join comment_counts cc on cc.proposal_id = p.event_tool_proposal_id
  left join prop_images pi on pi.proposal_id = p.event_tool_proposal_id
  left join prop_links pl on pl.proposal_id = p.event_tool_proposal_id
  where p.event_tool_proposal_event_tool_id = p_tool_id
    and public.can_see_event_tool(p_tool_id, auth.uid())
  order by
    (coalesce(vc.c_for, 0) - coalesce(vc.c_against, 0)) desc,
    p.event_tool_proposal_created_at asc;
$$;

grant execute on function public.get_event_tool_proposals(uuid) to authenticated;
