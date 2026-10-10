// HTTP handlers for /api/meal-plan/weekly: generate (GET) and save (POST) a plan.
import type { Request, Response } from 'express';
import { getWeeklyMealPlan, normalizeTags, saveWeeklyMealPlan } from './meal-plan.service';

function toStatus(err: unknown): number {
  if (typeof err === 'object' && err !== null && 'statusCode' in err) {
    const code = Number((err as { statusCode: unknown }).statusCode);
    if (Number.isInteger(code) && code >= 400 && code < 600) return code;
  }
  return 500;
}

export async function getWeeklyMealPlanHandler(req: Request, res: Response): Promise<void> {
  // Accept ?tags=Chicken,Beef,Freezable and ?tags=Chicken&tags=Beef interchangeably.
  // 1-3 protein tags required; any number of additional (non-protein) tags filter the picks.
  const tags = normalizeTags(req.query.tags ?? req.query.tag);

  if (tags.length === 0) {
    res.status(400).json({
      error: 'Provide 1 to 3 protein tags, e.g. GET /api/meal-plan/weekly?tags=Chicken,Beef',
    });
    return;
  }

  try {
    const { recipes, ingredients, proteins, additionalTags, unfilteredProteins } =
      await getWeeklyMealPlan(tags);
    res.json({
      tags,
      proteins,
      additionalTags,
      unfilteredProteins,
      count: recipes.length,
      recipes,
      ingredients,
    });
  } catch (err) {
    res.status(toStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function saveWeeklyMealPlanHandler(req: Request, res: Response): Promise<void> {
  // Accept { recipeIds: [...] } (also recipe_ids), defaulting to the current ISO week.
  // Optional overrides: { year, weekNumber } (also week_number / week).
  const body = (req.body ?? {}) as Record<string, unknown>;
  const recipeIds = body.recipeIds ?? body.recipe_ids ?? body.recipes;
  const weekNumber = body.weekNumber ?? body.week_number ?? body.week;
  try {
    const { year, weekNumber: week, plans } = await saveWeeklyMealPlan(recipeIds, {
      year: body.year,
      weekNumber,
    });
    res.status(201).json({ year, weekNumber: week, count: plans.length, plans });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.startsWith('Provide at least one') || message.startsWith('Invalid') || message.startsWith('Unknown')
      ? 400
      : 500;
    res.status(status).json({ error: message });
  }
}
