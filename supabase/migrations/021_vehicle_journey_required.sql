-- Every vehicle is now either an outbound or a return trip. No more "one_way".

update public.event_tool_vehicles
  set event_tool_vehicle_journey_type = 'outbound'
  where event_tool_vehicle_journey_type = 'one_way';

-- Drop the old check constraint (auto-named), find it dynamically
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.event_tool_vehicles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%journey_type%'
  loop
    execute format(
      'alter table public.event_tool_vehicles drop constraint %I',
      c.conname
    );
  end loop;
end $$;

alter table public.event_tool_vehicles
  add constraint event_tool_vehicles_journey_type_check
    check (event_tool_vehicle_journey_type in ('outbound', 'return'));

alter table public.event_tool_vehicles
  alter column event_tool_vehicle_journey_type set default 'outbound';
