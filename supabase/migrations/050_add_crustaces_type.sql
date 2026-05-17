-- ============================================================================
-- New ingredient type `crustaces` to host shellfish + crustaceans. The label
-- in i18n covers the broader "fruits de mer" umbrella (mollusks included).
-- Postgres limitation: a freshly-added enum value cannot be used in the same
-- transaction → the seed lives in migration 051.
-- ============================================================================

alter type public.meal_ingredient_type add value 'crustaces';
