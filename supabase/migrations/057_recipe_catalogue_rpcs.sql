-- ============================================================================
-- Recipe catalogue RPCs:
--   - list_recipe_catalogue : paginated list with optional name search
--   - get_recipe            : single recipe with ingredients + steps (jsonb)
--   - clone_recipe_to_event_tool : eager-copy a catalogue recipe into a meals
--     tool. The new event_tool entry's parent_recipe_id is set so we can
--     trace the origin even after the user modifies the copy.
--   - save_event_tool_recipe_to_catalogue : eager-copy a trip recipe back
--     to the user's personal catalogue (visibility='private'). The new
--     catalogue entry inherits parent_recipe_id from the trip entry, so
--     "based on X" ancestry is preserved across forks.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- LIST
-- ---------------------------------------------------------------------------
create or replace function public.list_recipe_catalogue(
  p_search text,
  p_limit int
)
returns table (
  recipe_id uuid,
  visibility public.recipe_visibility,
  owner_id uuid,
  owner_full_name text,
  owner_avatar_url text,
  parent_recipe_id uuid,
  title text,
  description text,
  time_prep_minutes int,
  time_cook_minutes int,
  time_rest_minutes int,
  calories int,
  servings int,
  ingredients_count int,
  steps_count int,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    r.recipe_id,
    r.recipe_visibility,
    r.recipe_owner_id,
    u.full_name,
    u.avatar_url,
    r.recipe_parent_id,
    r.recipe_title,
    r.recipe_description,
    r.recipe_time_prep_minutes,
    r.recipe_time_cook_minutes,
    r.recipe_time_rest_minutes,
    r.recipe_calories,
    r.recipe_servings,
    (
      select count(*)::int
      from public.recipe_ingredient
      where recipe_ingredient_recipe_id = r.recipe_id
    ),
    (
      select count(*)::int
      from public.recipe_step
      where recipe_step_recipe_id = r.recipe_id
    ),
    r.recipe_created_at,
    r.recipe_updated_at
  from public.recipe r
  left join public.users u on u.id = r.recipe_owner_id
  where (
    r.recipe_visibility = 'public'
    or r.recipe_owner_id = auth.uid()
    or exists (
      select 1 from public.recipe_share
      where recipe_share_recipe_id = r.recipe_id
        and recipe_share_user_id = auth.uid()
    )
  )
  and (
    coalesce(p_search, '') = ''
    or r.recipe_title ilike '%' || p_search || '%'
  )
  order by r.recipe_created_at desc
  limit coalesce(p_limit, 50);
$$;

grant execute on function public.list_recipe_catalogue(text, int) to authenticated;

-- ---------------------------------------------------------------------------
-- DETAIL
-- ---------------------------------------------------------------------------
create or replace function public.get_recipe(p_recipe_id uuid)
returns table (
  recipe_id uuid,
  visibility public.recipe_visibility,
  owner_id uuid,
  owner_full_name text,
  owner_avatar_url text,
  parent_recipe_id uuid,
  title text,
  description text,
  time_prep_minutes int,
  time_cook_minutes int,
  time_rest_minutes int,
  calories int,
  servings int,
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
    r.recipe_id,
    r.recipe_visibility,
    r.recipe_owner_id,
    u.full_name,
    u.avatar_url,
    r.recipe_parent_id,
    r.recipe_title,
    r.recipe_description,
    r.recipe_time_prep_minutes,
    r.recipe_time_cook_minutes,
    r.recipe_time_rest_minutes,
    r.recipe_calories,
    r.recipe_servings,
    r.recipe_created_at,
    r.recipe_updated_at,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', i.recipe_ingredient_id,
            'catalog_id', i.recipe_ingredient_catalog_id,
            'custom_name', i.recipe_ingredient_custom_name,
            'catalog_name', ing.ingredient_name,
            'catalog_type', ing.ingredient_type,
            'quantity', i.recipe_ingredient_quantity,
            'unit', i.recipe_ingredient_unit,
            'position', i.recipe_ingredient_position
          )
          order by i.recipe_ingredient_position
        )
        from public.recipe_ingredient i
        left join public.ingredient ing
          on ing.ingredient_id = i.recipe_ingredient_catalog_id
        where i.recipe_ingredient_recipe_id = r.recipe_id
      ),
      '[]'::jsonb
    ),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', s.recipe_step_id,
            'position', s.recipe_step_position,
            'text', s.recipe_step_text
          )
          order by s.recipe_step_position
        )
        from public.recipe_step s
        where s.recipe_step_recipe_id = r.recipe_id
      ),
      '[]'::jsonb
    )
  from public.recipe r
  left join public.users u on u.id = r.recipe_owner_id
  where r.recipe_id = p_recipe_id
    and (
      r.recipe_visibility = 'public'
      or r.recipe_owner_id = auth.uid()
      or exists (
        select 1 from public.recipe_share
        where recipe_share_recipe_id = r.recipe_id
          and recipe_share_user_id = auth.uid()
      )
    );
