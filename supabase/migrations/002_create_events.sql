-- Table events
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  start_date timestamptz,
  end_date timestamptz,
  creator_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_creator_id_idx on public.events(creator_id);
create index events_start_date_idx on public.events(start_date);

-- RLS
alter table public.events enable row level security;

create policy "Users can read own events"
  on public.events for select
  using (auth.uid() = creator_id);

create policy "Users can insert own events"
  on public.events for insert
  with check (auth.uid() = creator_id);

create policy "Users can update own events"
  on public.events for update
  using (auth.uid() = creator_id);

create policy "Users can delete own events"
  on public.events for delete
  using (auth.uid() = creator_id);

-- Trigger auto updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();
