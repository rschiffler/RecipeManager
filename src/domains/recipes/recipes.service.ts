// Business logic for recipe CRUD (list / get / create / update / delete).
// Recipes include ingredients (via recipe_ingredients join extras) and tags.
import { raw } from 'objection';
import Ingredient from '../../models/Ingredient';
import MeasurementUnit from '../../models/MeasurementUnit';
import Recipe from '../../models/Recipe';
import Tag from '../../models/Tag';
import TagType from '../../models/TagType';

export interface RecipeIngredientInput {
  id?: number;
  name?: string;
  amount?: string | number | null;
  unitId?: number | null;
  notes?: string | null;
}

export interface UpsertRecipeInput {
  title: string;
  description?: string | null;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  servings?: number | null;
  instructions?: string[] | null;
  tagIds?: number[];
  ingredients?: RecipeIngredientInput[];
}

const RECIPE_GRAPH = '[ingredients, tags]';

function toNullableInt(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.floor(n));
}

function toNullableServings(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}

function normalizeInstructions(value: unknown): string[] | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const list = Array.isArray(value) ? value : String(value ?? '').split('\n');
  const steps = list.map((s) => String(s ?? '').trim()).filter((s) => s.length > 0);
  return steps;
}

function normalizeAmount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  const n = parseFloat(String(value ?? ''));
  if (Number.isFinite(n) && n > 0) return n;
  return 1;
}

export function recipeBaseQuery() {
  return Recipe.query().withGraphFetched(RECIPE_GRAPH);
}

export interface ListRecipesOptions {
  search?: string;
  tag?: string;
  limit?: number;
  offset?: number;
}

export async function listRecipes(options: ListRecipesOptions = {}): Promise<Recipe[]> {
  const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 200);
  const offset = Math.max(Number(options.offset) || 0, 0);
  const query = Recipe.query()
    .withGraphFetched(RECIPE_GRAPH)
    .orderBy('recipes.id', 'asc')
    .limit(limit)
    .offset(offset);

  if (options.search && options.search.trim().length > 0) {
    const term = `%${options.search.trim()}%`;
    query.where((builder) => {
      builder
        .where('recipes.title', 'ilike', term)
        .orWhere('recipes.description', 'ilike', term);
    });
  }

  if (options.tag && options.tag.trim().length > 0) {
    const tags = options.tag
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (tags.length > 0) {
      query.joinRelated('tags').whereIn('tags.name', tags).distinctOn('recipes.id');
    }
  }

  return query;
}

export async function getRecipeById(id: number): Promise<Recipe | undefined> {
  return Recipe.query().findById(id).withGraphFetched(RECIPE_GRAPH);
}

async function replaceRecipeLinks(
  recipeId: number,
  input: UpsertRecipeInput,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trx: any
): Promise<void> {
  if (input.tagIds !== undefined) {
    const tagIds = [...new Set((input.tagIds ?? []).map(Number).filter(Number.isFinite))];
    await trx('recipe_tags').where('recipe_id', recipeId).del();
    if (tagIds.length > 0) {
      // Only link tags that actually exist.
      const existing = await Tag.query(trx).whereIn('id', tagIds).select('id');
      const rows = existing.map((t) => ({ recipeId, tagId: Number(t.id) }));
      if (rows.length > 0) {
        await trx('recipe_tags').insert(rows.map((r) => ({ recipe_id: r.recipeId, tag_id: r.tagId })));
      }
    }
  }

  if (input.ingredients !== undefined) {
    await trx('recipe_ingredients').where('recipe_id', recipeId).del();
    for (const item of input.ingredients ?? []) {
      const ingredientId = await Ingredient.query(trx)
        .findOne(raw('lower(name) = lower(?)', [String(item.name ?? item.id ?? '').trim()]))
        .then(async (found) => {
          if (found) return Number(found.id);
          if (item.id != null) {
            const byId = await Ingredient.query(trx).findById(Number(item.id));
            if (byId) return Number(byId.id);
          }
          const name = String(item.name ?? '').trim();
          if (!name) return null;
          const created = await Ingredient.query(trx).insert({ name });
          return Number(created.id);
        });
      if (ingredientId == null) continue;
      const unitId =
        item.unitId === null || item.unitId === undefined || (item.unitId as unknown) === ''
          ? null
          : Number(item.unitId);
      const unitExists =
        unitId == null || !Number.isFinite(unitId)
          ? null
          : ((await MeasurementUnit.query(trx).findById(unitId)) ? unitId : null);
      await trx('recipe_ingredients').insert({
        recipe_id: recipeId,
        ingredient_id: ingredientId,
        unit_id: unitExists,
        amount: normalizeAmount(item.amount),
        notes: item.notes == null || String(item.notes).trim() === '' ? null : String(item.notes).trim(),
      });
    }
  }
}

function buildRecipePatch(input: UpsertRecipeInput): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = String(input.title).trim();
  if (input.description !== undefined) {
    patch.description =
      input.description == null || String(input.description).trim() === ''
        ? null
        : String(input.description);
  }
  const prep = toNullableInt(input.prepTimeMinutes);
  if (prep !== undefined) patch.prepTimeMinutes = prep;
  const cook = toNullableInt(input.cookTimeMinutes);
  if (cook !== undefined) patch.cookTimeMinutes = cook;
  const servings = toNullableServings(input.servings);
  if (servings !== undefined) patch.servings = servings;
  const instructions = normalizeInstructions(input.instructions);
  if (instructions !== undefined) patch.instructions = instructions;
  return patch;
}

export async function createRecipe(input: UpsertRecipeInput): Promise<Recipe> {
  if (!input.title || String(input.title).trim().length === 0) {
    throw Object.assign(new Error('title is required'), { statusCode: 400 });
  }
  const patch = buildRecipePatch({ ...input, title: String(input.title).trim() });
  const createdId = await Recipe.transaction(async (trx) => {
    const created = await Recipe.query(trx).insert(patch);
    await replaceRecipeLinks(Number(created.id), input, trx);
    return Number(created.id);
  });
  const full = await getRecipeById(createdId);
  if (!full) throw new Error('Failed to load created recipe');
  return full;
}

export async function updateRecipe(id: number, input: Partial<UpsertRecipeInput>): Promise<Recipe | undefined> {
  const existing = await Recipe.query().findById(id);
  if (!existing) return undefined;
  if (input.title !== undefined && String(input.title).trim().length === 0) {
    throw Object.assign(new Error('title must not be empty'), { statusCode: 400 });
  }
  await Recipe.transaction(async (trx) => {
    const patch = buildRecipePatch(input as UpsertRecipeInput);
    if (Object.keys(patch).length > 0) {
      await Recipe.query(trx).findById(id).patch(patch);
    }
    await replaceRecipeLinks(id, input as UpsertRecipeInput, trx);
  });
  return getRecipeById(id);
}

export async function deleteRecipe(id: number): Promise<boolean> {
  const rows = await Recipe.query().deleteById(id);
  return rows > 0;
}

export async function listLookups() {
  const [ingredients, tags, units, tagTypes] = await Promise.all([
    Ingredient.query().orderBy('name').select('id', 'name', 'category'),
    Tag.query().orderBy('name').select('id', 'name', 'tagTypeId'),
    MeasurementUnit.query().orderBy('name').select('id', 'name', 'abbreviation'),
    TagType.query().orderBy('name').select('id', 'name'),
  ]);
  return { ingredients, tags, units, tagTypes };
}
