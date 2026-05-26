-- Allow planning slot links to target a team. ALTER TYPE ADD VALUE must
-- run in its own migration because the new value cannot be referenced in
-- the same transaction that introduced it.
alter type public.planning_link_kind add value if not exists 'team';
