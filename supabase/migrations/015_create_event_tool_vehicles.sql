create table public.event_tool_vehicles (
  event_tool_vehicle_id uuid primary key default gen_random_uuid(),
  event_tool_vehicle_event_tool_id uuid not null
    references public.event_tools(event_tool_id) on delete cascade,
  event_tool_vehicle_description text,
  event_tool_vehicle_departure_location text,
  event_tool_vehicle_departure_date timestamptz,
  event_tool_vehicle_seat_count integer not null
    check (event_tool_vehicle_seat_count between 2 and 10),
  event_tool_vehicle_seat_layout text not null,
  event_tool_vehicle_created_by uuid references auth.users(id) on delete set null,
  event_tool_vehicle_created_at timestamptz not null default now(),
  event_tool_vehicle_updated_at timestamptz not null default now()
);

create index event_tool_vehicles_tool_idx
  on public.event_tool_vehicles(event_tool_vehicle_event_tool_id);

create table public.event_tool_vehicle_stops (
  event_tool_vehicle_stop_id uuid primary key default gen_random_uuid(),
  event_tool_vehicle_stop_vehicle_id uuid not null
    references public.event_tool_vehicles(event_tool_vehicle_id) on delete cascade,
  event_tool_vehicle_stop_label text not null,
  event_tool_vehicle_stop_order integer not null default 0
);

create index event_tool_vehicle_stops_vehicle_idx
  on public.event_tool_vehicle_stops(event_tool_vehicle_stop_vehicle_id);

create table public.event_tool_vehicle_seats (
  event_tool_vehicle_seat_vehicle_id uuid not null
    references public.event_tool_vehicles(event_tool_vehicle_id) on delete cascade,
  event_tool_vehicle_seat_index integer not null check (event_tool_vehicle_seat_index >= 0),
  event_tool_vehicle_seat_user_id uuid not null
    references auth.users(id) on delete cascade,
  event_tool_vehicle_seat_added_by uuid references auth.users(id) on delete set null,
  event_tool_vehicle_seat_added_at timestamptz not null default now(),
  primary key (event_tool_vehicle_seat_vehicle_id, event_tool_vehicle_seat_index)
);

create index event_tool_vehicle_seats_user_idx
  on public.event_tool_vehicle_seats(event_tool_vehicle_seat_user_id);

-- Trigger updated_at
create or replace function public.set_event_tool_vehicle_updated_at()
returns trigger language plpgsql as $$
begin
  new.event_tool_vehicle_updated_at = now();
  return new;
end;
$$;

create trigger event_tool_vehicles_set_updated_at
  before update on public.event_tool_vehicles
  for each row execute function public.set_event_tool_vehicle_updated_at();

-- RLS
alter table public.event_tool_vehicles enable row level security;
alter table public.event_tool_vehicle_stops enable row level security;
alter table public.event_tool_vehicle_seats enable row level security;

create policy "Users with tool access can read vehicles"
  on public.event_tool_vehicles for select
  using (public.can_see_event_tool(event_tool_vehicle_event_tool_id, auth.uid()));

create policy "Users with tool access can create vehicles"
  on public.event_tool_vehicles for insert
  with check (
    event_tool_vehicle_created_by = auth.uid()
    and public.can_see_event_tool(event_tool_vehicle_event_tool_id, auth.uid())
  );

-- Vehicle delete: creator (added the vehicle) OR the driver (seat 0)
create policy "Creator or driver can delete vehicle"
  on public.event_tool_vehicles for delete
  using (
    event_tool_vehicle_created_by = auth.uid()
    or exists (
      select 1 from public.event_tool_vehicle_seats s
      where s.event_tool_vehicle_seat_vehicle_id = event_tool_vehicle_id
        and s.event_tool_vehicle_seat_index = 0
        and s.event_tool_vehicle_seat_user_id = auth.uid()
    )
  );

