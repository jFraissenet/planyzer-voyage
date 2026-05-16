-- ============================================================================
-- Meals tool: per-event recipe planning with global ingredient catalogue.
-- Phase 1 surface:
--   - Members add manual recipes to their tool instance.
--   - Ingredients are picked from a global, seeded catalogue OR typed freely.
--   - Steps are stored ordered.
-- Aggregation across recipes (sum of ingredients) is computed client-side
-- from these tables — no aggregate table needed yet.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enums (prefixed `meal_` to keep the global namespace tidy).
-- Values are deliberately closed for v1; new values require a new migration.
-- ---------------------------------------------------------------------------
create type public.meal_unit as enum (
  'g', 'kg', 'ml', 'cl', 'l',
  'cas', 'cac',                   -- cuillère à soupe / café
  'piece', 'gousse', 'botte', 'pincee',
  'sachet', 'tranche', 'boite',
  'qb'                            -- quantum sufficit (à votre guise)
);

create type public.meal_rayon as enum (
  'legumes_fruits',
  'viande_poisson',
  'cremerie',
  'epicerie_salee',
  'epicerie_sucree',
  'surgele',
  'boulangerie',
  'boissons',
  'condiments_epices',
  'frais_traiteur'
);

-- ---------------------------------------------------------------------------
-- ingredient — global catalogue, shared across all events and users.
-- Seeded by admin (~50-100 items). Users can fall back to free text on the
-- recipe_ingredient row when an ingredient is missing, so we lock writes
-- behind the service role for v1 (no INSERT/UPDATE/DELETE policy).
-- ---------------------------------------------------------------------------
create table public.ingredient (
  ingredient_id uuid primary key default gen_random_uuid(),
  ingredient_name text not null,
  ingredient_default_unit public.meal_unit not null,
  ingredient_rayon public.meal_rayon,
  ingredient_created_by uuid references auth.users(id) on delete set null,
  ingredient_created_at timestamptz not null default now()
);

-- Case-insensitive uniqueness on the name — prevents "Tomate" / "tomate"
-- doublons in the catalogue.
create unique index ingredient_name_lower_idx
  on public.ingredient (lower(ingredient_name));

alter table public.ingredient enable row level security;

create policy "Authenticated users can read the ingredient catalogue"
  on public.ingredient for select
  using (auth.uid() is not null);

-- No write policies in v1 → only the service role (migrations) can insert.

-- ---------------------------------------------------------------------------
-- event_tool_meal_recipe — a recipe attached to one meals tool instance.
-- ---------------------------------------------------------------------------
create table public.event_tool_meal_recipe (
  event_tool_meal_recipe_id uuid primary key default gen_random_uuid(),
  event_tool_meal_recipe_event_tool_id uuid not null
    references public.event_tools(event_tool_id) on delete cascade,
  event_tool_meal_recipe_title text not null,
  event_tool_meal_recipe_description text,
  event_tool_meal_recipe_time_minutes int
    check (event_tool_meal_recipe_time_minutes is null
           or event_tool_meal_recipe_time_minutes >= 0),
  event_tool_meal_recipe_calories int
    check (event_tool_meal_recipe_calories is null
           or event_tool_meal_recipe_calories >= 0),
  event_tool_meal_recipe_servings int not null default 4
    check (event_tool_meal_recipe_servings > 0),
  event_tool_meal_recipe_author_id uuid references auth.users(id) on delete set null,
  event_tool_meal_recipe_created_at timestamptz not null default now(),
  event_tool_meal_recipe_updated_at timestamptz not null default now()
);

create index event_tool_meal_recipes_tool_idx
  on public.event_tool_meal_recipe(event_tool_meal_recipe_event_tool_id);

create or replace function public.set_event_tool_meal_recipe_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.event_tool_meal_recipe_updated_at = now();
  return new;
end;
$$;

create trigger event_tool_meal_recipe_set_updated_at
  before update on public.event_tool_meal_recipe
  for each row execute function public.set_event_tool_meal_recipe_updated_at();

alter table public.event_tool_meal_recipe enable row level security;

create policy "Users with tool access can read recipes"
  on public.event_tool_meal_recipe for select
  using (public.can_see_event_tool(event_tool_meal_recipe_event_tool_id, auth.uid()));

create policy "Users with tool access can create recipes"
  on public.event_tool_meal_recipe for insert
  with check (
    event_tool_meal_recipe_author_id = auth.uid()
    and public.can_see_event_tool(event_tool_meal_recipe_event_tool_id, auth.uid())
  );

create policy "Authors or tool managers can update recipes"
  on public.event_tool_meal_recipe for update
  using (
    event_tool_meal_recipe_author_id = auth.uid()
    or public.is_event_tool_manager(event_tool_meal_recipe_event_tool_id, auth.uid())
  );

