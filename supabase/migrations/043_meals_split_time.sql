-- ============================================================================
-- Split the single time_minutes into prep / cook / rest so the recipe form
-- can be more expressive (and the detail view can show a breakdown). The
-- meals tool has no real data yet (just shipped), so we drop the old column
-- outright rather than carry a migration shim.
-- ============================================================================

alter table public.event_tool_meal_recipe
  drop column event_tool_meal_recipe_time_minutes;

alter table public.event_tool_meal_recipe
  add column event_tool_meal_recipe_time_prep_minutes int
    check (
      event_tool_meal_recipe_time_prep_minutes is null
      or event_tool_meal_recipe_time_prep_minutes >= 0
    );

alter table public.event_tool_meal_recipe
  add column event_tool_meal_recipe_time_cook_minutes int
    check (
      event_tool_meal_recipe_time_cook_minutes is null
      or event_tool_meal_recipe_time_cook_minutes >= 0
    );

alter table public.event_tool_meal_recipe
  add column event_tool_meal_recipe_time_rest_minutes int
    check (
      event_tool_meal_recipe_time_rest_minutes is null
      or event_tool_meal_recipe_time_rest_minutes >= 0
    );

-- The RPC signatures (return types / arg list) changed → drop and recreate.
drop function if exists public.get_event_tool_meal_recipes(uuid);
drop function if exists public.upsert_event_tool_meal_recipe(
  uuid, uuid, text, text, int, int, int, jsonb, jsonb
);

-- ---------------------------------------------------------------------------
-- LIST
-- ---------------------------------------------------------------------------
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
-- New time signature: prep / cook / rest, each nullable.
-- ---------------------------------------------------------------------------
create or replace function public.upsert_event_tool_meal_recipe(
  p_recipe_id uuid,
  p_tool_id uuid,
  p_title text,
  p_description text,
  p_time_prep_minutes int,
  p_time_cook_minutes int,
  p_time_rest_minutes int,
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
    if not public.can_see_event_tool(p_tool_id, v_user_id) then
      raise exception 'not_authorized';
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
      event_tool_meal_recipe_author_id
    ) values (
      p_tool_id,
      p_title,
      nullif(p_description, ''),
      p_time_prep_minutes,
      p_time_cook_minutes,
      p_time_rest_minutes,
      p_calories,
      coalesce(p_servings, 4),
      v_user_id
    )
    returning event_tool_meal_recipe_id into v_recipe_id;
  else
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
      event_tool_meal_recipe_time_prep_minutes = p_time_prep_minutes,
      event_tool_meal_recipe_time_cook_minutes = p_time_cook_minutes,
      event_tool_meal_recipe_time_rest_minutes = p_time_rest_minutes,
      event_tool_meal_recipe_calories = p_calories,
      event_tool_meal_recipe_servings = coalesce(p_servings, 4)
    where event_tool_meal_recipe_id = v_recipe_id;
  end if;

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
  uuid, uuid, text, text, int, int, int, int, int, jsonb, jsonb
) to authenticated;
