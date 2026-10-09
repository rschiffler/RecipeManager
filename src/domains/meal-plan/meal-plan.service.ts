// Business logic for the weekly meal plan endpoint.
// All code for this endpoint lives under src/domains/meal-plan.
import type Ingredient from '../../models/Ingredient';
import Recipe from '../../models/Recipe';
import WeeklyMealPlan from '../../models/WeeklyMealPlan';

export function normalizeTags(input: unknown): string[] {
  if (input === undefined || input === null) {
    return [];
  }
  const list: unknown[] = Array.isArray(input) ? input : [input];
  return [
    ...new Set(
      list
        .flatMap((value) =>
          typeof value === 'string' || typeof value === 'number' ? String(value).split(',') : []
        )
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    ),
  ];
}

export function normalizeCount(input: unknown, fallback = 3): number {
  const raw = Array.isArray(input) ? input[0] : input;
  const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), 20);
}

/** Fisher-Yates shuffle (new array, does not mutate input). */
export function shuffle<T>(list: T[]): T[] {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j] as T, arr[i] as T];
  }
  return arr;
}

async function getRecentRecipeIds(limit = 4): Promise<Set<number>> {
  const recentPlans = await WeeklyMealPlan.query()
    .orderBy('createdAt', 'DESC')
    .orderBy('id', 'DESC')
    .limit(limit);
  return new Set(recentPlans.map((plan) => Number(plan.recipeId)));
}

export interface WeeklyMealPlanResult {
  recipes: Recipe[];
  ingredients: Ingredient[];
}
/**
 * Build a weekly meal plan from recipes matching any of the given tags,
 * excluding recipes used in the last 4 meal plans.
 * Returns `count` random recipes by default (override with `count`).
 * Eligible recipes are shuffled with Fisher-Yates on each request.
 *
 * When 3 or more tags are given, returns one recipe per tag instead:
 * each tag contributes a single random recipe (preferring ones not used
 * recently), so the plan covers every requested tag.
 *
 * @param tagNames - e.g. ['Chicken', 'Beef']
 * @param count - number of recipes to return (default 3; ignored when 3+ tags are given)
 */
export async function getWeeklyMealPlan(
  tagNames: string[],
  count = 3
): Promise<WeeklyMealPlanResult> {
  const tags = normalizeTags(tagNames);

  if (tags.length >= 3) {
    return getOneRecipePerTag(tags);
  }

  // 1. Get all recipes which have any of the requested tags.
  const taggedRecipes = await Recipe.query()
    .distinct('recipes.*')
    .joinRelated('tags')
    .whereIn('tags.name', tags)
    .orderBy('recipes.id')
    .withGraphFetched('[ingredients, tags]');

  // 2. Get the last 4 meal plans and their recipe ids.
  const recentRecipeIds = await getRecentRecipeIds(4);

  // 3. Filter out recipes already used in the last 4 meal plans,
  // then randomly pick `count` (shuffled each request).
  const eligible = taggedRecipes.filter(
    (recipe) => !recentRecipeIds.has(Number(recipe.id))
  );
  const recipes = shuffle(eligible).slice(0, Math.max(1, Math.floor(count)));

  // 4. Collect every ingredient used across the remaining recipes (deduped by id).
  const ingredients = collectIngredients(recipes);

  return { recipes, ingredients };
}

/** Collect every ingredient used across the given recipes (deduped by id). */
function collectIngredients(recipes: Recipe[]): Ingredient[] {
  const ingredientsById = new Map<number, Ingredient>();
  for (const recipe of recipes) {
    for (const ingredient of recipe.ingredients ?? []) {
      const id = Number(ingredient.id);
      if (!ingredientsById.has(id)) {
        ingredientsById.set(id, ingredient);
      }
    }
  }
  return [...ingredientsById.values()];
}

/**
 * Pick a single random recipe for each requested tag (in tag order),
 * preferring recipes not used in the last 4 meal plans and not already
 * picked for another tag. Falls back to recently-used recipes for a tag
 * when nothing fresh remains; tags with no recipes at all are skipped.
 */
