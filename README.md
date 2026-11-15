<div align="center">

# HEIMDALLR

**Watch how the sky changes in NASA's SPHEREx survey, and help check what moves.**

[![Live site](https://img.shields.io/badge/Live_site-open-111111?style=for-the-badge)](https://2026-nasa-space-app-seoul-heimdallr.vercel.app/)
[![NASA Space Apps 2026](https://img.shields.io/badge/NASA_Space_Apps-2026_Seoul-0B3D91?style=for-the-badge)](https://www.spaceappschallenge.org/)
[![Challenge](https://img.shields.io/badge/Challenge-Planet_X_and_SPHEREx-FC3D21?style=for-the-badge)](https://www.spaceappschallenge.org/)

![Next.js 16](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs)
![React 19](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![Prisma 7](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)
![Node 24](https://img.shields.io/badge/Node-24-5FA04E?logo=nodedotjs&logoColor=white)
![pnpm 12](https://img.shields.io/badge/pnpm-12-F69220?logo=pnpm&logoColor=white)
![Data: SPHEREx DR1](https://img.shields.io/badge/Data-SPHEREx_DR1-4B5563)
[![License: MIT](https://img.shields.io/badge/License-MIT-6B7280)](LICENSE)

[What it is](#what-is-this) · [Features](#what-you-can-do) · [How it works](#how-it-works) · [Quick start](#quick-start) · [Developer guide](#developer-guide) · [Data](#data-and-references)

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

HEIMDALLR is that tool. You explore the whole sky in the browser, click any point, and the SPHEREx images of that patch play one after another as a **blink animation**, the method Clyde Tombaugh used to find Pluto in 1930. Our team analyzes the survey and updates a list of candidates regularly; anyone can check and rate them.

> **Our team analyzes and updates the candidates; anyone can check them.** Everything the tool lists is a *candidate*, never a discovery.

## What you can do

```mermaid
flowchart LR
    A["Explore the sky<br/>Aladin Lite"] --> B["Pick a place<br/>Review queue · Search · click"]
    B --> C["Watch it change<br/>SPHEREx DR1 blink"]
    C --> D["Rate it<br/>Moving · Not moving · Noise"]
    C --> E["Go further<br/>5 additional analyses"]
    D -. pooled ratings .-> B
```

1. **Explore the sky.** A full-screen sky (Aladin Lite) from 120° down to a few arcminutes, with a coordinate grid, constellation lines and the RA/Dec under the cursor. A Star guide marks fast-moving Gaia stars with their paths, so you can see what real motion looks like.
2. **Pick a place.** Open the **Review queue** (`Q`) for the five challenge test targets and our survey's movement candidates, or **Search** (`/`) for a name or coordinates (`269.4485 4.7394`, `17 57 48.5 +04 41 36`).
3. **Watch it change.** The analysis panel plays the SPHEREx DR1 images of that point, one per visit, with difference and stack views. Gaia DR3 stars moved to each visit's date are drawn on top, quality flags are listed, and every frame links to its original in NASA's archive.
4. **Rate it.** Moving, Not moving, or Noise or artifact. Other people's ratings stay hidden until you rate, and pooled ratings decide which candidates stay in the queue.
5. **Go further** with five additional analyses that open in the same panel:

| Analysis | What it shows | Data |
| --- | --- | --- |
| **Sky Time Machine** | The same patch in 2MASS (~2000), WISE (2010), NEOWISE (2014–2024) and SPHEREx (2025): a 25-year baseline for slow movers | IRSA SIA2 / IBE, AWS `nasa-irsa-wise` |
| **Fake Planet Lab** | Whether a "moving dot" is really a defect: quality flags, signal-to-noise, shape, repeats, nearby bright stars, and brightness between visits | SPHEREx DR1 FLAGS / VARIANCE, Gaia DR3 |
| **Neighborhood in Motion** | The 21 nearest stars and brown dwarfs in 3D, moved through time with a straight-line model from Gaia DR3 | Gaia DR3 |
| **Sky Sonata** | A SPHEREx image turned into sound by fixed rules, comparing two visits source by source | SPHEREx DR1, Web Audio API |
| **Comet Breath** | Interstellar comet 3I/ATLAS before and after perihelion: SPHEREx images and spectra, with gas production rates quoted from the literature | IRSA 3I/ATLAS products, JPL Horizons |

**About** (`/about`) and **Method** (`/method`) explain SPHEREx, Planet X and every rule in plain words (English and Korean, switched in the menu). **Share** copies a link to exactly what you are looking at.

## Where the candidates come from

Between two SPHEREx visits (about six months), even the fastest star moves only a little: in an early test of our own tool, positions scattered by about 9″ between visits (our tool's result, not SPHEREx's official precision), more than Barnard's Star moves in a year. So we compare SPHEREx (2025–26) with **2MASS (about 2000)**, a 25-year baseline:

```mermaid
flowchart TD
    P["Random sky field"] --> S["SPHEREx DR1 sources<br/>≥ 5σ in every usable visit"]
    P --> T["2MASS point sources<br/>with their own epochs"]
    S --> X{"SPHEREx source with no 2MASS source in place<br/>× 2MASS source with no SPHEREx source in place"}
    T --> X
    X --> G{"Gaia DR3 moved<br/>to both epochs"}
    G -->|one star explains both ends| K["KNOWN_MOVER<br/>answer key"]
    G -->|a star at only one end| C["GAIA_STATIC<br/>chance pair"]
    G -->|nothing explains it| U["UNIDENTIFIED<br/>candidate for people to check"]
```

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

---

## How it works

### System architecture

There is no separate backend: **Next.js Route Handlers are the whole server.** FITS reading, RICE decompression, WCS math and photometry are all TypeScript. The server finds and cuts out the pixels; the browser reprojects, stacks and draws them.

```mermaid
flowchart LR
    subgraph SRC["External archives"]
        IRSA["NASA/IPAC IRSA<br/>SIA2 · IBE · TAP"]
        S3["AWS Open Data<br/>nasa-irsa-spherex · nasa-irsa-wise"]
        GAIA["ESA Gaia Archive<br/>Gaia DR3 · 2MASS copy"]
        JPL["JPL Horizons"]
        HIPS["HiPS sky tiles"]
    end
    subgraph VERCEL["Next.js on Vercel"]
        RSC["Server Components<br/>review queue batch"]
        API["Analysis Route Handlers<br/>app/api/*"]
        RAPI["Ratings · candidates API"]
    end
    subgraph STORE["Storage"]
        R2[("Cloudflare R2<br/>precomputed responses")]
        DB[("PostgreSQL · Neon<br/>ratings · survey results")]
    end
    subgraph BROWSER["Browser"]
        SKY["Sky view<br/>Aladin Lite"]
        PANEL["Analysis panel<br/>reproject · blink · analyses"]
    end
    PIPE["Motion survey<br/>GitHub Actions"]

    IRSA --> API
    S3 --> API
    GAIA --> API
    JPL --> API
    R2 -. read first when stored .-> API
    API --> PANEL
    PANEL <--> RAPI
    RAPI <--> DB
    DB --> RSC --> SKY
    HIPS --> SKY
    IRSA --> PIPE
    S3 --> PIPE
    GAIA --> PIPE
    PIPE --> DB
```

| Server (Route Handlers) | Browser (Client Components) |
| --- | --- |
| Finds the SPHEREx DR1 exposures covering a point (IRSA SIA2) | Reprojects each cutout onto a fixed sky grid |
| Groups visits, picks one detector and a reference wavelength | Median-stacks each visit, draws Blink / Difference / Stack |
| Range-reads only the needed pixels from the AWS copy and returns a small cutout | Runs the additional analyses (checks, source finding, 3D motion, sound) |
| Queries Gaia DR3, JPL Horizons and other catalogs | Keeps received data in memory only |

### Basic analysis: from a click to a blink

```mermaid
sequenceDiagram
    actor U as User
    participant B as Browser<br/>(blink-context.tsx)
    participant A as Next.js API
    participant C as R2 response cache
    participant I as IRSA SIA2
    participant S as AWS S3<br/>nasa-irsa-spherex
    participant G as Gaia DR3

    U->>B: Click a point / open from queue or search
    B->>A: GET /api/blink/plan?ra&dec
    A->>C: Stored answer for this input?
    alt hit
        C-->>A: gzip JSON
    else miss, or R2 slower than 8 s
        A->>I: Exposures covering the point (spherex_dr1)
        I-->>A: Exposure list
        A->>A: Group visits, choose detector,<br/>keep frames within wavelength tolerance
    end
    A-->>B: BlinkPlan (visits, exposures)
    par one request per exposure
        B->>A: GET /api/fpl/frame?obsId&detector&ra&dec
        A->>S: HTTP byte-range read
        S-->>A: IMAGE · FLAGS · VARIANCE · ZODI tiles
        A-->>B: Native-pixel cutout + WCS
    and Gaia overlay (does not block the images)
        B->>A: GET /api/fpl/neighbors?epoch=visit date
        A->>G: Bright stars, moved to the epoch
        A-->>B: Gaia positions
    end
    B->>B: Reproject to fixed grid → median per visit → one shared stretch
    B-->>U: Blink · Difference · Stack, flags, archive links
```

### Rating a place

```mermaid
sequenceDiagram
    actor U as User
    participant B as Browser
    participant R as /api/ratings
    participant D as PostgreSQL

    B->>R: GET /api/ratings?ra&dec
    R->>D: Rating for this HEALPix order-11 cell and voter
    R-->>B: My rating (tally hidden until I rate)
    U->>B: Moving / Not moving / Noise or artifact
    B->>R: PUT /api/ratings (same-origin only)
    R->>R: Check Origin, validate with a strict zod schema
    R->>D: Upsert (release, hpxIndex, voterId)
    R-->>B: Tally + Set-Cookie hd_voter (random UUID, first time)
```

- There is no sign-in. The server issues a random UUID in an `httpOnly` cookie (`hd_voter`) only when a browser first rates; no personal data is collected.
- Ratings and survey candidates share one key, the **HEALPix order-11 NESTED cell (~1.7′)** of the point, so the candidates' ratings are tallied with one query.
- The "hide others' ratings until you rate" rule is enforced on the server (`app/api/ratings/_server/ratings.ts`), not just in the UI.

### Precomputed responses (R2)

IRSA can be slow or fail with 502s. Analysis routes wrap their work in `cachedJson()` (`app/api/_server/response-cache.ts`):

- The key is `responses/v1/<route>/<SHA-256 of the input>.json.gz`, with coordinates rounded to 1e-5° (the precision of the page URL).
- A stored answer is returned when there is one; otherwise, or when R2 does not answer within 8 s, the route computes live. An R2 failure never fails the request. The `X-Response-Cache: hit|miss` header shows which happened.
- **Production only reads.** Answers are written only by a local server started with `RESPONSE_CACHE_WRITE=1` while `scripts/precompute-analyses.ts` replays the panel's requests for the test targets and survey candidates. Arbitrary coordinates are always computed live, so nobody can fill the bucket through the public API.

---

## Quick start

**Requirements**

- Node.js 24 (pinned in `.nvmrc` and `engines`)
- pnpm 12 (pinned via `packageManager`). Install it with `npm install -g pnpm@12.16.0` or see the [pnpm installation guide](https://pnpm.io/installation).
- Docker, only for a local database

This project uses **pnpm only**. `npm install` fails on the `node_modules` that pnpm creates, so never mix the two.

```bash
pnpm install                 # also runs prisma generate
cp .env.example .env         # then fill in the values (see below)

# Optional: local PostgreSQL for ratings and survey results
pnpm docker:db               # postgres:17 on 127.0.0.1:5432
# set DATABASE_URL and DIRECT_URL to postgresql://postgres:postgres@localhost:5432/app
pnpm db:migrate

pnpm dev                     # http://localhost:3000
```

On Windows, `dev.bat` does the same in one step: it checks Node, installs pnpm and the packages if they are missing, creates `.env` from `.env.example`, and starts the dev server.

- The sky view and the analysis panels run **without R2**; they then read the public archives live. Survey candidates and ratings need `DATABASE_URL`; when the database cannot be reached, the sky screen says the candidates are unavailable instead of showing an empty queue.
- The UI component showcase is at http://localhost:3000/design-system (development server only, unless `NEXT_PUBLIC_DESIGN_SYSTEM=1`).
- `pnpm build` currently needs `DATABASE_URL` to be set, because the ratings routes connect to the database when the build collects them.

---

## Developer guide

### Tech stack

| Area | Stack |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript 6 |
| Sky view | Aladin Lite 3.8.2 (CDS) |
| 3D, charts and sound | three.js, React Three Fiber, Recharts, Web Audio API |
| Styling / UI | Tailwind CSS 4, shadcn/ui (`base-vega`, Base UI), lucide-react, Pretendard |
| Data fetching | ky (HTTP client, no retries by default), TanStack Query (owns client retries) |
| Validation | zod (`.strict()` schemas on every public endpoint) |
| Database | Prisma 7 with `@prisma/adapter-pg`, PostgreSQL (Neon in production, Docker locally) |
| Object storage | Cloudflare R2 through the AWS SDK S3 client |
| i18n | `app/_i18n/messages.csv` (English, Korean) → generated by `scripts/i18n.mts` |
| Hosting and automation | Vercel, GitHub Actions |

### Directory structure

```text
.
├── app/                              # Next.js App Router
│   ├── page.tsx                      # / : sky explorer (reads the review-queue batch on the server)
│   ├── about/  method/               # /about, /method : explanations (EN/KO)
│   ├── (design-system)/              # /design-system : UI showcase (closed in production by default)
│   ├── api/                          # Route Handlers (the whole server)
│   │   ├── _server/response-cache.ts # R2 read-through cache for analysis responses
│   │   ├── blink/                    # Basic analysis plan
│   │   ├── fpl/                      # SPHEREx search, frame cutouts, Gaia neighbors
│   │   ├── sky/                      # Multi-mission search/frames, Gaia fast stars
│   │   ├── nim/  comet/              # Neighborhood in Motion, Comet Breath
│   │   ├── ratings/                  # Anonymous ratings, HEALPix cells
│   │   └── candidates/               # Survey candidate lookup
│   ├── _components/                  # Client UI for the main page
│   │   ├── sky/                      # Aladin view, search, review queue, star guide, ratings
│   │   ├── blink/                    # Basic blink analysis
│   │   ├── analyses/                 # Panel switcher and prefetch for the 5 analyses
│   │   └── sky-time-machine/ fake-planet-lab/ neighborhood/ sky-sonata/ comet-breath/
│   ├── _lib/                         # Pure TS science code, shared by client, server and scripts
│   │   ├── sky/                      # WCS, reprojection, median stack
│   │   ├── comet/                    # FITS, RICE decompression, TAN-SIP WCS, photometry, VOTable
│   │   └── fpl/ nim/ sonata/ blink/ ratings/
│   ├── _i18n/                        # messages.csv (source) → generated messages.ts / message-keys.ts
│   ├── shared.css                    # Project styles (globals.css is shadcn-managed)
│   └── layout.tsx                    # Root layout and providers
├── components/
│   ├── ui/                           # shadcn/ui source (CLI-managed, do not edit)
│   ├── shared/                       # Wrappers around ui/
│   └── *-provider.tsx                # TanStack Query and theme providers
├── config/                           # env.ts (public) · env.server.ts (server-only), zod-validated
├── data/                             # Database access (ratings, motion candidates)
├── lib/                              # db.ts (Prisma) · storage.ts (R2) · ky.ts · query-client.ts
├── prisma/                           # schema.prisma · models/*.prisma · migrations/
├── public/data/gaia-fast-stars.json  # ~70,000 Gaia DR3 stars moving ≥ 0.2″/yr (star guide)
├── scripts/                          # Survey, precompute, star catalog, i18n
├── docs/                             # Plan, decisions, analyses, submission (mostly Korean)
├── video/                            # Overview video and poster
└── .github/workflows/                # vercel-production.yml · motion-survey.yml
```

Placement rules (shared infrastructure stays domain-free; route code lives under `app/`) are in [AGENTS.md](AGENTS.md#structure), which with `CLAUDE.md` also holds the instructions for coding agents.

### API

Every endpoint is public (the app has no sign-in) and validates its input with a `.strict()` zod schema. Routes marked **R2** answer from precomputed responses when one exists.

| Method · Path | Purpose | R2 |
| --- | --- | :-: |
| `GET /api/blink/plan?ra&dec[&detector]` | SPHEREx DR1 exposures grouped into visits, with one detector and only frames within the wavelength tolerance | ✓ |
| `GET /api/fpl/search?ra&dec` | SPHEREx DR1 exposures covering a position | ✓ |
| `GET /api/fpl/frame?obsId&detector&ra&dec[&size]` | Native-pixel IMAGE / FLAGS / VARIANCE / ZODI cutout (32–96 px) of one exposure, with WCS | ✓ |
| `GET /api/fpl/neighbors?ra&dec&radius&maxG&epoch` | Bright Gaia DR3 stars moved to the observation epoch (ESA Gaia Archive, IRSA fallback) | ✓ |
| `GET /api/sky/search` | One mission's (2MASS, WISE, NEOWISE, SPHEREx) real observing windows at a position | ✓ |
| `POST /api/sky/frame` | One epoch's image as a frame on the common grid | ✓ |
| `GET /api/sky/gaia` | Gaia DR3 stars with proper motion in the field, for predicted paths | ✓ |
| `GET /api/nim/neighbors` | Nearby stars and brown dwarfs (Gaia DR3) | ✓ |
| `GET /api/comet/observations` · `/frame` | 3I/ATLAS observation list and frames | ✓ |
| `GET /api/comet/geometry?mjd` | Heliocentric and geocentric distance from JPL Horizons | |
| `GET /api/ratings?ra&dec` | This browser's rating of the point's cell, and the tally once rated | |
| `PUT /api/ratings` | Create or change a rating (same-origin writes only) | |
| `GET /api/ratings/summary?points=ra,dec;ra,dec` | Rating states of several points (up to 50) | |
| `GET /api/ratings/top` | The 10 most-rated cells, each with the candidate it holds (Review queue "Most rated" tab) | |
| `GET /api/candidates/lookup?name` | Find a survey candidate by its name or 2MASS designation | |

```bash
# Plan the basic analysis for Barnard's Star
curl "http://localhost:3000/api/blink/plan?ra=269.4485&dec=4.7394"
```

### Database

`prisma/schema.prisma` holds only the generator and datasource; models live one domain per file in `prisma/models/`. All database access goes through `data/`, the only place that imports `lib/db.ts`.

```mermaid
erDiagram
    MotionSurvey ||--o{ MotionSurveyPoint : "searches"
    MotionSurvey ||--o{ MotionCandidate : "produces"
    MotionSurveyPoint ||--o{ MotionCandidate : "contains"
    MotionCandidate }o..o{ Rating : "same release + hpxIndex"

    MotionSurvey {
        string id PK
        string method
        string release
        string pipelineVersion
        json params
    }
    MotionSurveyPoint {
        uuid id PK
        string kind
        float raDeg
        float decDeg
        string status
        int candidateCount
    }
    MotionCandidate {
        uuid id PK
        int hpxIndex
        enum match
        float raDeg
        float decDeg
        float epochMjd
        float tmassMjd
        float pmTotalMasYr
        float snr
    }
    Rating {
        uuid id PK
        string release
        int hpxIndex
        uuid voterId
        enum choice
        int visitCount
    }
```

- `MotionSurveyPoint` keeps every searched field, including those with no candidate, no observations or a failure.
- Positions of moving objects are always stored with the epoch they were measured at.
- `Rating` is unique per `(release, hpxIndex, voterId)`; changing a rating updates the row.

### Environment variables

Application code never reads `process.env` directly; it goes through `config/env.ts` (public `NEXT_PUBLIC_*`) and `config/env.server.ts` (server-only). Invalid values surface as zod errors when the module loads. Every variable is documented in [`.env.example`](.env.example).

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_NAME` | public, build time | App name in page titles and the UI. Defaults to `Web App`. |
| `NEXT_PUBLIC_DESIGN_SYSTEM` | public, build time | `1` opens the `/design-system` showcase in a production build. |
| `DATABASE_URL` | server | Database connection for the app (ratings, survey results). On Neon, the pooled connection string. |
| `DIRECT_URL` | Prisma CLI | Database connection for migrations (`prisma.config.ts`). On Neon, the direct connection string. |
| `DATABASE_POOL_MAX` | server | Connections each app instance may open (default 3). |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | server | Cloudflare R2 bucket. Set all four or none; half a configuration fails at startup. With all four, analysis routes answer from stored results. |
| `R2_PUBLIC_URL` | server | Optional public HTTPS URL of the bucket. |
| `RESPONSE_CACHE_WRITE` | server | `1` lets a local server store computed analysis responses in R2 (precompute runs only; never in production). |
| `CLOUDFLARE_API_TOKEN` | — | Not read by the app; for managing the bucket through the Cloudflare API. |

### Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm build` / `pnpm start` | Production build / start |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Checks that the i18n code is up to date (`i18n --check`), generates the Next.js route types (`next typegen`), then runs `tsc --noEmit` |
| `pnpm i18n` | Sorts and checks `app/_i18n/messages.csv` and regenerates the interface text code |
| `pnpm docker:db` / `pnpm docker:down` | Start / stop the local PostgreSQL |
| `pnpm db:migrate` | Create and apply migrations on the development database |
| `pnpm db:deploy` / `pnpm db:status` | Apply committed migrations / show migration status |
| `pnpm db:generate` | Regenerate the Prisma Client (also runs on install) |
| `pnpm db:studio` | Open Prisma Studio |

Pipelines (run with `tsx`; full usage in each file's header):

| Script | What it does |
| --- | --- |
| `scripts/motion-survey.ts` | The SPHEREx × 2MASS movement survey: `survey`, `reclassify`, `import`, `targets` |
| `scripts/precompute-analyses.ts` | Replays the analysis panel's requests for the test targets and survey candidates against a local server with `RESPONSE_CACHE_WRITE=1`, filling R2 |
| `scripts/fast-stars-catalog.ts` | Rebuilds `public/data/gaia-fast-stars.json` from the ESA Gaia Archive |
| `scripts/i18n.mts` | Behind `pnpm i18n`; plain Node, no tsx |

```bash
# Survey 300 random fields, then import them (server-only modules need the react-server condition)
npx tsx --conditions=react-server --env-file=.env scripts/motion-survey.ts survey random 300 out.jsonl
npx tsx --conditions=react-server --env-file=.env scripts/motion-survey.ts import out.jsonl <surveyId>
```

### Deployment and CI

```mermaid
flowchart LR
    subgraph prod["vercel-production.yml · push to main or manual"]
        direction LR
        L["pnpm lint<br/>pnpm typecheck"] --> VB["vercel pull<br/>vercel build"] --> VD["vercel deploy --prebuilt<br/>Production"]
    end
    subgraph survey["motion-survey.yml · manual"]
        direction LR
        PL["plan<br/>1–10 shards"] --> SV["survey × N<br/>JSON Lines artifacts"] --> IM["import<br/>into PostgreSQL"]
    end
```

- **Production:** every push to `main` runs `pnpm lint` and `pnpm typecheck`, builds with `vercel build` on the runner, and uploads with `vercel deploy --prebuilt`. It can also be started from the Actions tab. Set the app's environment variables in the Vercel project for the Production environment; the workflow pulls them before it builds, so redeploy after changing them.
- **Motion Survey:** started by hand with the number of shards, points per shard, concurrency and timeout. Each shard keeps its results as an artifact even when the import is skipped or fails.

Repository secrets (Settings > Secrets and variables > Actions):

| Secret | Where to find it |
| --- | --- |
| `VERCEL_TOKEN` | Vercel account settings > Tokens |
| `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | `.vercel/project.json` after running `vercel link` (`orgId`, `projectId`) |
| `DATABASE_URL` | Only for the Motion Survey workflow's import job |

### Contributing rules in brief

- Verify with `pnpm lint`, `pnpm typecheck` and `pnpm build` before pushing; `main` deploys to production.
- Commit messages: `feat:` `fix:` `docs:` `ci:` `chore:` + an English imperative sentence.
- Screen text and submissions are in English; internal documents in `docs/` are in Korean. Interface text is edited only in `app/_i18n/messages.csv`.
- Mark server-only modules with `import "server-only"` and browser-only ones with `import "client-only"`.
- Never edit `components/ui/`, `app/globals.css` or the other shadcn-managed files; wrap them in `components/shared/`.

The full rules are in [AGENTS.md](AGENTS.md).

---

## Known limitations

- SPHEREx DR1 spans about a year, so a place has only a few visits and most stars move far less than one 6.2″ pixel between them. The blink is a place to look, not a verdict.
- The survey sampled 75,756 random fields, not the whole sky, and missed some very fast or very bright stars in its control sample.
- A very distant solar system object jumps several arcminutes between visits (Earth's motion), more than the 3′ cutout, so it would appear in one visit and vanish in the next. This tool has not searched for a planet beyond Neptune in a way that could rule one out.
- Analysis depends on NASA/IPAC IRSA. Places we precomputed (test targets and survey candidates) open from stored results; elsewhere, an IRSA outage makes panels slow or fail with a message.
- While the CDS service is down, the all-sky background is 2MASS instead of the SPHEREx color map. Analysis always uses SPHEREx DR1.
- Anyone who clears cookies or uses another device can rate the same place again.
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

| Document | Contents |
| --- | --- |
| [`docs/PLAN.md`](docs/PLAN.md) | Features, UX, data handling and architecture |
| [`docs/decisions.md`](docs/decisions.md) | Decisions and the reasons behind them |
| [`docs/analyses/`](docs/analyses/) | The additional analyses and how each was checked |
| [`docs/presentation/`](docs/presentation/) | Presentation script, including the architecture page |
| [`docs/experiments/`](docs/experiments/) | Measurements behind technical choices (IRSA concurrency, tile proxy) |
| [`docs/submission/`](docs/submission/) | The challenge submission texts (English) |
| [`docs/memory/`](docs/memory/) | Direction, milestones, glossary, team status and the AI usage log |

## License

[MIT](LICENSE)
