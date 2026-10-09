import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import path from 'node:path';
import { db } from './src/db/database';
// Load models so they are registered with Objection (also validates wiring).
import './src/models/Recipe';
import './src/models/Ingredient';
import './src/models/MeasurementUnit';
import './src/models/Tag';
import './src/models/TagType';
import mealPlanRouter from './src/domains/meal-plan/meal-plan.routes';
import recipesRouter from './src/domains/recipes/recipes.routes';
import lookupsRouter from './src/domains/lookups/lookups.routes';
import tagsRouter from './src/domains/tags/tags.routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'Recipe Manager API is running' });
});

app.get('/db-health', async (_req: Request, res: Response): Promise<void> => {
  try {
    const raw = await db.raw('select now() as now, current_database() as database');
    const [{ now, database }] = raw.rows as { now: string; database: string }[];
    const countRows = (await db('recipes').count('* as count')) as { count: string | number }[];
    const [{ count: recipeCount }] = countRows.map((row) => ({ count: Number(row.count) }));
    res.json({ ok: true, now, database, recipeCount });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.use('/api/meal-plan', mealPlanRouter);
app.use('/api/recipes', recipesRouter);
app.use('/api/lookups', lookupsRouter);
app.use('/api/tags', tagsRouter);

// React UI (Astryx design system) built with Vite into src/ui/dist, served at /ui.
// Run `npm run ui:build` (or `npm run dev` in src/ui for HMR with /api proxied).
const uiDistDir = path.join(process.cwd(), 'src', 'ui', 'dist');
app.use('/ui', express.static(uiDistDir));
app.get('/ui/', (_req: Request, res: Response) => {
  res.sendFile(path.join(uiDistDir, 'index.html'), (err) => {
    if (err) {
      res.status(404).json({
        error: 'UI not built yet. Run "npm run ui:build" or "npm run dev" in src/ui.',
      });
    }
  });
});

if (require.main === module) {
  // Verify DB connectivity on boot, but don't crash if the container is down.
  db.raw('select 1+1 as result')
    .then(() => console.log('Database connection OK (knex + objection)'))
    .catch((err: unknown) =>
      console.warn(`[warn] database unreachable: ${err instanceof Error ? err.message : String(err)}`)
    );

  const server = app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
    console.log(`UI available at http://localhost:${PORT}/ui`);
  });

  const shutdown = async (): Promise<void> => {
    await db.destroy();
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export default app;