async function getOneRecipePerTag(tags: string[]): Promise<WeeklyMealPlanResult> {
  const taggedRecipes = await Recipe.query()
    .distinct('recipes.*')
    .joinRelated('tags')
    .whereIn('tags.name', tags)
    .orderBy('recipes.id')
    .withGraphFetched('[ingredients, tags]');

  const recentRecipeIds = await getRecentRecipeIds(4);

  const recipes: Recipe[] = [];
  const pickedIds = new Set<number>();
  for (const tag of tags) {
    const matching = taggedRecipes.filter((recipe) =>
      (recipe.tags ?? []).some((t) => t.name === tag)
    );
    const fresh = matching.filter(
      (recipe) => !recentRecipeIds.has(Number(recipe.id)) && !pickedIds.has(Number(recipe.id))
    );
    const pool =
      fresh.length > 0 ? fresh : matching.filter((recipe) => !pickedIds.has(Number(recipe.id)));
    if (pool.length === 0) continue;
    const [choice] = shuffle(pool);
    recipes.push(choice as Recipe);
    pickedIds.add(Number((choice as Recipe).id));
  }

  return { recipes, ingredients: collectIngredients(recipes) };
}

/** ISO-8601 calendar: week containing the Thursday determines year + week number. */
export function getIsoWeek(inputDate: Date = new Date()): { year: number; weekNumber: number } {
  const d = new Date(Date.UTC(inputDate.getFullYear(), inputDate.getMonth(), inputDate.getDate()));
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0 … Sunday = 6
  d.setUTCDate(d.getUTCDate() - day + 3); // shift to Thursday of this week
  const year = d.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  const weekNumber = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return { year, weekNumber };
}

export function normalizeRecipeIds(input: unknown): number[] {
  const list: unknown[] = Array.isArray(input) ? input : [input];
  return [
    ...new Set(
      list
        .map((value) => (typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN))
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  ];
}

export interface SaveWeeklyMealPlanOptions {
  year?: unknown;
  weekNumber?: unknown;
}

function normalizeYearWeek(options: SaveWeeklyMealPlanOptions): { year: number; weekNumber: number } {
  const fallback = getIsoWeek();
  const rawYear = Array.isArray(options.year) ? options.year[0] : options.year;
  const rawWeek = Array.isArray(options.weekNumber) ? options.weekNumber[0] : options.weekNumber;
  const year = rawYear === undefined || rawYear === null || rawYear === '' ? fallback.year : Number(rawYear);
  const weekNumber =
    rawWeek === undefined || rawWeek === null || rawWeek === '' ? fallback.weekNumber : Number(rawWeek);
  if (!Number.isInteger(year) || year < 2024) {
    throw new Error('Invalid year: must be an integer >= 2024.');
  }
  if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 53) {
    throw new Error('Invalid weekNumber: must be an integer between 1 and 53.');
  }
  return { year, weekNumber };
}

/**
 * Persist a selected weekly plan: one row per recipe in `weekly_meal_plans`.
 * Defaults to the current ISO week when year/weekNumber are omitted.
 */
export async function saveWeeklyMealPlan(
  recipeIdsInput: unknown,
  options: SaveWeeklyMealPlanOptions = {},
): Promise<{ year: number; weekNumber: number; plans: WeeklyMealPlan[] }> {
  const recipeIds = normalizeRecipeIds(recipeIdsInput);
  if (recipeIds.length === 0) {
    throw new Error('Provide at least one recipeId, e.g. POST /api/meal-plan/weekly { "recipeIds": [1, 2, 3] }');
  }
  const { year, weekNumber } = normalizeYearWeek(options);

  const existing = await Recipe.query().whereIn('id', recipeIds);
  const found = new Set(existing.map((recipe) => Number(recipe.id)));
  const missing = recipeIds.filter((id) => !found.has(id));
  if (missing.length > 0) {
    throw new Error(`Unknown recipeIds: ${missing.join(', ')}`);
  }

  const plans = await WeeklyMealPlan.query().insert(
    recipeIds.map((recipeId) => ({ recipeId, year, weekNumber })),
  );
  return { year, weekNumber, plans: Array.isArray(plans) ? plans : [plans] };
}
