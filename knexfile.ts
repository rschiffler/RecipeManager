// Knex configuration wired to the local Postgres defined in compose.yaml.
// Uses DATABASE_URL when set, otherwise falls back to POSTGRES_* vars
// (same defaults as compose.yaml: recipe / recipe_dev_password / recipes / 5432).
import 'dotenv/config';
import type { Knex } from 'knex';
import { knexSnakeCaseMappers } from 'objection';

function buildConnection(): string | Knex.PgConnectionConfig {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  return {
    user: process.env.POSTGRES_USER || 'recipe',
    password: process.env.POSTGRES_PASSWORD || 'recipe_dev_password',
    database: process.env.POSTGRES_DB || 'recipes',
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT || 5432),
  };
}

const base: Knex.Config = {
  client: 'pg',
  connection: buildConnection(),
  // Maps camelCase query identifiers (e.g. orderBy('createdAt')) to snake_case
  // columns. Pairs with BaseModel.columnNameMappers, which maps row data.
  ...knexSnakeCaseMappers(),
  pool: { min: 2, max: 10 },
  migrations: {
    directory: './db/migrations',
    extension: 'ts',
  },
  seeds: {
    directory: './db/seeds',
  },
};

const config: Record<string, Knex.Config> = {
  development: base,
  test: {
    ...base,
    connection:
      process.env.TEST_DATABASE_URL ||
      process.env.DATABASE_URL ||
      (typeof base.connection === 'string'
        ? base.connection
        : { ...base.connection, database: process.env.TEST_POSTGRES_DB || 'recipes_test' }),
    pool: { min: 1, max: 5 },
  },
  production: {
    ...base,
    pool: { min: 2, max: 20 },
  },
};

// Default export: the knex CLI unwraps `.default` (see knex/bin/cli.js),
// and `import config from '../../knexfile'` works via esModuleInterop.
export default config;
