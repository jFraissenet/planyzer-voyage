-- ============================================================================
-- Update clone_recipe_to_event_tool to accept a target serving count.
-- With per-serving quantity storage, the clone keeps the source's per-serving
-- values and only writes the chosen `servings` on the new event_tool entry —
-- multiplication happens at display time. p_target_servings = null falls back
-- to the source recipe's servings (so existing callers don't break).
-- ============================================================================

drop function if exists public.clone_recipe_to_event_tool(uuid, uuid);

create or replace function public.clone_recipe_to_event_tool(
  p_recipe_id uuid,
  p_tool_id uuid,
  p_target_servings int default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_source record;
  v_new_recipe_id uuid;
  v_servings int;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if not public.can_see_event_tool(p_tool_id, v_user_id) then
    raise exception 'not_authorized_tool';
  end if;

  select r.recipe_id,
         r.recipe_title,
         r.recipe_description,
         r.recipe_time_prep_minutes,
         r.recipe_time_cook_minutes,
         r.recipe_time_rest_minutes,
         r.recipe_calories,
         r.recipe_servings
    into v_source
  from public.recipe r
  where r.recipe_id = p_recipe_id
    and (
      r.recipe_visibility = 'public'
      or r.recipe_owner_id = v_user_id
      or exists (
        select 1 from public.recipe_share
        where recipe_share_recipe_id = r.recipe_id
          and recipe_share_user_id = v_user_id
      )
    );

  if v_source.recipe_id is null then
    raise exception 'recipe_not_found_or_not_accessible';
  end if;

  -- Resolve the target servings: explicit param wins, else inherit source.
  v_servings := coalesce(p_target_servings, v_source.recipe_servings);
  if v_servings is null or v_servings <= 0 then
    v_servings := 4;
  end if;

  insert into public.event_tool_meal_recipe (
    event_tool_meal_recipe_event_tool_id,
    event_tool_meal_recipe_title,
    event_tool_meal_recipe_description,
    event_tool_meal_recipe_time_prep_minutes,
    event_tool_meal_recipe_time_cook_minutes,
    event_tool_meal_recipe_time_rest_minutes,
    event_tool_meal_recipe_calories,
    event_tool_meal_recipe_servings,
    event_tool_meal_recipe_author_id,
    event_tool_meal_recipe_parent_recipe_id
  ) values (
    p_tool_id,
    v_source.recipe_title,
    v_source.recipe_description,
    v_source.recipe_time_prep_minutes,
    v_source.recipe_time_cook_minutes,
    v_source.recipe_time_rest_minutes,
    v_source.recipe_calories,
    v_servings,
    v_user_id,
    p_recipe_id
  )
  returning event_tool_meal_recipe_id into v_new_recipe_id;

  -- Copy ingredients as-is — they're per-serving in both source and target.
  insert into public.event_tool_meal_recipe_ingredient (
    event_tool_meal_recipe_ingredient_recipe_id,
    event_tool_meal_recipe_ingredient_catalog_id,
    event_tool_meal_recipe_ingredient_custom_name,
    event_tool_meal_recipe_ingredient_quantity,
    event_tool_meal_recipe_ingredient_unit,
    event_tool_meal_recipe_ingredient_position
  )
  select
    v_new_recipe_id,
    recipe_ingredient_catalog_id,
    recipe_ingredient_custom_name,
    recipe_ingredient_quantity,
    recipe_ingredient_unit,
    recipe_ingredient_position
  from public.recipe_ingredient
  where recipe_ingredient_recipe_id = p_recipe_id;

  insert into public.event_tool_meal_recipe_step (
    event_tool_meal_recipe_step_recipe_id,
    event_tool_meal_recipe_step_position,
    event_tool_meal_recipe_step_text
  )
  select
    v_new_recipe_id,
    recipe_step_position,
    recipe_step_text
  from public.recipe_step
  where recipe_step_recipe_id = p_recipe_id;

  return v_new_recipe_id;
end;
$$;

grant execute on function public.clone_recipe_to_event_tool(uuid, uuid, int)
  to authenticated;
