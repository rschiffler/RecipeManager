// HTTP handlers for recipe CRUD.
import type { Request, Response } from 'express';
import {
  createRecipe,
  deleteRecipe,
  getRecipeById,
  listRecipes,
} from './recipes.service';
import { updateRecipe } from './recipes.service';

function parseId(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseBody(req: Request) {
  const b = (req.body ?? {}) as Record<string, unknown>;
  // Accept instructions as array or newline-separated string (UI sends both).
  let instructions = b.instructions;
  if (typeof instructions === 'string') {
    instructions = (instructions as string).split('\n');
  }
  // Accept tags as tagIds: number[] or tags: ({id} | number)[].
  const rawTags = (b.tagIds ?? b.tags) as unknown;
  let tagIds: number[] | undefined;
  if (rawTags !== undefined) {
    const list = Array.isArray(rawTags) ? rawTags : [rawTags];
    tagIds = list
      .map((t) => (typeof t === 'object' && t !== null && 'id' in t ? Number((t as { id: unknown }).id) : Number(t)))
      .filter((n) => Number.isFinite(n));
  }
  // Accept ingredients with camelCase or snake_case keys.
  const rawIngredients = b.ingredients as unknown;
  let ingredients: { id?: number; name?: string; amount?: string | number | null; unitId?: number | null; notes?: string | null }[] | undefined;
  if (rawIngredients !== undefined && Array.isArray(rawIngredients)) {
    ingredients = rawIngredients.map((row) => {
      const r = (row ?? {}) as Record<string, unknown>;
      const unitRaw = r.unitId ?? r.unit_id;
      return {
        id: r.id == null || r.id === '' ? undefined : Number(r.id),
        name: r.name == null ? undefined : String(r.name),
        amount: (r.amount ?? null) as string | number | null,
        unitId: unitRaw == null || unitRaw === '' ? null : Number(unitRaw),
        notes: r.notes == null ? null : String(r.notes),
      };
    });
  }
  return {
    title: b.title as string,
    description: (b.description ?? null) as string | null,
    prepTimeMinutes: (b.prepTimeMinutes ?? b.prep_time_minutes ?? null) as number | null,
    cookTimeMinutes: (b.cookTimeMinutes ?? b.cook_time_minutes ?? null) as number | null,
    servings: (b.servings ?? null) as number | null,
    instructions: instructions as string[] | null | undefined,
    tagIds,
    ingredients,
  };
}

function toStatus(err: unknown): number {
  if (typeof err === 'object' && err !== null && 'statusCode' in err) {
    const code = Number((err as { statusCode: unknown }).statusCode);
    if (Number.isInteger(code) && code >= 400 && code < 600) return code;
  }
  return 500;
}

export async function listRecipesHandler(req: Request, res: Response): Promise<void> {
  try {
    const recipes = await listRecipes({
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      tag: typeof req.query.tag === 'string' ? req.query.tag : undefined,
      limit: req.query.limit as unknown as number,
      offset: req.query.offset as unknown as number,
    });
    res.json(recipes);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function getRecipeHandler(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  if (id == null) {
    res.status(400).json({ error: 'Invalid recipe id' });
    return;
  }
  try {
    const recipe = await getRecipeById(id);
    if (!recipe) {
      res.status(404).json({ error: 'Recipe not found' });
      return;
    }
    res.json(recipe);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function createRecipeHandler(req: Request, res: Response): Promise<void> {
  try {
    const recipe = await createRecipe(parseBody(req) as Parameters<typeof createRecipe>[0]);
    res.status(201).json(recipe);
  } catch (err) {
    res.status(toStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function updateRecipeHandler(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  if (id == null) {
    res.status(400).json({ error: 'Invalid recipe id' });
    return;
  }
  try {
    const recipe = await updateRecipe(id, parseBody(req));
    if (!recipe) {
      res.status(404).json({ error: 'Recipe not found' });
      return;
    }
    res.json(recipe);
  } catch (err) {
    res.status(toStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function deleteRecipeHandler(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  if (id == null) {
    res.status(400).json({ error: 'Invalid recipe id' });
    return;
  }
  try {
    const deleted = await deleteRecipe(id);
    if (!deleted) {
      res.status(404).json({ error: 'Recipe not found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
