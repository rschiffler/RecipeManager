// Routes for the recipes domain. Mounted at /api/recipes (see index.ts).
import { Router } from 'express';
import {
  createRecipeHandler,
  deleteRecipeHandler,
  getRecipeHandler,
  listRecipesHandler,
  updateRecipeHandler,
} from './recipes.controller';

const recipesRouter = Router();

// GET /api/recipes?search=&tag=&limit=&offset=
recipesRouter.get('/', listRecipesHandler);
// GET /api/recipes/:id
recipesRouter.get('/:id', getRecipeHandler);
// POST /api/recipes
recipesRouter.post('/', createRecipeHandler);
// PUT /api/recipes/:id
recipesRouter.put('/:id', updateRecipeHandler);
// DELETE /api/recipes/:id
recipesRouter.delete('/:id', deleteRecipeHandler);

export default recipesRouter;
