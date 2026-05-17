-- ============================================================================
-- New ingredient type `graines` for edible seeds (chia, lin, tournesol,
-- courge, sésame, chanvre, pavot, pignon). Nuts and dried fruits live in
-- `fruits`; peanuts in `legumineuses` (botanically a pulse).
-- Postgres limitation: new enum value cannot be used in the same transaction
-- → the seed is in migration 055.
-- ============================================================================

alter type public.meal_ingredient_type add value 'graines';
