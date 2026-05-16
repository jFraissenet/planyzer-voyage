-- ============================================================================
-- Meals tool: list + atomic upsert RPCs.
--   - get_event_tool_meal_recipes : returns recipes with nested ingredients
--     (joined with catalog for the name) and steps as jsonb arrays. Lets the
--     UI render the list + the aggregation tab from a single round-trip.
--   - upsert_event_tool_meal_recipe : create or replace a recipe in one
--     transaction. p_recipe_id = null → insert; otherwise update + replace
--     ingredients/steps. Authorization is enforced inside the function.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- LIST
-- ---------------------------------------------------------------------------
create or replace function public.get_event_tool_meal_recipes(p_tool_id uuid)
returns table (
  recipe_id uuid,
  title text,
  description text,
  time_minutes int,
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
    r.event_tool_meal_recipe_time_minutes,
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
            'catalog_rayon', ing.ingredient_rayon,
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

-- ---------------------------------------------------------------------------
-- UPSERT (atomic create-or-replace)
-- p_ingredients : jsonb array of objects with { catalog_id, custom_name,
--   quantity, unit }. catalog_id and custom_name are XOR — same constraint as
--   the underlying table.
-- p_steps : jsonb array of strings (the step texts in order).
-- ---------------------------------------------------------------------------
create or replace function public.upsert_event_tool_meal_recipe(
  p_recipe_id uuid,
  p_tool_id uuid,
  p_title text,
  p_description text,
  p_time_minutes int,
  p_calories int,
  p_servings int,
  p_ingredients jsonb,
  p_steps jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_recipe_id uuid := p_recipe_id;
  v_existing_author uuid;
  v_existing_tool uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if v_recipe_id is null then
    -- CREATE path: requires tool access.
    if not public.can_see_event_tool(p_tool_id, v_user_id) then
      raise exception 'not_authorized';
    end if;
    insert into public.event_tool_meal_recipe (
      event_tool_meal_recipe_event_tool_id,
      event_tool_meal_recipe_title,
      event_tool_meal_recipe_description,
      event_tool_meal_recipe_time_minutes,
      event_tool_meal_recipe_calories,
      event_tool_meal_recipe_servings,
      event_tool_meal_recipe_author_id
    ) values (
      p_tool_id,
      p_title,
      nullif(p_description, ''),
      p_time_minutes,
      p_calories,
      coalesce(p_servings, 4),
      v_user_id
    )
    returning event_tool_meal_recipe_id into v_recipe_id;
  else
    -- UPDATE path: must be author or tool manager. p_tool_id is ignored on
    -- update (we trust the stored value).
    select event_tool_meal_recipe_author_id,
           event_tool_meal_recipe_event_tool_id
      into v_existing_author, v_existing_tool
    from public.event_tool_meal_recipe
    where event_tool_meal_recipe_id = v_recipe_id;

    if v_existing_tool is null then
      raise exception 'not_found';
    end if;
    if v_existing_author is distinct from v_user_id
       and not public.is_event_tool_manager(v_existing_tool, v_user_id) then
      raise exception 'not_authorized';
    end if;

    update public.event_tool_meal_recipe set
      event_tool_meal_recipe_title = p_title,
      event_tool_meal_recipe_description = nullif(p_description, ''),
      event_tool_meal_recipe_time_minutes = p_time_minutes,
      event_tool_meal_recipe_calories = p_calories,
      event_tool_meal_recipe_servings = coalesce(p_servings, 4)
    where event_tool_meal_recipe_id = v_recipe_id;
  end if;

  -- Replace ingredients in one shot (delete then insert).
  delete from public.event_tool_meal_recipe_ingredient
  where event_tool_meal_recipe_ingredient_recipe_id = v_recipe_id;

  if jsonb_typeof(p_ingredients) = 'array' and jsonb_array_length(p_ingredients) > 0 then
    insert into public.event_tool_meal_recipe_ingredient (
      event_tool_meal_recipe_ingredient_recipe_id,
      event_tool_meal_recipe_ingredient_catalog_id,
      event_tool_meal_recipe_ingredient_custom_name,
      event_tool_meal_recipe_ingredient_quantity,
      event_tool_meal_recipe_ingredient_unit,
      event_tool_meal_recipe_ingredient_position
    )
    select
      v_recipe_id,
      case when nullif(ing->>'catalog_id', '') is null
        then null
        else (ing->>'catalog_id')::uuid
      end,
      nullif(ing->>'custom_name', ''),
      (ing->>'quantity')::numeric,
      (ing->>'unit')::public.meal_unit,
      (ord - 1)::int
    from jsonb_array_elements(p_ingredients)
      with ordinality as t(ing, ord);
  end if;

  -- Replace steps. p_steps is a jsonb array of strings.
  delete from public.event_tool_meal_recipe_step
  where event_tool_meal_recipe_step_recipe_id = v_recipe_id;

  if jsonb_typeof(p_steps) = 'array' and jsonb_array_length(p_steps) > 0 then
    insert into public.event_tool_meal_recipe_step (
      event_tool_meal_recipe_step_recipe_id,
      event_tool_meal_recipe_step_position,
      event_tool_meal_recipe_step_text
    )
    select
      v_recipe_id,
      (ord - 1)::int,
      step_text::text
    from jsonb_array_elements_text(p_steps)
      with ordinality as t(step_text, ord);
  end if;

  return v_recipe_id;
end;
$$;

grant execute on function public.upsert_event_tool_meal_recipe(
  uuid, uuid, text, text, int, int, int, jsonb, jsonb
) to authenticated;
