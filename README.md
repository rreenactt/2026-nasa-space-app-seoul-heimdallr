# HEIMDALLR

**Live site: <https://2026-nasa-space-app-seoul-heimdallr.vercel.app/>**

A public web tool for seeing how the sky changes in NASA's SPHEREx survey. Explore the whole sky, click any point (or type its RA/Dec), and watch the SPHEREx images of that patch play as a blink animation, the way Clyde Tombaugh found Pluto. Our team analyzes the survey and updates a list of candidates regularly; anyone can check them.

Built by team HEIMDALLR for the [NASA International Space Apps Challenge](https://www.spaceappschallenge.org/) 2026 (Seoul), challenge **Planet X and SPHEREx**.

<!-- TODO: add screenshots or GIFs (sky view, blink panel) once the UI is frozen. -->

## How to use

1. **Explore the sky.** After a short intro (skip it with "Skip intro"), the sky fills the screen. Drag to pan and scroll to zoom; the RA/Dec under the cursor is shown. Click the wide view to fly there. The tools on the right edge open "This view" (the center, field of view, what is in view and the background imagery, with buttons to copy a link or the coordinates) and "Show on sky" (test-target pins, constellation lines, coordinate grid, candidates), zoom in and out, go back to the first view and switch to full screen.
2. **Find a place to analyze.** Open the **Review queue** (top left, or press `Q`) for the five challenge test targets and, once the pre-analysis has run, movement candidates. Use **Search** (top right, or `/`) for a test target name or coordinates (`269.4485 4.7394` or `17 57 48.5 +04 41 36`).
3. **Pick a point.** Zoomed in, the cursor becomes a square the size of the analysis cutout. Click it (or press `Enter` for the center of the view) to open the analysis panel.
4. **Watch it change.** The panel plays the SPHEREx DR1 images of that point, one per visit (about six months apart), with difference and stack views. Gaia DR3 stars moved to each visit's date are drawn on top, quality flags are listed, and every frame links to its IRSA original.
5. **Rate it.** Say whether something is Moving, Not moving, or Noise or artifact. Other people's ratings stay hidden until you rate.
6. **Go further.** Five additional analyses run from the same panel. Press **Run** on one; when its data is ready it opens as a tab beside the SPHEREx images, with the summary and rating still in view: Sky Time Machine (25 years with 2MASS, WISE and NEOWISE), Fake Planet Lab (is the moving dot a defect?), Neighborhood in Motion (nearby stars in 3D), Sky Sonata (the sky as sound) and Comet Breath (spectra of interstellar comet 3I/ATLAS).

**About** and **Method** (tabs at the top) explain SPHEREx, Planet X and how the comparison works in plain language. The **Menu** (top right) has the keyboard shortcuts (or press `?`), how to rate, the test targets, data sources and credits, and a button to clear the places you opened.

**Share** (top right) copies a link to what you are looking at: `/?view=ra,dec,fov` opens that view of the sky, and `/?ra=&dec=&fov=` opens the analysis panel for a point.

## Doing it honestly

- Results are always **candidates**, never discoveries.
- Images are compared only from the **same detector at matching wavelengths**, because SPHEREx's linear variable filters change wavelength across every image.
- All frames sit on a **fixed sky grid** around the chosen point, so real motion is never centered away.
- **Missing data is shown as missing.** One SPHEREx visit means "additional analysis needed"; no visits means "no observations".
- Original FITS files are never stored. Only small cutouts are read from the archive when needed.

## Known limitations

- SPHEREx visits each point about twice a year, so most stars move far less than one 6.2″ pixel between visits. The blink is a place to look, not a verdict; the 25-year comparison helps for slow movers.
- A very distant solar system object shifts by several arcminutes between visits because of Earth's motion, more than the 3′ cutout, so it would appear in one visit and be absent in the next.
- While the CDS service is down (since 2026-11-09), the all-sky background is 2MASS instead of the SPHEREx color map. Analysis always uses IRSA SPHEREx DR1 data.
- The analysis depends on NASA/IPAC IRSA. When IRSA is slow or returns errors, panels load slowly or fail with a message.
- Built for desktop browsers. The analysis panel also fits narrow windows by stacking the images above the summary.

## Data

- **NASA:** SPHEREx Data Release 1 from the NASA/IPAC Infrared Science Archive (IRSA) and its AWS Open Data copy; 2MASS, WISE and NEOWISE images from IRSA.
- **ESA:** Gaia Data Release 3, from the ESA Gaia Archive (IRSA's copy as a fallback).
- **CDS:** SPHEREx color HiPS for the all-sky background, displayed with Aladin Lite.

Full acknowledgments and references: [`docs/submission/references.md`](docs/submission/references.md).

## AI-assisted code

Most of the code and the internal documents were written with Claude Code (Anthropic), always on a team member's instruction and reviewed by the team. Decisions were made by people. Every AI-assisted task is logged in [`docs/memory/ai-usage.md`](docs/memory/ai-usage.md). No AI-generated images, video, audio or data are shown as observations.

## Project documents

The plan, the team's shared context for AI tools, and the decision log live in [`docs/`](docs/) (in Korean):

- [`docs/PLAN.md`](docs/PLAN.md): features, UX, data handling, and architecture
- [`docs/memory/`](docs/memory/): direction, milestones, glossary, team status, and the AI usage log
- [`docs/decisions.md`](docs/decisions.md): decisions and the reasons behind them
- [`docs/analyses/`](docs/analyses/): the additional analysis modules
- [`docs/submission/`](docs/submission/): drafts of the challenge submission

## Tech stack

| Area | Stack |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript 6 |
| Sky view | Aladin Lite 3.8.2 (CDS) |
| 3D and charts | three.js, React Three Fiber, Recharts |
| Styling / UI | Tailwind CSS 4, shadcn/ui (`base-vega`, Base UI), lucide-react, Pretendard |
| Data fetching | ky (HTTP client), TanStack Query |
| Database | Prisma 7, PostgreSQL (Neon in production) |
| Validation | zod |
| Hosting | Vercel |

## Getting started

### Requirements

- Node.js 24 (pinned in `.nvmrc` and `engines`)
- pnpm 12 (pinned via the `packageManager` field). Install it with `npm install -g pnpm@12.16.0` or as described in the [pnpm installation guide](https://pnpm.io/installation).

This project uses **pnpm only**. `npm install` fails on the `node_modules` that pnpm creates, so never mix the two.

### Run locally

1. Run `pnpm install`.
2. Copy `.env.example` to `.env` and fill in the values (see "Environment variables"). For a local database, run `pnpm docker:db` and use the local connection strings given in `.env.example`, then run `pnpm db:migrate`.
3. Run `pnpm dev`. The app is at http://localhost:3000 and the UI component showcase at http://localhost:3000/design-system (development server only, unless `NEXT_PUBLIC_DESIGN_SYSTEM=1`).

`pnpm build` currently needs `DATABASE_URL` to be set, because the ratings routes connect to the database when the build collects them.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_APP_NAME` | App name in page titles and the UI. Defaults to `Web App`. Read at build time, so rebuild after changing it. |
| `NEXT_PUBLIC_DESIGN_SYSTEM` | `1` opens the `/design-system` showcase in a production build. Left empty, it answers 404 everywhere except the development server. Read at build time. |
| `DATABASE_URL` | Database connection for the app (ratings). On Neon, the pooled connection string. |
| `DIRECT_URL` | Database connection for the Prisma CLI (migrations). On Neon, the direct connection string. |
| `DATABASE_POOL_MAX` | Connections each app instance may open (default 3). |

Application code never reads `process.env` directly; it goes through the modules below. Invalid values surface as zod errors when the module loads. `NODE_ENV` (set and inlined by Next.js) is the exception.

- `config/env.ts` — public variables (`NEXT_PUBLIC_*`)
- `config/env.server.ts` — server-only variables. Anything that must not reach the client bundle belongs here.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm build` / `pnpm start` | Production build / start |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Generates the Next.js route types (`next typegen`), then runs `tsc --noEmit` |
| `pnpm docker:db` / `pnpm docker:down` | Start / stop the local PostgreSQL |
| `pnpm db:migrate` | Apply schema changes to the development database |
| `pnpm db:generate` | Regenerate the Prisma Client (also runs on install) |

## Deployment

Every push to `main` deploys to Vercel production through GitHub Actions (`.github/workflows/vercel-production.yml`): it runs `pnpm lint` and `pnpm typecheck`, builds with `vercel build` on the runner, and uploads the result with `vercel deploy --prebuilt`. It can also be started by hand from the Actions tab.

Set these repository secrets (Settings > Secrets and variables > Actions):

| Secret | Where to find it |
| --- | --- |
| `VERCEL_TOKEN` | Vercel account settings > Tokens |
| `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | `.vercel/project.json` after running `vercel link` in the project (`orgId`, `projectId`) |

Set the app's environment variables in the Vercel project for the Production environment; the workflow pulls them before it builds.

## Project structure

The folder layout, and what belongs in each folder, is in [AGENTS.md](AGENTS.md#structure). `AGENTS.md` and `CLAUDE.md` also hold the instructions for coding agents (the Next.js block is managed by `next dev`).

## License

[MIT](LICENSE)
