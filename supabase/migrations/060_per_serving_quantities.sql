-- ============================================================================
-- Convert recipe ingredient quantities from "total for the recipe" to
-- "per serving". The app multiplies by recipe.servings at display time and
-- divides at save time, so all CRUD now operates in per-serving units.
--
-- Why: lets the user choose "for how many people" when importing a recipe
-- from the catalogue (or when scaling a meal mid-trip) without rewriting
-- every ingredient row. servings becomes a pure display/scale parameter.
--
-- We also bump precision from (10,2) to (12,4) so divisions like 1/3 or
-- 1/7 keep more meaningful precision. Display rounds to 0.25 anyway, but
-- the stored value stays accurate for re-multiplication.
--
-- Idempotent at the framework level (Supabase tracks applied migrations);
-- DON'T re-run this script standalone — it would divide twice.
-- ============================================================================

alter table public.recipe_ingredient
  alter column recipe_ingredient_quantity type numeric(12, 4);

alter table public.event_tool_meal_recipe_ingredient
  alter column event_tool_meal_recipe_ingredient_quantity type numeric(12, 4);

update public.recipe_ingredient ri
set recipe_ingredient_quantity =
  ri.recipe_ingredient_quantity / r.recipe_servings
from public.recipe r
where ri.recipe_ingredient_recipe_id = r.recipe_id
  and r.recipe_servings > 0;

update public.event_tool_meal_recipe_ingredient etmri
set event_tool_meal_recipe_ingredient_quantity =
  etmri.event_tool_meal_recipe_ingredient_quantity
  / etmr.event_tool_meal_recipe_servings
from public.event_tool_meal_recipe etmr
where etmri.event_tool_meal_recipe_ingredient_recipe_id
        = etmr.event_tool_meal_recipe_id
  and etmr.event_tool_meal_recipe_servings > 0;
