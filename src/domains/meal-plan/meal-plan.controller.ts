// HTTP handlers for /api/meal-plan/weekly: generate (GET) and save (POST) a plan.
import type { Request, Response } from 'express';
import {
  getWeeklyMealPlan,
  normalizeCount,
  normalizeTags,
  saveWeeklyMealPlan,
} from './meal-plan.service';

export async function getWeeklyMealPlanHandler(req: Request, res: Response): Promise<void> {
  // Accept ?tags=Chicken,Beef and ?tags=Chicken&tags=Beef interchangeably.
  const tags = normalizeTags(req.query.tags ?? req.query.tag);
  // Number of recipes to return, default 3. Accepts ?count= or ?limit=.
  const count = normalizeCount(req.query.count ?? req.query.limit, 3);

  if (tags.length === 0) {
    res.status(400).json({
      error: 'Provide at least one tag, e.g. GET /api/meal-plan/weekly?tags=Chicken,Beef',
    });
    return;
  }

  try {
    const { recipes, ingredients } = await getWeeklyMealPlan(tags, count);
    res.json({ tags, count: recipes.length, recipes, ingredients });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
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
