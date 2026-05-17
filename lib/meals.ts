import { supabase } from "./supabase";

// Closed enums — must stay in sync with public.meal_unit / public.meal_rayon
// in migration 040. Add a value here AND a migration in lockstep.
export type MealUnit =
  | "g"
  | "kg"
  | "ml"
  | "cl"
  | "l"
  | "cas"
  | "cac"
  | "piece"
  | "gousse"
  | "botte"
  | "pincee"
  | "sachet"
  | "tranche"
  | "boite"
  | "qb";

export const MEAL_UNITS: MealUnit[] = [
  "g",
  "kg",
  "ml",
  "cl",
  "l",
  "cas",
  "cac",
  "piece",
  "gousse",
  "botte",
  "pincee",
  "sachet",
  "tranche",
  "boite",
  "qb",
];

export type IngredientType =
  | "legumes"
  | "fruits"
  | "champignons"
  | "viande"
  | "poisson"
  | "crustaces"
  | "cremerie"
  | "boulangerie"
  | "cereales"
  | "feculents"
  | "legumineuses"
  | "graines"
  | "epicerie_salee"
  | "epicerie_sucree"
  | "surgele"
  | "boissons"
  | "condiments_epices"
  | "frais_traiteur";

export type Ingredient = {
  ingredient_id: string;
  ingredient_name: string;
  ingredient_default_unit: MealUnit;
  ingredient_type: IngredientType | null;
};

export type MealRecipeIngredient = {
  // Stable id on the row when the recipe comes from the server. Absent for
  // freshly-built draft items in the edit modal (we mint a local id there).
  id: string;
  catalog_id: string | null;
  custom_name: string | null;
  // catalog_name is denormalized via the RPC join — present iff catalog_id
  // is set. Used for display without a second round-trip.
  catalog_name: string | null;
  catalog_type: IngredientType | null;
  quantity: number;
  unit: MealUnit;
  position: number;
};

export type MealRecipeStep = {
  id: string;
  position: number;
  text: string;
};

export type MealRecipe = {
  recipe_id: string;
  title: string;
  description: string | null;
  time_prep_minutes: number | null;
  time_cook_minutes: number | null;
  time_rest_minutes: number | null;
  calories: number | null;
  servings: number;
  author_id: string | null;
  author_full_name: string | null;
  author_avatar_url: string | null;
  created_at: string;
  updated_at: string;
  ingredients: MealRecipeIngredient[];
  steps: MealRecipeStep[];
};

// Sum of the three time legs — null if all legs are null. UI helper.
export function totalTimeMinutes(r: {
  time_prep_minutes: number | null;
  time_cook_minutes: number | null;
  time_rest_minutes: number | null;
}): number | null {
  const parts = [r.time_prep_minutes, r.time_cook_minutes, r.time_rest_minutes].filter(
    (n): n is number => typeof n === "number" && n > 0,
  );
  if (parts.length === 0) return null;
  return parts.reduce((a, b) => a + b, 0);
}

// Round a quantity to the nearest 0.25 step (so the UI never displays
// awkward decimals like 1.86 — Jeremy's rule).
// Non-zero quantities that would round to 0 are bumped up to 0.25 so an
// ingredient doesn't silently disappear from a scaled recipe.
export function roundToQuarter(n: number): number {
  const rounded = Math.round(n * 4) / 4;
  if (rounded === 0 && n > 0) return 0.25;
  return rounded;
}

// Display helper: rounds and drops trailing zeros.
//   3      → "3"
//   3.25   → "3.25"
//   1.86   → "1.75"  (rounded to nearest 0.25)
//   0.001  → "0.25"  (bumped, see roundToQuarter)
export function formatQuantity(n: number): string {
  return String(roundToQuarter(n));
}

// Shape posted to the upsert RPC. catalog_id XOR custom_name — never both.
export type MealRecipeIngredientInput = {
  catalog_id: string | null;
  custom_name: string | null;
  quantity: number;
  unit: MealUnit;
};

export type MealRecipeInput = {
  title: string;
  description: string | null;
  time_prep_minutes: number | null;
  time_cook_minutes: number | null;
  time_rest_minutes: number | null;
  calories: number | null;
  servings: number;
  ingredients: MealRecipeIngredientInput[];
  // Steps are just the texts, in display order. Empty array allowed.
  steps: string[];
};

// ---------------------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------------------

// Internal row shape returned by the RPC. We re-key it slightly so the public
// type uses `recipe_id` rather than the RPC's `recipe_id` column name (they
// match here, but going through a mapper keeps the boundary explicit).
type RpcRecipeRow = {
  recipe_id: string;
  title: string;
  description: string | null;
  time_prep_minutes: number | null;
  time_cook_minutes: number | null;
  time_rest_minutes: number | null;
  calories: number | null;
  servings: number;
  author_id: string | null;
  author_full_name: string | null;
  author_avatar_url: string | null;
  created_at: string;
  updated_at: string;
  ingredients: Array<{
    id: string;
    catalog_id: string | null;
    custom_name: string | null;
    catalog_name: string | null;
    catalog_type: IngredientType | null;
    quantity: number | string;
    unit: MealUnit;
    position: number;
  }>;
  steps: Array<{ id: string; position: number; text: string }>;
};

