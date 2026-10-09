// Routes for the meal-plan domain.
// Mounted at /api/meal-plan (see index.ts).
import { Router } from 'express';
import { getWeeklyMealPlanHandler, saveWeeklyMealPlanHandler } from './meal-plan.controller';

const mealPlanRouter = Router();

// GET /api/meal-plan/weekly?tags=Chicken,Beef
mealPlanRouter.get('/weekly', getWeeklyMealPlanHandler);
// Alias matching the endpoint name: GET /api/meal-plan/getWeeklyMealPlan?tags=...
mealPlanRouter.get('/getWeeklyMealPlan', getWeeklyMealPlanHandler);

// POST /api/meal-plan/weekly { recipeIds: [1, 2, 3] } — save the selected plan
// for the current ISO week (override with { year, weekNumber }).
mealPlanRouter.post('/weekly', saveWeeklyMealPlanHandler);
// Alias matching the endpoint name.
mealPlanRouter.post('/saveWeeklyMealPlan', saveWeeklyMealPlanHandler);

export default mealPlanRouter;
