-- ============================================================================
-- Split `legumes_fruits` into two distinct ingredient types (legumes vs
-- fruits) and rename the field from "rayon" (supermarket aisle) to "type"
-- (what the ingredient is), which is a more semantic and stable taxonomy.
--
--   - meal_rayon              → meal_ingredient_type
--   - ingredient.ingredient_rayon → ingredient.ingredient_type
--   - enum value `legumes_fruits` → `legumes` (existing rows auto-migrate)
--   - new enum value `fruits` added (no rows use it yet)
--   - RPC get_event_tool_meal_recipes: `catalog_rayon` → `catalog_type` in
--     the ingredients jsonb payload.
-- ============================================================================

-- Rename value (renames propagate to all rows already using it).
alter type public.meal_rayon rename value 'legumes_fruits' to 'legumes';

-- Add the new value. Postgres 12+: allowed inside a transaction, but the
-- new value cannot be used in the same transaction (we don't, so fine).
alter type public.meal_rayon add value 'fruits';

-- Rename the enum type itself.
alter type public.meal_rayon rename to meal_ingredient_type;

-- Rename the column on `ingredient`.
alter table public.ingredient
  rename column ingredient_rayon to ingredient_type;

-- Drop and recreate the RPC: only the ingredients jsonb shape changes
-- (catalog_rayon → catalog_type), but the function signature is unchanged.
drop function if exists public.get_event_tool_meal_recipes(uuid);

create or replace function public.get_event_tool_meal_recipes(p_tool_id uuid)
returns table (
  recipe_id uuid,
  title text,
  description text,
  time_prep_minutes int,
  time_cook_minutes int,
  time_rest_minutes int,
  calories int,
  servings int,
  author_id uuid,
  author_full_name text,
  author_avatar_url text,
  created_at timestamptz,
  updated_at timestamptz,
  ingredients jsonb,
  steps jsonb
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    r.event_tool_meal_recipe_id,
    r.event_tool_meal_recipe_title,
    r.event_tool_meal_recipe_description,
    r.event_tool_meal_recipe_time_prep_minutes,
    r.event_tool_meal_recipe_time_cook_minutes,
    r.event_tool_meal_recipe_time_rest_minutes,
    r.event_tool_meal_recipe_calories,
    r.event_tool_meal_recipe_servings,
    r.event_tool_meal_recipe_author_id,
    u.full_name,
    u.avatar_url,
    r.event_tool_meal_recipe_created_at,
    r.event_tool_meal_recipe_updated_at,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', i.event_tool_meal_recipe_ingredient_id,
            'catalog_id', i.event_tool_meal_recipe_ingredient_catalog_id,
            'custom_name', i.event_tool_meal_recipe_ingredient_custom_name,
            'catalog_name', ing.ingredient_name,
            'catalog_type', ing.ingredient_type,
            'quantity', i.event_tool_meal_recipe_ingredient_quantity,
            'unit', i.event_tool_meal_recipe_ingredient_unit,
            'position', i.event_tool_meal_recipe_ingredient_position
          )
          order by i.event_tool_meal_recipe_ingredient_position
        )
        from public.event_tool_meal_recipe_ingredient i
        left join public.ingredient ing
          on ing.ingredient_id = i.event_tool_meal_recipe_ingredient_catalog_id
        where i.event_tool_meal_recipe_ingredient_recipe_id = r.event_tool_meal_recipe_id
      ),
      '[]'::jsonb
    ),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', s.event_tool_meal_recipe_step_id,
            'position', s.event_tool_meal_recipe_step_position,
            'text', s.event_tool_meal_recipe_step_text
          )
          order by s.event_tool_meal_recipe_step_position
        )
        from public.event_tool_meal_recipe_step s
        where s.event_tool_meal_recipe_step_recipe_id = r.event_tool_meal_recipe_id
      ),
      '[]'::jsonb
    )
  from public.event_tool_meal_recipe r
  left join public.users u
    on u.id = r.event_tool_meal_recipe_author_id
  where r.event_tool_meal_recipe_event_tool_id = p_tool_id
    and public.can_see_event_tool(p_tool_id, auth.uid())
  order by r.event_tool_meal_recipe_created_at desc;
$$;

grant execute on function public.get_event_tool_meal_recipes(uuid) to authenticated;
