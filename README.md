# Recipe Manager

TypeScript + Express.js API with Knex + Objection.js on Postgres.

## Prerequisites

- [NVM for Windows](https://github.com/coreybutler/nvm-windows) (manages Node versions)
- Node `26.9.0` (see `.nvmrc`)

## Setup

1. Install and use the pinned Node version via nvm:

   ```powershell
   nvm install 26.9.0
   nvm use 26.9.0
   ```

   Verify:

   ```powershell
   node --version  # v26.9.0
   npm --version
   ```

2. Install node modules:

   ```powershell
   npm install
   ```

## Run

```powershell
npm run dev     # tsx watch mode (no build step)
npm run build   # tsc -> dist/
npm start       # node dist/index.js (run build first)
```

Server listens on http://localhost:3000 (override with `PORT` env var).

- `GET /` → `{ "message": "Recipe Manager API is running" }`
- `GET /db-health` → DB connectivity + recipe count
- `GET /api/meal-plan/weekly?tags=Chicken,Beef` → weekly meal plan (one recipe per protein tag; additional tags filter the picks)
- `GET /api/tags` → all tags with their types; `POST /api/tags { name, tagTypeId }` → create a tag; `PUT /api/tags/:id` → rename / retype a tag

## Database

Local Postgres via Podman (`compose.yaml`):

```powershell
podman machine start podman-machine-default  # if the VM is stopped
podman compose up -d
```

Knex commands run against the TypeScript config (loaded via `tsx`):

```powershell
npm run knex -- migrate:status
npm run knex -- migrate:make my-migration
npm run db:health
```
