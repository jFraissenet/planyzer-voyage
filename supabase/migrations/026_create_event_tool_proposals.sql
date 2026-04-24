-- ============================================================================
-- Proposals tool: hybrid poll + idea board.
-- A tool instance holds a question, and members add proposals (items).
-- Each proposal has title, description, price, location, dates, capacity,
-- multiple links, multiple images, and a status. Members vote for/against/neutral
-- (once per proposal) and comment.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper: tool "manager" = event admin, tool-member admin, or tool creator.
-- Used for status changes and tool-level settings (deadline, lock).
-- ---------------------------------------------------------------------------
create or replace function public.is_event_tool_manager(p_tool_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select
    public.is_event_tool_admin(p_tool_id, p_user_id)
    or exists (
      select 1 from public.event_tools t
      where t.event_tool_id = p_tool_id
        and t.event_tool_created_by = p_user_id
    );
$$;

-- ---------------------------------------------------------------------------
-- Proposals
-- ---------------------------------------------------------------------------
create table public.event_tool_proposals (
  event_tool_proposal_id uuid primary key default gen_random_uuid(),
  event_tool_proposal_event_tool_id uuid not null
    references public.event_tools(event_tool_id) on delete cascade,
  event_tool_proposal_title text not null,
  event_tool_proposal_description text,
  event_tool_proposal_price numeric(12, 2),
  event_tool_proposal_location text,
  event_tool_proposal_location_url text,
  event_tool_proposal_date_start date,
  event_tool_proposal_date_end date,
  event_tool_proposal_capacity int,
  event_tool_proposal_status text not null default 'proposed'
    check (event_tool_proposal_status in ('proposed', 'validated', 'rejected')),
  event_tool_proposal_author_id uuid references auth.users(id) on delete set null,
  event_tool_proposal_created_at timestamptz not null default now(),
  event_tool_proposal_updated_at timestamptz not null default now()
);

create index event_tool_proposals_tool_idx
  on public.event_tool_proposals(event_tool_proposal_event_tool_id);

create or replace function public.set_event_tool_proposal_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.event_tool_proposal_updated_at = now();
  return new;
end;
$$;

create trigger event_tool_proposals_set_updated_at
  before update on public.event_tool_proposals
  for each row execute function public.set_event_tool_proposal_updated_at();

alter table public.event_tool_proposals enable row level security;

create policy "Users with tool access can read proposals"
  on public.event_tool_proposals for select
  using (public.can_see_event_tool(event_tool_proposal_event_tool_id, auth.uid()));

-- Insert: user must have tool access, be the author, and the tool must not be
-- locked (unless the user is a tool manager).
create policy "Users with tool access can create proposals"
  on public.event_tool_proposals for insert
  with check (
    event_tool_proposal_author_id = auth.uid()
    and public.can_see_event_tool(event_tool_proposal_event_tool_id, auth.uid())
    and (
      public.is_event_tool_manager(event_tool_proposal_event_tool_id, auth.uid())
      or coalesce(
        (
          select (event_tool_settings->>'proposals_locked')::boolean
          from public.event_tools
          where event_tool_id = event_tool_proposal_event_tool_id
        ),
        false
      ) = false
    )
  );

-- Update: author (to edit content) or manager (to change status).
-- Column-level enforcement is handled app-side.
create policy "Authors or managers can update proposals"
  on public.event_tool_proposals for update
  using (
    event_tool_proposal_author_id = auth.uid()
    or public.is_event_tool_manager(event_tool_proposal_event_tool_id, auth.uid())
  );

-- Delete: author or tool admin (event admin or restricted-tool admin member).
create policy "Authors or tool admins can delete proposals"
  on public.event_tool_proposals for delete
  using (
    event_tool_proposal_author_id = auth.uid()
    or public.is_event_tool_admin(event_tool_proposal_event_tool_id, auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Links (per proposal, ordered)
-- ---------------------------------------------------------------------------
create table public.event_tool_proposal_links (
  event_tool_proposal_link_id uuid primary key default gen_random_uuid(),
  event_tool_proposal_link_proposal_id uuid not null
    references public.event_tool_proposals(event_tool_proposal_id) on delete cascade,
  event_tool_proposal_link_label text,
  event_tool_proposal_link_url text not null,
  event_tool_proposal_link_position int not null default 0,
  event_tool_proposal_link_created_at timestamptz not null default now()
);

create index event_tool_proposal_links_proposal_idx
  on public.event_tool_proposal_links(event_tool_proposal_link_proposal_id);

alter table public.event_tool_proposal_links enable row level security;

create policy "Users with tool access can read links"
  on public.event_tool_proposal_links for select
  using (
    exists (
      select 1 from public.event_tool_proposals p
      where p.event_tool_proposal_id = event_tool_proposal_link_proposal_id
        and public.can_see_event_tool(p.event_tool_proposal_event_tool_id, auth.uid())
    )
  );

create policy "Proposal authors or managers can write links"
  on public.event_tool_proposal_links for all
  using (
    exists (
      select 1 from public.event_tool_proposals p
      where p.event_tool_proposal_id = event_tool_proposal_link_proposal_id
        and (
          p.event_tool_proposal_author_id = auth.uid()
          or public.is_event_tool_admin(p.event_tool_proposal_event_tool_id, auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from public.event_tool_proposals p
      where p.event_tool_proposal_id = event_tool_proposal_link_proposal_id
        and (
          p.event_tool_proposal_author_id = auth.uid()
          or public.is_event_tool_admin(p.event_tool_proposal_event_tool_id, auth.uid())
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Images (per proposal, ordered — used as a carousel)
-- ---------------------------------------------------------------------------
create table public.event_tool_proposal_images (
  event_tool_proposal_image_id uuid primary key default gen_random_uuid(),
  event_tool_proposal_image_proposal_id uuid not null
    references public.event_tool_proposals(event_tool_proposal_id) on delete cascade,
  event_tool_proposal_image_url text not null,
  event_tool_proposal_image_position int not null default 0,
  event_tool_proposal_image_created_at timestamptz not null default now()
);

create index event_tool_proposal_images_proposal_idx
  on public.event_tool_proposal_images(event_tool_proposal_image_proposal_id);

alter table public.event_tool_proposal_images enable row level security;

create policy "Users with tool access can read images"
  on public.event_tool_proposal_images for select
  using (
    exists (
      select 1 from public.event_tool_proposals p
      where p.event_tool_proposal_id = event_tool_proposal_image_proposal_id
        and public.can_see_event_tool(p.event_tool_proposal_event_tool_id, auth.uid())
    )
  );

create policy "Proposal authors or managers can write images"
  on public.event_tool_proposal_images for all
  using (
    exists (
      select 1 from public.event_tool_proposals p
      where p.event_tool_proposal_id = event_tool_proposal_image_proposal_id
        and (
          p.event_tool_proposal_author_id = auth.uid()
          or public.is_event_tool_admin(p.event_tool_proposal_event_tool_id, auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from public.event_tool_proposals p
      where p.event_tool_proposal_id = event_tool_proposal_image_proposal_id
        and (
          p.event_tool_proposal_author_id = auth.uid()
          or public.is_event_tool_admin(p.event_tool_proposal_event_tool_id, auth.uid())
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Votes (one per user per proposal)
-- ---------------------------------------------------------------------------
create table public.event_tool_proposal_votes (
  event_tool_proposal_vote_id uuid primary key default gen_random_uuid(),
  event_tool_proposal_vote_proposal_id uuid not null
    references public.event_tool_proposals(event_tool_proposal_id) on delete cascade,
  event_tool_proposal_vote_user_id uuid not null
    references auth.users(id) on delete cascade,
  event_tool_proposal_vote_value text not null
    check (event_tool_proposal_vote_value in ('for', 'against', 'neutral')),
  event_tool_proposal_vote_created_at timestamptz not null default now(),
  event_tool_proposal_vote_updated_at timestamptz not null default now(),
  unique (event_tool_proposal_vote_proposal_id, event_tool_proposal_vote_user_id)
);

create index event_tool_proposal_votes_proposal_idx
  on public.event_tool_proposal_votes(event_tool_proposal_vote_proposal_id);

create or replace function public.set_event_tool_proposal_vote_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.event_tool_proposal_vote_updated_at = now();
  return new;
end;
$$;

create trigger event_tool_proposal_votes_set_updated_at
  before update on public.event_tool_proposal_votes
  for each row execute function public.set_event_tool_proposal_vote_updated_at();

alter table public.event_tool_proposal_votes enable row level security;

create policy "Users with tool access can read votes"
  on public.event_tool_proposal_votes for select
  using (
    exists (
      select 1 from public.event_tool_proposals p
      where p.event_tool_proposal_id = event_tool_proposal_vote_proposal_id
        and public.can_see_event_tool(p.event_tool_proposal_event_tool_id, auth.uid())
    )
  );

create policy "Users with tool access can vote"
  on public.event_tool_proposal_votes for insert
  with check (
    event_tool_proposal_vote_user_id = auth.uid()
    and exists (
      select 1 from public.event_tool_proposals p
      where p.event_tool_proposal_id = event_tool_proposal_vote_proposal_id
        and public.can_see_event_tool(p.event_tool_proposal_event_tool_id, auth.uid())
    )
  );

create policy "Voters can update their own vote"
  on public.event_tool_proposal_votes for update
  using (event_tool_proposal_vote_user_id = auth.uid());

create policy "Voters can remove their own vote"
  on public.event_tool_proposal_votes for delete
  using (event_tool_proposal_vote_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Comments (per proposal)
-- ---------------------------------------------------------------------------
create table public.event_tool_proposal_comments (
  event_tool_proposal_comment_id uuid primary key default gen_random_uuid(),
  event_tool_proposal_comment_proposal_id uuid not null
    references public.event_tool_proposals(event_tool_proposal_id) on delete cascade,
  event_tool_proposal_comment_author_id uuid references auth.users(id) on delete set null,
  event_tool_proposal_comment_text text not null,
  event_tool_proposal_comment_created_at timestamptz not null default now(),
  event_tool_proposal_comment_updated_at timestamptz not null default now()
);

create index event_tool_proposal_comments_proposal_idx
  on public.event_tool_proposal_comments(event_tool_proposal_comment_proposal_id);

create or replace function public.set_event_tool_proposal_comment_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.event_tool_proposal_comment_updated_at = now();
  return new;
end;
$$;

create trigger event_tool_proposal_comments_set_updated_at
  before update on public.event_tool_proposal_comments
  for each row execute function public.set_event_tool_proposal_comment_updated_at();

alter table public.event_tool_proposal_comments enable row level security;

create policy "Users with tool access can read comments"
  on public.event_tool_proposal_comments for select
  using (
    exists (
      select 1 from public.event_tool_proposals p
      where p.event_tool_proposal_id = event_tool_proposal_comment_proposal_id
        and public.can_see_event_tool(p.event_tool_proposal_event_tool_id, auth.uid())
    )
  );

create policy "Users with tool access can add comments"
  on public.event_tool_proposal_comments for insert
  with check (
    event_tool_proposal_comment_author_id = auth.uid()
    and exists (
      select 1 from public.event_tool_proposals p
      where p.event_tool_proposal_id = event_tool_proposal_comment_proposal_id
        and public.can_see_event_tool(p.event_tool_proposal_event_tool_id, auth.uid())
    )
  );

create policy "Authors can update their own comments"
  on public.event_tool_proposal_comments for update
  using (event_tool_proposal_comment_author_id = auth.uid());

create policy "Authors or tool admins can delete comments"
  on public.event_tool_proposal_comments for delete
  using (
    event_tool_proposal_comment_author_id = auth.uid()
    or exists (
      select 1 from public.event_tool_proposals p
      where p.event_tool_proposal_id = event_tool_proposal_comment_proposal_id
        and public.is_event_tool_admin(p.event_tool_proposal_event_tool_id, auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- RPC: list proposals for a tool with aggregated votes, my vote, comment count,
-- links and images. Ordered by score (for - against) desc, then created_at asc.
-- ---------------------------------------------------------------------------
create or replace function public.get_event_tool_proposals(p_tool_id uuid)
returns table (
  proposal_id uuid,
  title text,
  description text,
  price numeric,
  location text,
  location_url text,
  date_start date,
  date_end date,
  capacity int,
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
    p.event_tool_proposal_price,
    p.event_tool_proposal_location,
    p.event_tool_proposal_location_url,
    p.event_tool_proposal_date_start,
    p.event_tool_proposal_date_end,
    p.event_tool_proposal_capacity,
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

-- ---------------------------------------------------------------------------
-- RPC: list comments for a proposal with author info
-- ---------------------------------------------------------------------------
create or replace function public.get_event_tool_proposal_comments(p_proposal_id uuid)
returns table (
  comment_id uuid,
  text text,
  author_id uuid,
  author_full_name text,
  author_avatar_url text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    c.event_tool_proposal_comment_id,
    c.event_tool_proposal_comment_text,
    c.event_tool_proposal_comment_author_id,
    a.full_name,
    a.avatar_url,
    c.event_tool_proposal_comment_created_at,
    c.event_tool_proposal_comment_updated_at
  from public.event_tool_proposal_comments c
  left join public.users a on a.id = c.event_tool_proposal_comment_author_id
  join public.event_tool_proposals p
    on p.event_tool_proposal_id = c.event_tool_proposal_comment_proposal_id
  where c.event_tool_proposal_comment_proposal_id = p_proposal_id
    and public.can_see_event_tool(p.event_tool_proposal_event_tool_id, auth.uid())
  order by c.event_tool_proposal_comment_created_at asc;
$$;

grant execute on function public.get_event_tool_proposal_comments(uuid) to authenticated;
