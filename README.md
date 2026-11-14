# Web App

A web application built on the Next.js App Router, trimmed down for the 2026 NASA Space Apps hackathon. UI components, environment variable validation, data fetching, and the database (Prisma + PostgreSQL) are already wired up, so you can start writing feature code right away.

## Tech stack

| Area | Stack |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript 6 |
| Styling / UI | Tailwind CSS 4, shadcn/ui (`base-vega`, Base UI), `cn`, lucide-react, Pretendard |
| Data fetching | ky (HTTP client), TanStack Query |
| Database | Prisma ORM 7 (`@prisma/adapter-pg`), PostgreSQL |
| Validation | zod (environment variables and server input) |
| Testing | Vitest (unit, and `db` against a local test Postgres) |
| Linting | ESLint 10 (`eslint-config-next`) |

## Requirements

- Node.js 26 (pinned in `.nvmrc` and `engines`; CI uses the same file)
- pnpm 12 (pinned via the `packageManager` field). Install it as described in the [pnpm installation guide](https://pnpm.io/installation); any pnpm 12 switches to the pinned version inside the project.
- Docker with Compose, for the local development database (`pnpm docker:db`) and the test database (`pnpm test:db:up`)

## Getting started

1. Run `pnpm install`. Its postinstall step generates the Prisma Client.
2. Copy `.env.example` to `.env`. It runs as is, without a database; fill in the values you use (see "Environment variables").
3. Run `pnpm dev`. The app is at http://localhost:3000 and the UI component showcase at http://localhost:3000/design-system (development server only, unless `NEXT_PUBLIC_DESIGN_SYSTEM=1`).

## Environment variables

Copy `.env.example` to `.env`. The Prisma CLI loads only `.env` through `dotenv`, so keep the database variables in `.env`, not `.env.local`. Tests take no value from `.env`: they run with the committed `.env.test`, which sets every variable in `.env.example` (an empty one stays unset).

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_APP_NAME` | App name in page titles and the UI. Defaults to `Web App`. Read at build time, so rebuild after changing it. |
| `DATABASE_URL` | App runtime (Prisma Client). Leave it and `DIRECT_URL` empty to run without a database. |
| `DIRECT_URL` | Prisma CLI (migrate, etc.). A direct or session-mode connection. |
| `DATABASE_POOL_MAX` | Connections each app instance may open. Defaults to `3`. |
| `SERVICE_NAME`, `APP_ENV` | `service.name` and `deployment.environment.name` in every server log line. Default to `name` in `package.json`, and to `NODE_ENV`. |
| `NEXT_PUBLIC_DESIGN_SYSTEM` | `1` opens the `/design-system` showcase in a production build. Left empty, it answers 404 everywhere except the development server. Read at build time. |

Application code never reads `process.env` directly; it goes through the modules below. Invalid values surface as zod errors when the module loads. `NODE_ENV` (set and inlined by Next.js) is the exception.

- `config/env.ts` — public variables (`NEXT_PUBLIC_*`)
- `config/env.server.ts` — server-only variables. Anything that must not reach the client bundle belongs here.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm build` / `pnpm start` | Production build / start |
| `pnpm docker:db` / `pnpm docker:down` | Start / stop the local development database (`docker-compose.yaml`, port 5432) |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Generates the Next.js route types (`next typegen`), then runs `tsc --noEmit` |
| `pnpm test` / `pnpm test:vitest` | All Vitest tests (`*.vitest.test.ts`, `*.vitest.test.tsx`). Needs the test database (`pnpm test:db:up`) |
| `pnpm test:vitest:unit` | Vitest without the database |
| `pnpm test:db:up` / `pnpm test:db:down` | Start / stop the test database (`docker-compose.test.yaml`, port 5433). Its data lives in memory |
| `pnpm db:generate` | Generate the Prisma Client (also runs on `postinstall`) |
| `pnpm db:migrate` | Create and apply migrations on the development database (`prisma migrate dev`) |
| `pnpm db:deploy` | Apply migrations to the production database (`prisma migrate deploy`) |
| `pnpm db:status` | Show which migrations are applied or pending (`prisma migrate status`) |
| `pnpm db:studio` | Prisma Studio |

## Project structure

The folder layout, and what belongs in each folder, is in [AGENTS.md](AGENTS.md#structure).

## Deployment

1. Register `DATABASE_URL` (and `DIRECT_URL` where migrations run) on the host.
2. `postinstall` generates the Prisma Client during the build. Run migrations separately with `pnpm db:deploy`.

## AI agents

- `AGENTS.md` / `CLAUDE.md` — instructions for coding agents (the Next.js block is managed by `next dev`)
- `.agents/skills`, `.claude/skills` — skills for the Prisma CLI / Client API and Postgres best practices
