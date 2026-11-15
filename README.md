<div align="center">

# HEIMDALLR

**Watch how the sky changes in NASA's SPHEREx survey, and help check what moves.**

[![Live site](https://img.shields.io/badge/Live_site-open-111111?style=for-the-badge)](https://2026-nasa-space-app-seoul-heimdallr.vercel.app/)
[![NASA Space Apps 2026](https://img.shields.io/badge/NASA_Space_Apps-2026_Seoul-0B3D91?style=for-the-badge)](https://www.spaceappschallenge.org/)
[![Challenge](https://img.shields.io/badge/Challenge-Planet_X_and_SPHEREx-FC3D21?style=for-the-badge)](https://www.spaceappschallenge.org/)

![Next.js 16](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs)
![React 19](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![Data: SPHEREx DR1](https://img.shields.io/badge/Data-SPHEREx_DR1-4B5563)
[![License: MIT](https://img.shields.io/badge/License-MIT-6B7280)](LICENSE)

</div>

### Overview (30 s)

https://github.com/user-attachments/assets/c49f52a2-24e4-4d8c-8571-d3116e4a3b55

<sub>Screen recording of the live tool with captions. Full-quality file: <a href="video/heimdallr-A-infographic.narrated.v5.20mb.mp4"><code>video/heimdallr-A-infographic.narrated.v5.20mb.mp4</code></a></sub>

<table>
  <tr>
    <td align="center"><b>75,756</b><br><sub>sky fields surveyed</sub></td>
    <td align="center"><b>262</b><br><sub>known moving stars recovered</sub></td>
    <td align="center"><b>41</b><br><sub>unidentified candidates to check</sub></td>
    <td align="center"><b>5 + 1</b><br><sub>analyses: blink plus five more</sub></td>
  </tr>
</table>

| | |
| --- | --- |
| **Event** | [NASA International Space Apps Challenge](https://www.spaceappschallenge.org/) 2026, Seoul |
| **Challenge** | Planet X and SPHEREx |
| **Team HEIMDALLR** | 김재현 ([`rreenactt`](https://github.com/rreenactt)) · 허한결 ([`AnsirH`](https://github.com/AnsirH)) · 이순형 ([`tnsgud9`](https://github.com/tnsgud9)) |

## What is this?

Since 2025, NASA's SPHEREx mission has imaged the whole sky every six months in 102 near-infrared colors. Things that move or change — nearby stars, brown dwarfs, comets, maybe even an unknown planet — show up as differences between those images. There is far too much sky for one person to look at, so the challenge asked for a public web tool that lets anyone see how the sky changes over time.

HEIMDALLR is that tool. You explore the whole sky in the browser, click any point, and the SPHEREx images of that patch play one after another as a **blink animation**, the method Clyde Tombaugh used to find Pluto in 1930. Our own survey points to places worth a look; people look and rate them.

> **Machines suggest where to look; people check.** Everything the tool flags is a *candidate*, never a discovery.

## What you can do

1. **Explore the sky.** A full-screen sky (Aladin Lite) from 120° down to a few arcminutes, with a coordinate grid, constellation lines and the RA/Dec under the cursor. A Star guide marks fast-moving Gaia stars with their paths, so you can see what real motion looks like.
2. **Pick a place.** Open the **Review queue** (`Q`) for the five challenge test targets and our survey's movement candidates, or **Search** (`/`) for a name or coordinates (`269.4485 4.7394`, `17 57 48.5 +04 41 36`).
3. **Watch it change.** The analysis panel plays the SPHEREx DR1 images of that point, one per visit, with difference and stack views. Gaia DR3 stars moved to each visit's date are drawn on top, quality flags are listed, and every frame links to its original in NASA's archive.
4. **Rate it.** Moving, Not moving, or Noise or artifact. Other people's ratings stay hidden until you rate, and pooled ratings decide which candidates stay in the queue.
5. **Go further** with five additional analyses that open in the same panel:

| Analysis | What it shows |
| --- | --- |
| **Sky Time Machine** | The same patch in 2MASS (~2000), WISE (2010), NEOWISE (2014–2024) and SPHEREx (2025): a 25-year baseline for slow movers |
| **Fake Planet Lab** | Whether a "moving dot" is really a defect: quality flags, signal-to-noise, shape, repeats, nearby bright stars, and brightness between visits |
| **Neighborhood in Motion** | The 21 nearest stars and brown dwarfs in 3D, moved through time with a straight-line model from Gaia DR3 |
| **Sky Sonata** | A SPHEREx image turned into sound by fixed rules, comparing two visits source by source |
| **Comet Breath** | Interstellar comet 3I/ATLAS before and after perihelion: SPHEREx images and spectra, with gas production rates quoted from the literature |

**About** and **Method** explain SPHEREx, Planet X and every rule in plain words (English and Korean). **Share** copies a link to exactly what you are looking at.

## Where the candidates come from

Between two SPHEREx visits (about six months), even the fastest star moves only a little: in an early test of our own tool, positions scattered by about 9″ between visits (our tool's result, not SPHEREx's official precision), more than Barnard's Star moves in a year. So we compare SPHEREx (2025–26) with **2MASS (about 2000)**, a 25-year baseline:

- A bright SPHEREx source with nothing at its position in 2MASS is paired with a 2MASS source that has nothing at its position in SPHEREx now.
- Both ends are checked against **Gaia DR3** moved to each date: one Gaia star explaining both ends is a *known moving star*; a Gaia star at only one end is a *chance pair*; nothing explaining it leaves an *unidentified candidate* for people to check.
- **First run:** 75,756 random fields on GitHub Actions → 262 known moving stars (speeds within a median 4.3% of Gaia), 5,081 chance pairs and **41 unidentified candidates**. Known movers stay in the queue as the answer key.

## Doing it honestly

- Results are **candidates**, never discoveries — including Planet X.
- Images are compared only from the **same detector at matching wavelengths**, because SPHEREx's filters change wavelength across every image.
- All frames sit on a **fixed sky grid** around the chosen point, so real motion is never centered away; all visits share one display stretch.
- **Missing data is shown as missing.** One SPHEREx visit means "additional analysis needed"; none means "no observations".
- Values are labelled for what they are: measured by the tool, taken from a catalog (Gaia DR3), quoted from a paper, or produced by a model.
- Original FITS files are never stored; only small cutouts are read from the archive, and every view links back to it.

## Known limitations

- SPHEREx DR1 spans about a year, so a place has only a few visits and most stars move far less than one 6.2″ pixel between them. The blink is a place to look, not a verdict.
- The survey sampled 75,756 random fields, not the whole sky, and missed some very fast or very bright stars in its control sample.
- A very distant solar system object jumps several arcminutes between visits (Earth's motion), more than the 3′ cutout, so it would appear in one visit and vanish in the next. This tool has not searched for a planet beyond Neptune in a way that could rule one out.
- Analysis depends on NASA/IPAC IRSA. Places we precomputed (test targets and survey candidates) open from stored results; elsewhere, an IRSA outage makes panels slow or fail with a message.
- While the CDS service is down, the all-sky background is 2MASS instead of the SPHEREx color map. Analysis always uses SPHEREx DR1.
- Built for desktop browsers.

## Data and references

- **NASA:** SPHEREx Data Release 1 (DOI [10.26131/IRSA678](https://doi.org/10.26131/IRSA678)) from the NASA/IPAC Infrared Science Archive and its AWS Open Data copy; 2MASS, WISE and NEOWISE from IRSA; JPL Horizons.
- **ESA:** Gaia Data Release 3, from the ESA Gaia Archive (IRSA's copy as a fallback).
- **CDS:** Aladin Lite and the SPHEREx color HiPS for the sky background.

Full acknowledgments, papers and software licenses: [`docs/submission/references.md`](docs/submission/references.md). This project is not affiliated with or endorsed by NASA.

## AI-assisted work

Most of the code and the internal documents were written with Claude Code (Anthropic), always on a team member's instruction and reviewed by the team; decisions were made by people. Every AI-assisted task is logged in [`docs/memory/ai-usage.md`](docs/memory/ai-usage.md). No AI-generated images, video, audio or data are shown as observations.

## Project documents

The plan, decision log and team notes live in [`docs/`](docs/) (in Korean):

- [`docs/PLAN.md`](docs/PLAN.md): features, UX, data handling and architecture
- [`docs/decisions.md`](docs/decisions.md): decisions and the reasons behind them
- [`docs/analyses/`](docs/analyses/): the additional analyses and how each was checked
- [`docs/submission/`](docs/submission/): the challenge submission texts (English)
- [`docs/memory/`](docs/memory/): direction, milestones, glossary, team status and the AI usage log

---

## For developers

### Tech stack

| Area | Stack |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript 6 |
| Sky view | Aladin Lite 3.8.2 (CDS) |
| 3D and charts | three.js, React Three Fiber, Recharts |
| Styling / UI | Tailwind CSS 4, shadcn/ui (`base-vega`, Base UI), lucide-react, Pretendard |
| Data fetching | ky (HTTP client), TanStack Query |
| Database | Prisma 7, PostgreSQL (Neon in production): ratings and survey results |
| Object storage | Cloudflare R2: precomputed analysis responses |
| Survey | `scripts/motion-survey.ts` on GitHub Actions (`.github/workflows/motion-survey.yml`) |
| Validation | zod |
| Hosting | Vercel |

### Requirements

- Node.js 24 (pinned in `.nvmrc` and `engines`)
- pnpm 12 (pinned via the `packageManager` field). Install it with `npm install -g pnpm@12.16.0` or as described in the [pnpm installation guide](https://pnpm.io/installation).

This project uses **pnpm only**. `npm install` fails on the `node_modules` that pnpm creates, so never mix the two.

### Run locally

1. Run `pnpm install`.
2. Copy `.env.example` to `.env` and fill in the values (see below). For a local database, run `pnpm docker:db`, use the local connection strings given in `.env.example`, then run `pnpm db:migrate`.
3. Run `pnpm dev`. The app is at http://localhost:3000 and the UI component showcase at http://localhost:3000/design-system (development server only, unless `NEXT_PUBLIC_DESIGN_SYSTEM=1`).

`pnpm build` currently needs `DATABASE_URL` to be set, because the ratings routes connect to the database when the build collects them.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_APP_NAME` | App name in page titles and the UI. Defaults to `Web App`. Read at build time. |
| `NEXT_PUBLIC_DESIGN_SYSTEM` | `1` opens the `/design-system` showcase in a production build. Read at build time. |
| `DATABASE_URL` | Database connection for the app (ratings, survey results). On Neon, the pooled connection string. |
| `DIRECT_URL` | Database connection for the Prisma CLI (migrations). On Neon, the direct connection string. |
| `DATABASE_POOL_MAX` | Connections each app instance may open (default 3). |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Cloudflare R2 bucket. With all four set, the analysis routes answer from stored results when they have one. |
| `R2_PUBLIC_URL` | Optional public URL of the bucket. |
| `RESPONSE_CACHE_WRITE` | `1` lets a local server store the analysis responses it computes in R2 (precompute runs only; never in production). |

Application code never reads `process.env` directly; it goes through `config/env.ts` (public `NEXT_PUBLIC_*` variables) and `config/env.server.ts` (server-only). Invalid values surface as zod errors when the module loads.

### Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm build` / `pnpm start` | Production build / start |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Generates the Next.js route types (`next typegen`), then runs `tsc --noEmit` |
| `pnpm i18n` | Regenerates the interface text from `app/_i18n/messages.csv` |
| `pnpm docker:db` / `pnpm docker:down` | Start / stop the local PostgreSQL |
| `pnpm db:migrate` | Apply schema changes to the development database |
| `pnpm db:generate` | Regenerate the Prisma Client (also runs on install) |

Pipelines (run with `tsx`; usage in each file's header):

- `scripts/motion-survey.ts` — the SPHEREx × 2MASS movement survey (`survey`, `reclassify`, `import`, `targets`).
- `scripts/precompute-analyses.ts` — replays the analysis panel's requests for the test targets and survey candidates against a local server with `RESPONSE_CACHE_WRITE=1`, filling R2.

### Deployment

Every push to `main` deploys to Vercel production through GitHub Actions (`.github/workflows/vercel-production.yml`): it runs `pnpm lint` and `pnpm typecheck`, builds with `vercel build` on the runner, and uploads the result with `vercel deploy --prebuilt`. It can also be started by hand from the Actions tab.

Repository secrets (Settings > Secrets and variables > Actions):

| Secret | Where to find it |
| --- | --- |
| `VERCEL_TOKEN` | Vercel account settings > Tokens |
| `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | `.vercel/project.json` after running `vercel link` (`orgId`, `projectId`) |
| `DATABASE_URL` | Only for the Motion Survey workflow's import job |

Set the app's environment variables in the Vercel project for the Production environment; the workflow pulls them before it builds, so redeploy after changing them.

### Project structure

The folder layout, and what belongs in each folder, is in [AGENTS.md](AGENTS.md#structure). `AGENTS.md` and `CLAUDE.md` also hold the instructions for coding agents.

## License

[MIT](LICENSE)
