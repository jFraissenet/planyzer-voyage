-- ============================================================================
-- Recipe catalogue: a single `recipe` table holds both the public app-wide
-- catalogue and each user's personal recipes. Distinction via:
--   - recipe_visibility ('private' | 'public')
--   - recipe_owner_id   (null = seeded by admin; non-null = user-created)
--
-- A separate `recipe_share` table grants read access to specific users on a
-- private recipe (the share mechanism is enabled from day one per Jeremy's
-- ask, even though no UI ships in this migration).
--
-- Distinct from `event_tool_meal_recipe`, which holds trip-scoped clones.
-- A nullable `parent_recipe_id` on event_tool_meal_recipe traces the
-- catalogue origin (null = recipe was authored manually in the tool).
-- ============================================================================

create type public.recipe_visibility as enum ('private', 'public');

-- ---------------------------------------------------------------------------
-- recipe
-- ---------------------------------------------------------------------------
create table public.recipe (
  recipe_id uuid primary key default gen_random_uuid(),
  recipe_visibility public.recipe_visibility not null default 'private',
  -- null = seeded by admin (no individual owner). Non-null = personal recipe.
  recipe_owner_id uuid references auth.users(id) on delete cascade,
  -- When forked from a catalogue recipe, points back to the source. Lets us
  -- show "based on X" and keep ancestry. Null for original recipes.
  recipe_parent_id uuid references public.recipe(recipe_id) on delete set null,
  recipe_title text not null,
  recipe_description text,
  recipe_time_prep_minutes int
    check (recipe_time_prep_minutes is null or recipe_time_prep_minutes >= 0),
  recipe_time_cook_minutes int
    check (recipe_time_cook_minutes is null or recipe_time_cook_minutes >= 0),
  recipe_time_rest_minutes int
    check (recipe_time_rest_minutes is null or recipe_time_rest_minutes >= 0),
  recipe_calories int
    check (recipe_calories is null or recipe_calories >= 0),
  recipe_servings int not null default 4 check (recipe_servings > 0),
  recipe_created_at timestamptz not null default now(),
  recipe_updated_at timestamptz not null default now()
);

create index recipe_owner_idx on public.recipe(recipe_owner_id);
create index recipe_visibility_idx on public.recipe(recipe_visibility);
create index recipe_parent_idx on public.recipe(recipe_parent_id);

create or replace function public.set_recipe_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.recipe_updated_at = now();
  return new;
end;
$$;

create trigger recipe_set_updated_at
  before update on public.recipe
  for each row execute function public.set_recipe_updated_at();

-- ---------------------------------------------------------------------------
-- recipe_ingredient — same hybrid (catalog_id XOR custom_name) as
-- event_tool_meal_recipe_ingredient.
-- ---------------------------------------------------------------------------
create table public.recipe_ingredient (
  recipe_ingredient_id uuid primary key default gen_random_uuid(),
  recipe_ingredient_recipe_id uuid not null
    references public.recipe(recipe_id) on delete cascade,
  recipe_ingredient_catalog_id uuid
    references public.ingredient(ingredient_id) on delete restrict,
  recipe_ingredient_custom_name text,
  recipe_ingredient_quantity numeric(10, 2) not null
    check (recipe_ingredient_quantity > 0),
  recipe_ingredient_unit public.meal_unit not null,
  recipe_ingredient_position int not null default 0,
  constraint recipe_ingredient_source_xor check (
    (recipe_ingredient_catalog_id is not null)
    <> (recipe_ingredient_custom_name is not null)
  )
);

create index recipe_ingredients_recipe_idx
  on public.recipe_ingredient(recipe_ingredient_recipe_id);

-- ---------------------------------------------------------------------------
-- recipe_step
-- ---------------------------------------------------------------------------
create table public.recipe_step (
  recipe_step_id uuid primary key default gen_random_uuid(),
  recipe_step_recipe_id uuid not null
    references public.recipe(recipe_id) on delete cascade,
  recipe_step_position int not null default 0,
  recipe_step_text text not null
);

create index recipe_steps_recipe_idx
  on public.recipe_step(recipe_step_recipe_id);

-- ---------------------------------------------------------------------------
-- recipe_share — many-to-many between private recipes and the users they're
-- shared with. Only the recipe owner can grant or revoke.
-- ---------------------------------------------------------------------------
create table public.recipe_share (
  recipe_share_recipe_id uuid not null
    references public.recipe(recipe_id) on delete cascade,
  recipe_share_user_id uuid not null
    references auth.users(id) on delete cascade,
  recipe_share_shared_at timestamptz not null default now(),
  primary key (recipe_share_recipe_id, recipe_share_user_id)
);

