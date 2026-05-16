-- ============================================================================
-- Move the 8 mushroom rows from `legumes` to the freshly-added `champignons`
-- type (added in migration 047).
-- ============================================================================

update public.ingredient
set ingredient_type = 'champignons'
where ingredient_name in (
  'Champignon de Paris',
  'Shiitaké',
  'Pleurote',
  'Girolle',
  'Cèpe',
  'Morille',
  'Champignon de bois',
  'Truffe noire'
);
