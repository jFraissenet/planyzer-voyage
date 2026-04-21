create table public.event_tool_notes (
  event_tool_note_id uuid primary key default gen_random_uuid(),
  event_tool_note_event_tool_id uuid not null
    references public.event_tools(event_tool_id) on delete cascade,
  event_tool_note_text text not null,
  event_tool_note_is_done boolean not null default false,
  event_tool_note_author_id uuid references auth.users(id) on delete set null,
  event_tool_note_done_by uuid references auth.users(id) on delete set null,
  event_tool_note_done_at timestamptz,
  event_tool_note_created_at timestamptz not null default now(),
  event_tool_note_updated_at timestamptz not null default now()
);

create index event_tool_notes_tool_idx
  on public.event_tool_notes(event_tool_note_event_tool_id);

create or replace function public.set_event_tool_note_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.event_tool_note_updated_at = now();
  return new;
end;
$$;

create trigger event_tool_notes_set_updated_at
  before update on public.event_tool_notes
  for each row execute function public.set_event_tool_note_updated_at();

-- RLS
alter table public.event_tool_notes enable row level security;

create policy "Users with tool access can read notes"
  on public.event_tool_notes for select
  using (public.can_see_event_tool(event_tool_note_event_tool_id, auth.uid()));

create policy "Users with tool access can create notes"
  on public.event_tool_notes for insert
  with check (
    event_tool_note_author_id = auth.uid()
    and public.can_see_event_tool(event_tool_note_event_tool_id, auth.uid())
  );

-- anyone with tool access can update (for toggle done). App-level gates edit to author/admin.
create policy "Users with tool access can update notes"
  on public.event_tool_notes for update
  using (public.can_see_event_tool(event_tool_note_event_tool_id, auth.uid()));

create policy "Authors or tool admins can delete notes"
  on public.event_tool_notes for delete
  using (
    event_tool_note_author_id = auth.uid()
    or public.is_event_tool_admin(event_tool_note_event_tool_id, auth.uid())
  );

-- RPC: list notes with author info (security definer bypasses users RLS)
create or replace function public.get_event_tool_notes(p_tool_id uuid)
returns table (
  note_id uuid,
  text text,
  is_done boolean,
  author_id uuid,
  author_full_name text,
  author_avatar_url text,
  done_by uuid,
  done_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    n.event_tool_note_id,
    n.event_tool_note_text,
    n.event_tool_note_is_done,
    n.event_tool_note_author_id,
    a.full_name,
    a.avatar_url,
    n.event_tool_note_done_by,
    n.event_tool_note_done_at,
    n.event_tool_note_created_at,
    n.event_tool_note_updated_at
  from public.event_tool_notes n
  left join public.users a on a.id = n.event_tool_note_author_id
  where n.event_tool_note_event_tool_id = p_tool_id
    and public.can_see_event_tool(p_tool_id, auth.uid())
  order by
    n.event_tool_note_is_done asc,
    n.event_tool_note_created_at asc;
$$;

grant execute on function public.get_event_tool_notes(uuid) to authenticated;
