-- Drop policies and trigger that reference old column names
drop policy if exists "Users can read own events" on public.events;
drop policy if exists "Users can insert own events" on public.events;
drop policy if exists "Users can update own events" on public.events;
drop policy if exists "Users can delete own events" on public.events;

drop trigger if exists events_set_updated_at on public.events;

-- Rename columns to convention: table_name_ prefix
alter table public.events rename column id to event_id;
alter table public.events rename column title to event_title;
alter table public.events rename column description to event_description;
alter table public.events rename column start_date to event_start_date;
alter table public.events rename column end_date to event_end_date;
alter table public.events rename column creator_id to event_creator_id;
alter table public.events rename column created_at to event_created_at;
alter table public.events rename column updated_at to event_updated_at;

-- Rename indexes
alter index if exists events_creator_id_idx rename to events_event_creator_id_idx;
alter index if exists events_start_date_idx rename to events_event_start_date_idx;

-- New table-specific trigger function
create or replace function public.set_event_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.event_updated_at = now();
  return new;
end;
$$;

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_event_updated_at();

-- Recreate policies with new column names (will be expanded in migration 005)
create policy "Users can read own events"
  on public.events for select
  using (auth.uid() = event_creator_id);

create policy "Users can insert own events"
  on public.events for insert
  with check (auth.uid() = event_creator_id);

create policy "Users can update own events"
  on public.events for update
  using (auth.uid() = event_creator_id);

create policy "Users can delete own events"
  on public.events for delete
  using (auth.uid() = event_creator_id);
