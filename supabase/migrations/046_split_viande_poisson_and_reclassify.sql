-- ============================================================================
-- Two cleanup moves on the ingredient taxonomy:
--   1. Split `viande_poisson` into `viande` + `poisson` so the shopping list
--      can group them separately.
--   2. Reclassify garlic, onions and fresh herbs from `legumes` to
--      `condiments_epices` — they're used to flavour, not as a main
--      vegetable. Affects 24 of the 100 rows seeded in migration 044.
-- ============================================================================

-- 1. Rename `viande_poisson` → `viande`. No seeded row uses it yet, so this
--    is just to free the name; existing rows would auto-migrate if any.
alter type public.meal_ingredient_type
  rename value 'viande_poisson' to 'viande';

-- Add `poisson` as a sibling. Cannot be used in this same transaction
-- (Postgres limitation) — we don't, so fine.
alter type public.meal_ingredient_type
  add value 'poisson';

-- 2. Move the alliacées + fresh herbs to condiments_epices.
update public.ingredient
set ingredient_type = 'condiments_epices'
where ingredient_name in (
  -- Alliacées / aromates
  'Ail',
  'Oignon jaune',
  'Oignon rouge',
  'Oignon blanc',
  'Oignon nouveau',
  'Échalote',
  'Ciboule',
  -- Herbes aromatiques fraîches
  'Persil plat',
  'Persil frisé',
  'Basilic',
  'Ciboulette',
  'Coriandre',
  'Menthe',
  'Thym',
  'Romarin',
  'Sauge',
  'Estragon',
  'Aneth',
  'Cerfeuil',
  'Origan frais',
  'Marjolaine',
  'Sarriette',
  'Laurier',
  'Citronnelle'
);
