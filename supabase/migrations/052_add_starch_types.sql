-- ============================================================================
-- Three new ingredient types for shelf-stable starchy staples:
--   - cereales      : grains and their direct derivatives (rice, flour,
--                     semolina, oats, polenta, quinoa, buckwheat…)
--   - legumineuses  : pulses (lentils, beans, chickpeas, dried peas…)
--   - feculents     : composite starches that aren't grains or pulses
--                     (pasta in all forms, gnocchi, chestnuts, tapioca…)
-- Postgres limitation: new values cannot be used in the same transaction
-- they're added in → the seed lives in migration 053.
-- ============================================================================

alter type public.meal_ingredient_type add value 'cereales';
alter type public.meal_ingredient_type add value 'legumineuses';
alter type public.meal_ingredient_type add value 'feculents';
