// Lookup data for the recipe editor UI (ingredients / tags / units).
import { Router, type Request, type Response } from 'express';
import { listLookups } from '../recipes/recipes.service';

const lookupsRouter = Router();

// GET /api/lookups -> { ingredients, tags, units }
lookupsRouter.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json(await listLookups());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default lookupsRouter;
