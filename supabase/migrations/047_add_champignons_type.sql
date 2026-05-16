-- ============================================================================
-- Add `champignons` to the ingredient type enum. Mushrooms aren't vegetables
-- botanically and they sit on their own aisle in most supermarkets.
-- Splitting into two migrations because Postgres forbids using a freshly
-- added enum value in the same transaction it was added.
-- Migration 048 will move the seeded mushroom rows to this new type.
-- ============================================================================

alter type public.meal_ingredient_type add value 'champignons';