export async function listEventToolMealRecipes(
  toolId: string,
): Promise<MealRecipe[]> {
  const { data, error } = await supabase.rpc("get_event_tool_meal_recipes", {
    p_tool_id: toolId,
  });
  if (error) throw error;
  const rows = (data ?? []) as RpcRecipeRow[];
  return rows.map((r) => ({
    recipe_id: r.recipe_id,
    title: r.title,
    description: r.description,
    time_prep_minutes: r.time_prep_minutes,
    time_cook_minutes: r.time_cook_minutes,
    time_rest_minutes: r.time_rest_minutes,
    calories: r.calories,
    servings: r.servings,
    author_id: r.author_id,
    author_full_name: r.author_full_name,
    author_avatar_url: r.author_avatar_url,
    created_at: r.created_at,
    updated_at: r.updated_at,
    ingredients: r.ingredients.map((i) => ({
      id: i.id,
      catalog_id: i.catalog_id,
      custom_name: i.custom_name,
      catalog_name: i.catalog_name,
      catalog_type: i.catalog_type,
      // Postgres numeric arrives as a string when the value has decimals.
      quantity: typeof i.quantity === "string" ? Number(i.quantity) : i.quantity,
      unit: i.unit,
      position: i.position,
    })),
    steps: r.steps,
  }));
}

export async function upsertEventToolMealRecipe(
  toolId: string,
  recipeId: string | null,
  input: MealRecipeInput,
): Promise<string> {
  const { data, error } = await supabase.rpc("upsert_event_tool_meal_recipe", {
    p_recipe_id: recipeId,
    p_tool_id: toolId,
    p_title: input.title,
    p_description: input.description,
    p_time_prep_minutes: input.time_prep_minutes,
    p_time_cook_minutes: input.time_cook_minutes,
    p_time_rest_minutes: input.time_rest_minutes,
    p_calories: input.calories,
    p_servings: input.servings,
    p_ingredients: input.ingredients,
    p_steps: input.steps,
  });
  if (error) throw error;
  return data as string;
}

export async function deleteEventToolMealRecipe(
  recipeId: string,
): Promise<void> {
  const { error } = await supabase
    .from("event_tool_meal_recipe")
    .delete()
    .eq("event_tool_meal_recipe_id", recipeId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Ingredient catalogue search
// ---------------------------------------------------------------------------

export async function searchIngredientCatalog(
  query: string,
  limit = 12,
): Promise<Ingredient[]> {
  const q = query.trim();
  if (q.length === 0) return [];
  const { data, error } = await supabase
    .from("ingredient")
    .select(
      "ingredient_id, ingredient_name, ingredient_default_unit, ingredient_type",
    )
    .ilike("ingredient_name", `%${q}%`)
    .order("ingredient_name", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Ingredient[];
}

// ---------------------------------------------------------------------------
// Recipe catalogue (shared public catalogue + personal recipes + shared
// private). Distinct from event_tool_meal_recipe which holds trip-scoped
// clones.
// ---------------------------------------------------------------------------

export type RecipeVisibility = "private" | "public";

export type CatalogueRecipeSummary = {
  recipe_id: string;
  visibility: RecipeVisibility;
  owner_id: string | null;
  owner_full_name: string | null;
  owner_avatar_url: string | null;
  parent_recipe_id: string | null;
  title: string;
  description: string | null;
  time_prep_minutes: number | null;
  time_cook_minutes: number | null;
  time_rest_minutes: number | null;
  calories: number | null;
  servings: number;
  ingredients_count: number;
  steps_count: number;
  created_at: string;
  updated_at: string;
};

export type CatalogueRecipe = Omit<
  CatalogueRecipeSummary,
  "ingredients_count" | "steps_count"
> & {
  ingredients: MealRecipeIngredient[];
  steps: MealRecipeStep[];
};

export async function listRecipeCatalogue(
  search: string = "",
  limit: number = 50,
): Promise<CatalogueRecipeSummary[]> {
  const { data, error } = await supabase.rpc("list_recipe_catalogue", {
    p_search: search,
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as CatalogueRecipeSummary[];
}

export async function getRecipe(recipeId: string): Promise<CatalogueRecipe | null> {
  const { data, error } = await supabase.rpc("get_recipe", {
    p_recipe_id: recipeId,
  });
  if (error) throw error;
  const rows = (data ?? []) as Array<CatalogueRecipe & {
    ingredients: Array<MealRecipeIngredient & { quantity: number | string }>;
  }>;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    ...r,
    ingredients: r.ingredients.map((i) => ({
      ...i,
      quantity: typeof i.quantity === "string" ? Number(i.quantity) : i.quantity,
    })),
  };
}

// Eager-copy a catalogue recipe into a meals tool. Returns the new
// event_tool_meal_recipe_id. The parent_recipe_id link is set server-side.
// targetServings: how many people the cloned recipe should feed in the
// destination tool. Null → inherits the source recipe's servings.
export async function cloneRecipeToEventTool(
  recipeId: string,
  toolId: string,
  targetServings: number | null = null,
): Promise<string> {
  const { data, error } = await supabase.rpc("clone_recipe_to_event_tool", {
    p_recipe_id: recipeId,
    p_tool_id: toolId,
    p_target_servings: targetServings,
  });
  if (error) throw error;
  return data as string;
}

// Eager-copy a trip recipe back into the user's personal catalogue
// (visibility='private'). Returns the new recipe_id.
export async function saveEventToolRecipeToCatalogue(
  eventToolRecipeId: string,
): Promise<string> {
  const { data, error } = await supabase.rpc(
    "save_event_tool_recipe_to_catalogue",
    { p_event_tool_recipe_id: eventToolRecipeId },
  );
  if (error) throw error;
  return data as string;
}
