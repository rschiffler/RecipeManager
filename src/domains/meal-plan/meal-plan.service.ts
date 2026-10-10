// Business logic for the weekly meal plan endpoint.
// All code for this endpoint lives under src/domains/meal-plan.
import type Ingredient from '../../models/Ingredient';
import Recipe from '../../models/Recipe';
import Tag from '../../models/Tag';
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
  proteins: string[];
  additionalTags: string[];
  unfilteredProteins: string[];
}
/**
 * Build a weekly meal plan: one recipe per protein tag (1 to 3 required),
 * excluding recipes used in the last 4 meal plans. Eligible recipes are
 * shuffled with Fisher-Yates on each request, so repeated calls vary.
 *
 * Additional (non-protein) tags act as a filter: each picked recipe must
 * carry all of them. When no recipe matches a protein combined with the
 * filter, that protein falls back to an unfiltered pick (reported in
 * `unfilteredProteins`) so the plan still covers every protein.
 *
 * @param tagNames - e.g. ['Chicken', 'Beef', 'Freezable']
 */
export async function getWeeklyMealPlan(tagNames: string[]): Promise<WeeklyMealPlanResult> {
  const tags = normalizeTags(tagNames);

  // Split the requested names into protein vs additional tags via the DB.
  // Unknown names are ignored.
  const known = tags.length > 0
    ? await Tag.query()
      .select('tags.name')
      .joinRelated('tagType')
      .select('tagType.name as tagType')
      .whereIn('tags.name', tags)
    : [];
  const proteins: string[] = [];
  const additional: string[] = [];
  for (const requested of tags) {
    const row = known.find((r) => String(r.name) === requested);
    if (!row) continue;
    const typeName = String((row as unknown as { tagType: unknown }).tagType ?? '').toLowerCase();
    (typeName === 'protein' ? proteins : additional).push(requested);
  }

  if (proteins.length === 0) {
    throw Object.assign(
      new Error('Provide 1 to 3 protein tags, e.g. GET /api/meal-plan/weekly?tags=Chicken,Beef'),
      { statusCode: 400 },
    );
  }
  if (proteins.length > 3) {
    throw Object.assign(new Error('Pick at most 3 protein tags'), { statusCode: 400 });
  }

  // 1. Get all recipes which have any of the requested protein tags.
  const taggedRecipes = await Recipe.query()
    .distinct('recipes.*')
    .joinRelated('tags')
    .whereIn('tags.name', proteins)
    .orderBy('recipes.id')
    .withGraphFetched('[ingredients, tags]');

  // 2. Get the last 4 meal plans and their recipe ids.
  const recentRecipeIds = await getRecentRecipeIds(4);

  // 3. One random recipe per protein (in protein order): prefer recipes
  // carrying all additional tags, then unfiltered fresh ones, then anything
  // unpicked (recent included). Never pick the same recipe twice.
  const hasAllAdditional = (recipe: Recipe) =>
    additional.every((name) => (recipe.tags ?? []).some((t) => t.name === name));
  const excludePicked = (list: Recipe[], pickedIds: Set<number>) =>
    list.filter((recipe) => !pickedIds.has(Number(recipe.id)));
  const excludeRecent = (list: Recipe[]) =>
    list.filter((recipe) => !recentRecipeIds.has(Number(recipe.id)));

  const recipes: Recipe[] = [];
  const pickedIds = new Set<number>();
  const unfilteredProteins: string[] = [];
  for (const protein of proteins) {
    const withProtein = taggedRecipes.filter((recipe) =>
      (recipe.tags ?? []).some((t) => t.name === protein),
    );
    let pool = excludePicked(excludeRecent(withProtein.filter(hasAllAdditional)), pickedIds);
    let fellBack = false;
    if (pool.length === 0 && additional.length > 0) {
      pool = excludePicked(excludeRecent(withProtein), pickedIds);
      fellBack = pool.length > 0;
    }
    if (pool.length === 0) {
      pool = excludePicked(withProtein, pickedIds);
      fellBack = additional.length > 0 && pool.length > 0;
    }
    if (pool.length === 0) continue;
    const [choice] = shuffle(pool);
    recipes.push(choice);
    pickedIds.add(Number(choice.id));
    if (fellBack) unfilteredProteins.push(protein);
  }

  // 4. Collect every ingredient used across the remaining recipes (deduped by id).
  const ingredients = collectIngredients(recipes);

  return { recipes, ingredients, proteins, additionalTags: additional, unfilteredProteins };
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
