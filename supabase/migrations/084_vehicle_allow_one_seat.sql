-- Allow single-seat vehicles (driver only, no passengers).
-- The original CHECK required seat_count between 2 and 10. Drop whichever
-- CHECK constraint currently guards seat_count (name is auto-generated), then
-- re-add it with a lower bound of 1.
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'event_tool_vehicles'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%seat_count%'
  loop
    execute format(
      'alter table public.event_tool_vehicles drop constraint %I',
      c.conname
    );
  end loop;
end $$;

alter table public.event_tool_vehicles
  add constraint event_tool_vehicles_event_tool_vehicle_seat_count_check
  check (event_tool_vehicle_seat_count between 1 and 10);