create policy "Authors or tool admins can delete recipes"
  on public.event_tool_meal_recipe for delete
  using (
    event_tool_meal_recipe_author_id = auth.uid()
    or public.is_event_tool_admin(event_tool_meal_recipe_event_tool_id, auth.uid())
  );

-- ---------------------------------------------------------------------------
-- event_tool_meal_recipe_ingredient — hybrid: catalog FK OR free text.
-- ---------------------------------------------------------------------------
create table public.event_tool_meal_recipe_ingredient (
  event_tool_meal_recipe_ingredient_id uuid primary key default gen_random_uuid(),
  event_tool_meal_recipe_ingredient_recipe_id uuid not null
    references public.event_tool_meal_recipe(event_tool_meal_recipe_id) on delete cascade,
  event_tool_meal_recipe_ingredient_catalog_id uuid
    references public.ingredient(ingredient_id) on delete restrict,
  event_tool_meal_recipe_ingredient_custom_name text,
  event_tool_meal_recipe_ingredient_quantity numeric(10, 2) not null
    check (event_tool_meal_recipe_ingredient_quantity > 0),
  event_tool_meal_recipe_ingredient_unit public.meal_unit not null,
  event_tool_meal_recipe_ingredient_position int not null default 0,
  -- Exactly one of (catalog_id, custom_name) must be set. Aggregation logic
  -- groups by catalog_id when present, else by lower(trim(custom_name)).
  constraint event_tool_meal_recipe_ingredient_source_xor check (
    (event_tool_meal_recipe_ingredient_catalog_id is not null)
    <> (event_tool_meal_recipe_ingredient_custom_name is not null)
  )
);

create index event_tool_meal_recipe_ingredients_recipe_idx
  on public.event_tool_meal_recipe_ingredient(event_tool_meal_recipe_ingredient_recipe_id);

alter table public.event_tool_meal_recipe_ingredient enable row level security;

create policy "Users with tool access can read recipe ingredients"
  on public.event_tool_meal_recipe_ingredient for select
  using (
    exists (
      select 1 from public.event_tool_meal_recipe r
      where r.event_tool_meal_recipe_id = event_tool_meal_recipe_ingredient_recipe_id
        and public.can_see_event_tool(r.event_tool_meal_recipe_event_tool_id, auth.uid())
    )
  );

create policy "Recipe authors or managers can write recipe ingredients"
  on public.event_tool_meal_recipe_ingredient for all
  using (
    exists (
      select 1 from public.event_tool_meal_recipe r
      where r.event_tool_meal_recipe_id = event_tool_meal_recipe_ingredient_recipe_id
        and (
          r.event_tool_meal_recipe_author_id = auth.uid()
          or public.is_event_tool_manager(r.event_tool_meal_recipe_event_tool_id, auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from public.event_tool_meal_recipe r
      where r.event_tool_meal_recipe_id = event_tool_meal_recipe_ingredient_recipe_id
        and (
          r.event_tool_meal_recipe_author_id = auth.uid()
          or public.is_event_tool_manager(r.event_tool_meal_recipe_event_tool_id, auth.uid())
        )
    )
  );

-- ---------------------------------------------------------------------------
-- event_tool_meal_recipe_step — ordered preparation steps.
-- ---------------------------------------------------------------------------
create table public.event_tool_meal_recipe_step (
  event_tool_meal_recipe_step_id uuid primary key default gen_random_uuid(),
  event_tool_meal_recipe_step_recipe_id uuid not null
    references public.event_tool_meal_recipe(event_tool_meal_recipe_id) on delete cascade,
  event_tool_meal_recipe_step_position int not null default 0,
  event_tool_meal_recipe_step_text text not null
);

create index event_tool_meal_recipe_steps_recipe_idx
  on public.event_tool_meal_recipe_step(event_tool_meal_recipe_step_recipe_id);

alter table public.event_tool_meal_recipe_step enable row level security;

create policy "Users with tool access can read recipe steps"
  on public.event_tool_meal_recipe_step for select
  using (
    exists (
      select 1 from public.event_tool_meal_recipe r
      where r.event_tool_meal_recipe_id = event_tool_meal_recipe_step_recipe_id
        and public.can_see_event_tool(r.event_tool_meal_recipe_event_tool_id, auth.uid())
    )
  );

create policy "Recipe authors or managers can write recipe steps"
  on public.event_tool_meal_recipe_step for all
  using (
    exists (
      select 1 from public.event_tool_meal_recipe r
      where r.event_tool_meal_recipe_id = event_tool_meal_recipe_step_recipe_id
        and (
          r.event_tool_meal_recipe_author_id = auth.uid()
          or public.is_event_tool_manager(r.event_tool_meal_recipe_event_tool_id, auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from public.event_tool_meal_recipe r
      where r.event_tool_meal_recipe_id = event_tool_meal_recipe_step_recipe_id
        and (
          r.event_tool_meal_recipe_author_id = auth.uid()
          or public.is_event_tool_manager(r.event_tool_meal_recipe_event_tool_id, auth.uid())
        )
    )
  );