create index recipe_shares_user_idx on public.recipe_share(recipe_share_user_id);

-- ---------------------------------------------------------------------------
-- Trace cloning origin on the trip-scoped recipes.
-- ---------------------------------------------------------------------------
alter table public.event_tool_meal_recipe
  add column event_tool_meal_recipe_parent_recipe_id uuid
    references public.recipe(recipe_id) on delete set null;

create index event_tool_meal_recipes_parent_idx
  on public.event_tool_meal_recipe(event_tool_meal_recipe_parent_recipe_id);

-- ===========================================================================
-- RLS
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- recipe
-- ---------------------------------------------------------------------------
alter table public.recipe enable row level security;

-- Read: public OR own OR shared with me.
create policy "Visible recipes are public, owned, or shared"
  on public.recipe for select
  using (
    recipe_visibility = 'public'
    or recipe_owner_id = auth.uid()
    or exists (
      select 1 from public.recipe_share
      where recipe_share_recipe_id = recipe_id
        and recipe_share_user_id = auth.uid()
    )
  );

-- Insert: any authenticated user, but must declare themselves as owner.
create policy "Authenticated users create their own recipes"
  on public.recipe for insert
  with check (recipe_owner_id = auth.uid());

-- Update / delete: owner only.
create policy "Owners update their own recipes"
  on public.recipe for update
  using (recipe_owner_id = auth.uid());

create policy "Owners delete their own recipes"
  on public.recipe for delete
  using (recipe_owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- recipe_ingredient — visibility piggybacks on the parent recipe; writes are
-- gated on owner.
-- ---------------------------------------------------------------------------
alter table public.recipe_ingredient enable row level security;

create policy "Readable ingredients follow the recipe visibility"
  on public.recipe_ingredient for select
  using (
    exists (
      select 1 from public.recipe r
      where r.recipe_id = recipe_ingredient_recipe_id
        and (
          r.recipe_visibility = 'public'
          or r.recipe_owner_id = auth.uid()
          or exists (
            select 1 from public.recipe_share
            where recipe_share_recipe_id = r.recipe_id
              and recipe_share_user_id = auth.uid()
          )
        )
    )
  );

create policy "Recipe owners write ingredients"
  on public.recipe_ingredient for all
  using (
    exists (
      select 1 from public.recipe r
      where r.recipe_id = recipe_ingredient_recipe_id
        and r.recipe_owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.recipe r
      where r.recipe_id = recipe_ingredient_recipe_id
        and r.recipe_owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- recipe_step
-- ---------------------------------------------------------------------------
alter table public.recipe_step enable row level security;

create policy "Readable steps follow the recipe visibility"
  on public.recipe_step for select
  using (
    exists (
      select 1 from public.recipe r
      where r.recipe_id = recipe_step_recipe_id
        and (
          r.recipe_visibility = 'public'
          or r.recipe_owner_id = auth.uid()
          or exists (
            select 1 from public.recipe_share
            where recipe_share_recipe_id = r.recipe_id
              and recipe_share_user_id = auth.uid()
          )
        )
    )
  );

create policy "Recipe owners write steps"
  on public.recipe_step for all
  using (
    exists (
      select 1 from public.recipe r
      where r.recipe_id = recipe_step_recipe_id
        and r.recipe_owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.recipe r
      where r.recipe_id = recipe_step_recipe_id
        and r.recipe_owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- recipe_share — both parties (owner + grantee) can see the share row;
-- only the owner can grant or revoke.
-- ---------------------------------------------------------------------------
alter table public.recipe_share enable row level security;

create policy "Share rows are visible to both parties"
  on public.recipe_share for select
  using (
    recipe_share_user_id = auth.uid()
    or exists (
      select 1 from public.recipe r
      where r.recipe_id = recipe_share_recipe_id
        and r.recipe_owner_id = auth.uid()
    )
  );

create policy "Owners grant share"
  on public.recipe_share for insert
  with check (
    exists (
      select 1 from public.recipe r
      where r.recipe_id = recipe_share_recipe_id
        and r.recipe_owner_id = auth.uid()
    )
  );

create policy "Owners revoke share"
  on public.recipe_share for delete
  using (
    exists (
      select 1 from public.recipe r
      where r.recipe_id = recipe_share_recipe_id
        and r.recipe_owner_id = auth.uid()
    )
  );