$$;

grant execute on function public.get_recipe(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- CLONE: catalogue → event_tool (eager)
-- Authorization: caller must have tool access AND be allowed to read the
-- source recipe (RLS-equivalent checks done inline since SECURITY DEFINER
-- bypasses RLS).
-- ---------------------------------------------------------------------------
create or replace function public.clone_recipe_to_event_tool(
  p_recipe_id uuid,
  p_tool_id uuid
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
    v_source.recipe_servings,
    v_user_id,
    p_recipe_id
  )
  returning event_tool_meal_recipe_id into v_new_recipe_id;

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

grant execute on function public.clone_recipe_to_event_tool(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- SAVE: event_tool → personal catalogue (eager)
-- The new catalogue row is private and owned by the caller. Parent ancestry
-- (if the trip recipe was itself cloned from a catalogue recipe) is forwarded
-- so we keep the lineage chain X → Y → trip-recipe.
-- ---------------------------------------------------------------------------
create or replace function public.save_event_tool_recipe_to_catalogue(
  p_event_tool_recipe_id uuid
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
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select etmr.event_tool_meal_recipe_id,
         etmr.event_tool_meal_recipe_event_tool_id,
         etmr.event_tool_meal_recipe_title,
         etmr.event_tool_meal_recipe_description,
         etmr.event_tool_meal_recipe_time_prep_minutes,
         etmr.event_tool_meal_recipe_time_cook_minutes,
         etmr.event_tool_meal_recipe_time_rest_minutes,
         etmr.event_tool_meal_recipe_calories,
         etmr.event_tool_meal_recipe_servings,
         etmr.event_tool_meal_recipe_parent_recipe_id
    into v_source
  from public.event_tool_meal_recipe etmr
  where etmr.event_tool_meal_recipe_id = p_event_tool_recipe_id
    and public.can_see_event_tool(
      etmr.event_tool_meal_recipe_event_tool_id, v_user_id
    );

  if v_source.event_tool_meal_recipe_id is null then
    raise exception 'source_not_found_or_not_accessible';
  end if;

  insert into public.recipe (
    recipe_visibility,
    recipe_owner_id,
    recipe_parent_id,
    recipe_title,
    recipe_description,
    recipe_time_prep_minutes,
    recipe_time_cook_minutes,
    recipe_time_rest_minutes,
    recipe_calories,
    recipe_servings
  ) values (
    'private',
    v_user_id,
    v_source.event_tool_meal_recipe_parent_recipe_id,
    v_source.event_tool_meal_recipe_title,
    v_source.event_tool_meal_recipe_description,
    v_source.event_tool_meal_recipe_time_prep_minutes,
    v_source.event_tool_meal_recipe_time_cook_minutes,
    v_source.event_tool_meal_recipe_time_rest_minutes,
    v_source.event_tool_meal_recipe_calories,
    v_source.event_tool_meal_recipe_servings
  )
  returning recipe_id into v_new_recipe_id;

  insert into public.recipe_ingredient (
    recipe_ingredient_recipe_id,
    recipe_ingredient_catalog_id,
    recipe_ingredient_custom_name,
    recipe_ingredient_quantity,
    recipe_ingredient_unit,
    recipe_ingredient_position
  )
  select
    v_new_recipe_id,
    event_tool_meal_recipe_ingredient_catalog_id,
    event_tool_meal_recipe_ingredient_custom_name,
    event_tool_meal_recipe_ingredient_quantity,
    event_tool_meal_recipe_ingredient_unit,
    event_tool_meal_recipe_ingredient_position
  from public.event_tool_meal_recipe_ingredient
  where event_tool_meal_recipe_ingredient_recipe_id = p_event_tool_recipe_id;

  insert into public.recipe_step (
    recipe_step_recipe_id,
    recipe_step_position,
    recipe_step_text
  )
  select
    v_new_recipe_id,
    event_tool_meal_recipe_step_position,
    event_tool_meal_recipe_step_text
  from public.event_tool_meal_recipe_step
  where event_tool_meal_recipe_step_recipe_id = p_event_tool_recipe_id;

  return v_new_recipe_id;
end;
$$;

grant execute on function public.save_event_tool_recipe_to_catalogue(uuid) to authenticated;