-- Stops
create policy "Users with tool access can read stops"
  on public.event_tool_vehicle_stops for select
  using (
    exists (
      select 1 from public.event_tool_vehicles v
      where v.event_tool_vehicle_id = event_tool_vehicle_stop_vehicle_id
        and public.can_see_event_tool(v.event_tool_vehicle_event_tool_id, auth.uid())
    )
  );

create policy "Creator or driver can manage stops"
  on public.event_tool_vehicle_stops for all
  using (
    exists (
      select 1 from public.event_tool_vehicles v
      where v.event_tool_vehicle_id = event_tool_vehicle_stop_vehicle_id
        and (
          v.event_tool_vehicle_created_by = auth.uid()
          or exists (
            select 1 from public.event_tool_vehicle_seats s
            where s.event_tool_vehicle_seat_vehicle_id = v.event_tool_vehicle_id
              and s.event_tool_vehicle_seat_index = 0
              and s.event_tool_vehicle_seat_user_id = auth.uid()
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.event_tool_vehicles v
      where v.event_tool_vehicle_id = event_tool_vehicle_stop_vehicle_id
        and (
          v.event_tool_vehicle_created_by = auth.uid()
          or exists (
            select 1 from public.event_tool_vehicle_seats s
            where s.event_tool_vehicle_seat_vehicle_id = v.event_tool_vehicle_id
              and s.event_tool_vehicle_seat_index = 0
              and s.event_tool_vehicle_seat_user_id = auth.uid()
          )
        )
    )
  );

-- Seats
create policy "Users with tool access can read seats"
  on public.event_tool_vehicle_seats for select
  using (
    exists (
      select 1 from public.event_tool_vehicles v
      where v.event_tool_vehicle_id = event_tool_vehicle_seat_vehicle_id
        and public.can_see_event_tool(v.event_tool_vehicle_event_tool_id, auth.uid())
    )
  );

create policy "Users with tool access can add seats"
  on public.event_tool_vehicle_seats for insert
  with check (
    event_tool_vehicle_seat_added_by = auth.uid()
    and exists (
      select 1 from public.event_tool_vehicles v
      where v.event_tool_vehicle_id = event_tool_vehicle_seat_vehicle_id
        and public.can_see_event_tool(v.event_tool_vehicle_event_tool_id, auth.uid())
    )
  );

-- Seat update/delete: passenger themselves, their adder, vehicle driver (seat 0 user), or vehicle creator
create policy "Authorized users can modify seats"
  on public.event_tool_vehicle_seats for update
  using (
    event_tool_vehicle_seat_user_id = auth.uid()
    or event_tool_vehicle_seat_added_by = auth.uid()
    or exists (
      select 1 from public.event_tool_vehicles v
      where v.event_tool_vehicle_id = event_tool_vehicle_seat_vehicle_id
        and v.event_tool_vehicle_created_by = auth.uid()
    )
    or exists (
      select 1 from public.event_tool_vehicle_seats s2
      where s2.event_tool_vehicle_seat_vehicle_id = event_tool_vehicle_seat_vehicle_id
        and s2.event_tool_vehicle_seat_index = 0
        and s2.event_tool_vehicle_seat_user_id = auth.uid()
    )
  );

create policy "Authorized users can remove seats"
  on public.event_tool_vehicle_seats for delete
  using (
    event_tool_vehicle_seat_user_id = auth.uid()
    or event_tool_vehicle_seat_added_by = auth.uid()
    or exists (
      select 1 from public.event_tool_vehicles v
      where v.event_tool_vehicle_id = event_tool_vehicle_seat_vehicle_id
        and v.event_tool_vehicle_created_by = auth.uid()
    )
    or exists (
      select 1 from public.event_tool_vehicle_seats s2
      where s2.event_tool_vehicle_seat_vehicle_id = event_tool_vehicle_seat_vehicle_id
        and s2.event_tool_vehicle_seat_index = 0
        and s2.event_tool_vehicle_seat_user_id = auth.uid()
    )
  );

-- RPCs with user info (security definer to bypass users RLS)
create or replace function public.get_event_tool_vehicles(p_tool_id uuid)
returns table (
  vehicle_id uuid,
  description text,
  departure_location text,
  departure_date timestamptz,
  seat_count integer,
  seat_layout text,
  created_by uuid,
  created_at timestamptz,
  driver_id uuid,
  driver_full_name text,
  driver_avatar_url text,
  occupied_count integer
)
language sql security definer stable set search_path = '' as $$
  select
    v.event_tool_vehicle_id,
    v.event_tool_vehicle_description,
    v.event_tool_vehicle_departure_location,
    v.event_tool_vehicle_departure_date,
    v.event_tool_vehicle_seat_count,
    v.event_tool_vehicle_seat_layout,
    v.event_tool_vehicle_created_by,
    v.event_tool_vehicle_created_at,
    driver_seat.event_tool_vehicle_seat_user_id,
    du.full_name,
    du.avatar_url,
    coalesce(occupied.cnt, 0)::integer
  from public.event_tool_vehicles v
  left join public.event_tool_vehicle_seats driver_seat
    on driver_seat.event_tool_vehicle_seat_vehicle_id = v.event_tool_vehicle_id
    and driver_seat.event_tool_vehicle_seat_index = 0
  left join public.users du on du.id = driver_seat.event_tool_vehicle_seat_user_id
  left join lateral (
    select count(*)::integer as cnt
    from public.event_tool_vehicle_seats
    where event_tool_vehicle_seat_vehicle_id = v.event_tool_vehicle_id
  ) occupied on true
  where v.event_tool_vehicle_event_tool_id = p_tool_id
    and public.can_see_event_tool(p_tool_id, auth.uid())
  order by v.event_tool_vehicle_created_at asc;
$$;

grant execute on function public.get_event_tool_vehicles(uuid) to authenticated;

create or replace function public.get_event_tool_vehicle_seats(p_vehicle_id uuid)
returns table (
  seat_index integer,
  user_id uuid,
  full_name text,
  avatar_url text,
  added_by uuid,
  added_at timestamptz
)
language sql security definer stable set search_path = '' as $$
  select
    s.event_tool_vehicle_seat_index,
    s.event_tool_vehicle_seat_user_id,
    u.full_name,
    u.avatar_url,
    s.event_tool_vehicle_seat_added_by,
    s.event_tool_vehicle_seat_added_at
  from public.event_tool_vehicle_seats s
  left join public.users u on u.id = s.event_tool_vehicle_seat_user_id
  join public.event_tool_vehicles v
    on v.event_tool_vehicle_id = s.event_tool_vehicle_seat_vehicle_id
  where s.event_tool_vehicle_seat_vehicle_id = p_vehicle_id
    and public.can_see_event_tool(v.event_tool_vehicle_event_tool_id, auth.uid())
  order by s.event_tool_vehicle_seat_index asc;
$$;

grant execute on function public.get_event_tool_vehicle_seats(uuid) to authenticated;

create or replace function public.get_event_tool_vehicle_stops(p_vehicle_id uuid)
returns table (
  stop_id uuid,
  label text,
  stop_order integer
)
language sql security definer stable set search_path = '' as $$
  select
    s.event_tool_vehicle_stop_id,
    s.event_tool_vehicle_stop_label,
    s.event_tool_vehicle_stop_order
  from public.event_tool_vehicle_stops s
  join public.event_tool_vehicles v
    on v.event_tool_vehicle_id = s.event_tool_vehicle_stop_vehicle_id
  where s.event_tool_vehicle_stop_vehicle_id = p_vehicle_id
    and public.can_see_event_tool(v.event_tool_vehicle_event_tool_id, auth.uid())
  order by s.event_tool_vehicle_stop_order asc;
$$;

grant execute on function public.get_event_tool_vehicle_stops(uuid) to authenticated;
