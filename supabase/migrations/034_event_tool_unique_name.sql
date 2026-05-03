-- Prevent two tools with the same effective name within a single event.
-- Comparison is case-insensitive and ignores leading/trailing whitespace,
-- so "Argent", "argent" and " ARGENT " are all treated as duplicates.
--
-- Implemented as a functional unique index (lower(trim(...))) which only
-- supports IMMUTABLE expressions — both lower() and trim() qualify.

create unique index if not exists event_tools_unique_name_per_event
  on public.event_tools (event_tool_event_id, lower(trim(event_tool_name)));
