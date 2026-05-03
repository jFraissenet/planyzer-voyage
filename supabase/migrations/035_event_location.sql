-- Optional human-readable location for an event (e.g. "Rome, Italie",
-- "Chez Marie", "Camping Saint-Brevin"). No geocoding stored — a future
-- migration can add lat/lon if/when we need maps.

alter table public.events
  add column event_location text;
