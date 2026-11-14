# Heimdallr — NASA Space Apps Challenge 2026

Our team's project for the [NASA International Space Apps Challenge](https://www.spaceappschallenge.org/) 2026 (Seoul), a web application built on the Next.js App Router.

## Project plan

The plan, the team's shared context for AI tools, and the decision log live in [`docs/`](docs/) (in Korean):

- [`docs/PLAN.md`](docs/PLAN.md): features, UX, data handling, and architecture
- [`docs/memory/`](docs/memory/): direction, milestones, glossary, team status, and the AI usage log
- [`docs/decisions.md`](docs/decisions.md): decisions and the reasons behind them
- [`docs/analyses/`](docs/analyses/): the additional analysis modules

## Tech stack

| Area | Stack |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript 6 |
| Styling / UI | Tailwind CSS 4, shadcn/ui (`base-vega`, Base UI), `cn`, lucide-react, Pretendard |
| Data fetching | ky (HTTP client), TanStack Query |
| Validation | zod (environment variables) |
| Linting | ESLint 10 (`eslint-config-next`) |

## Getting started

### Requirements

- Node.js 24 (pinned in `.nvmrc` and `engines`)
- pnpm 12 (pinned via the `packageManager` field). Install it with `npm install -g pnpm@12.16.0` or as described in the [pnpm installation guide](https://pnpm.io/installation).

This project uses **pnpm only**. `npm install` fails on the `node_modules` that pnpm creates, so never mix the two.

### Run locally

1. Run `pnpm install`.
2. Copy `.env.example` to `.env`. It runs as is; fill in the values you use (see "Environment variables").
3. Run `pnpm dev`. The app is at http://localhost:3000 and the UI component showcase at http://localhost:3000/design-system (development server only, unless `NEXT_PUBLIC_DESIGN_SYSTEM=1`).

### Project setup

1. Set `NEXT_PUBLIC_APP_NAME` in `.env`, and update the description in `app/layout.tsx`.
2. Replace `app/page.tsx` with the app's landing page, and `app/icon.svg` with the app icon.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_APP_NAME` | App name in page titles and the UI. Defaults to `Web App`. Read at build time, so rebuild after changing it. |
| `NEXT_PUBLIC_DESIGN_SYSTEM` | `1` opens the `/design-system` showcase in a production build. Left empty, it answers 404 everywhere except the development server. Read at build time. |

Application code never reads `process.env` directly; it goes through the modules below. Invalid values surface as zod errors when the module loads. `NODE_ENV` (set and inlined by Next.js) is the exception.

- `config/env.ts` — public variables (`NEXT_PUBLIC_*`)
- `config/env.server.ts` — server-only variables, such as API keys. Anything that must not reach the client bundle belongs here.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm build` / `pnpm start` | Production build / start |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Generates the Next.js route types (`next typegen`), then runs `tsc --noEmit` |

## Deployment

Every push to `main` deploys to Vercel production through GitHub Actions (`.github/workflows/vercel-production.yml`): it runs `pnpm lint` and `pnpm typecheck`, builds with `vercel build` on the runner, and uploads the result with `vercel deploy --prebuilt`. It can also be started by hand from the Actions tab.

Set these repository secrets (Settings > Secrets and variables > Actions):

| Secret | Where to find it |
| --- | --- |
| `VERCEL_TOKEN` | Vercel account settings > Tokens |
| `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | `.vercel/project.json` after running `vercel link` in the project (`orgId`, `projectId`) |

Set the app's environment variables (such as `NEXT_PUBLIC_APP_NAME`) in the Vercel project for the Production environment; the workflow pulls them before it builds.

## Project structure

The folder layout, and what belongs in each folder, is in [AGENTS.md](AGENTS.md#structure). `AGENTS.md` and `CLAUDE.md` also hold the instructions for coding agents (the Next.js block is managed by `next dev`).
