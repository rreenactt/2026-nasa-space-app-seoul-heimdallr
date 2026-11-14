<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project guidelines

This is a web application built on the Next.js App Router for the 2026 NASA Space Apps hackathon, kept to the minimum the app needs. Keep shared infrastructure (`lib/`, `components/ui/`, `components/shared/`, `config/`) free of domain-specific names and business logic; put domain code in `data/` (server), `domains/<domain>/` (code the server and the browser share), and the routes under `app/`.

## Structure

```
app/                     # Routes (App Router)
├── (design-system)/     # /design-system UI showcase (closed in production unless NEXT_PUBLIC_DESIGN_SYSTEM=1)
├── **/_components/      # Components used by a single route
├── api/health/          # Liveness check (no database access)
├── fonts/               # Pretendard official subset and Pretendard JP, one file per weight (loaded from app/shared.css)
├── generated/prisma/    # Generated Prisma Client
├── globals.css          # shadcn/Tailwind base styles (managed by shadcn, do not edit)
├── shared.css           # Project styles: theme token overrides, extra tokens, utilities
├── error.tsx            # Unexpected page errors (generic message + digest)
├── global-error.tsx     # Root layout failures
├── not-found.tsx        # Unknown routes and notFound()
├── icon.svg             # Neutral placeholder site icon (replace with the service icon)
└── layout.tsx           # Root layout · global providers
components/
├── ui/                  # shadcn/ui source (managed by the shadcn CLI, do not edit)
├── shared/              # Derived and composed components (wrap ui to extend it)
└── *-provider.tsx       # Client providers
config/
├── env.ts               # Public environment variables (NEXT_PUBLIC_*)
└── env.server.ts        # Server-only environment variables
data/                    # Data access layer (server-only): the only code that uses the database
domains/                 # Domain code the server and the browser share, one folder per domain (no server-only imports)
hooks/
├── use-mobile.ts        # From shadcn (sidebar), do not edit
└── use-highlighted-code.ts # From shadcn (code-block), do not edit
test-utils/              # Test-only helpers: shared/ (tool-agnostic), then vitest/
lib/
├── csp.ts               # Content-Security-Policy, shared by next.config.ts and the proxy
├── db.ts                # Single Prisma Client instance (server-only), imported only by data/
├── highlighter.tsx      # Shiki code highlighter from shadcn (code-block), do not edit
├── problem.ts           # Shared RFC 9457 error contract: Problem, ProblemError, ActionResult
├── ky.ts                # HTTP client
├── query-client.ts      # TanStack Query client
├── server/              # Server-only: error → Problem mapping, error handlers, input validation, structured logger
└── utils.ts             # cn re-export (shadcn alias)
prisma/
├── schema.prisma        # generator / datasource
└── models/              # Models, one file per domain
.agents/skills/          # Agent skills, identical to .claude/skills/
.claude/skills/          # Claude Code skills
.github/                 # CI workflow (workflows/ci.yml) and its shared setup action
docker-compose.yaml      # Development database for pnpm dev (docker:db)
docker-compose.test.yaml # Test-only Postgres (pnpm test:db:up / test:db:down)
.env.test                # Environment of every test (committed, no secrets), set in place of .env
prisma7.config.ts        # Prisma CLI config
proxy.ts                 # Request proxy (CSP nonce, request ID)
```

## Commands

- Use pnpm only.
- Do not lower `minimumReleaseAge` in `pnpm-workspace.yaml`. Only an urgent security fix may go into `minimumReleaseAgeExclude`, and it comes out once the version is 7 days old. Fix a `pnpm audit` failure by updating the package, not by lowering the audit level.
- Verify changes with `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`. CI (`.github/workflows/ci.yml`) runs these pnpm scripts, plus `prisma validate`, a `prisma format` diff check, and `pnpm audit`.
- Node is pinned in `.nvmrc` and `engines`; change both together. Read Node from `.nvmrc` and pnpm from `packageManager` in CI. The Postgres image tag appears in `ci.yml`, `docker-compose.yaml`, and `docker-compose.test.yaml`; change the three together.
- Test files are named `*.vitest.test.ts` or `*.vitest.test.tsx` and sit next to the code they cover (a `.tsx` test renders on the server, with no DOM). Put shared test setup and helpers in `test-utils/vitest/`; code that imports no test tool goes in `test-utils/shared/`. Vitest mocks `next/headers` globally (`test-utils/vitest/setup.ts`).
- Tests never reach a real external service and need no secrets. The database is a real local Postgres (`docker-compose.test.yaml`, started with `pnpm test:db:up`; CI starts the same image). Tests run with `.env.test`, never `.env`; it lists every variable in `.env.example` (`test-utils/shared/test-env.vitest.test.ts` checks this).
- Vitest projects: `unit` (no external dependencies, parallel) and `db` (`data/**`, the Prisma Client, and `test-utils/**` tests, real database emptied before each test, one file at a time). Test `data/` functions against the database; tests above `data/` mock the `data/` functions they call. `pnpm test:vitest:unit` skips the database.
- When you change error mapping, input validation, the error handlers, or the ESLint boundary, update the matching Vitest test in the same change.
- Database: `pnpm db:generate` / `db:migrate` / `db:deploy` / `db:studio`

## Rules

### Server / client boundary
- The runtime boundary is enforced per module: a server-only module starts with `import "server-only"`, a client-only module with `import "client-only"`. Shared modules import neither and must not import a guarded module.
- Domain code both sides use (problem types, input schemas a form and its Server Action share, constants) goes in `domains/<domain>/`, which imports no server-only module (enforced by ESLint). Server logic for a domain stays in `data/`.
- Prisma Client values (`@/prisma/client`) are imported only in `data/**`, `lib/db.ts` (and its own test), and `lib/server/**` (enforced by ESLint). Elsewhere use `import type`, and `@/prisma/browser` for `Decimal`, enums, and `JsonNull`.

### Security boundary (client → server)
Every Server Action and Route Handler is a public endpoint that anyone can call with any input. The app has no sign-in, so treat every caller as anonymous.

- **Data access layer**: only `data/**` imports `@/lib/db` (enforced by ESLint), and server secrets (`@/config/env.server`) are read only in `data/**` and server-only `lib/` modules. In `data/`, use `db` only as `db.<model>` / `db.$...`; never rename, return, pass on, or export it. Never bypass the boundary with `eslint-disable`.
- **Return values**: `data/` functions return DTOs with only the fields the caller needs, never raw Prisma records. The same applies to Server Action return values and props passed to Client Components.
- **Mass assignment**: never pass client input straight into Prisma `data` / `where`. Validate with a `.strict()` zod schema and build the Prisma arguments field by field.
- **Server Actions**: a `"use server"` file exports only actions. Each action validates its arguments, then calls `data/`; it never queries the database itself.
- **Pages**: Server Components read through `data/` as well, through `loadForPage()` from `@/lib/server/error-handlers` (a 404 or 403 becomes `notFound()`).
- **Error pages**: `app/error.tsx` and `app/global-error.tsx` never render the error message, only the digest. Do not add a root `loading.tsx`; add `loading.tsx` per route segment instead.
- **Abuse**: an endpoint that writes data or calls a paid or rate-limited API can be called repeatedly by anyone; limit it before release.
- **Security headers**: keep the headers in `next.config.ts` on every route. The CSP is built in `lib/csp.ts`; pages get a per-request nonce from the proxy. Connections go only to this origin; add a new external origin to the one directive that needs it. Never add `'unsafe-inline'` to `script-src`.

### Environment variables
- Never read `process.env` directly. Add public variables to the zod schema in `config/env.ts` and server-only variables to `config/env.server.ts`, then use them from there. `NODE_ENV` is the exception.
- Never expose secrets as `NEXT_PUBLIC_*`.
- Add every new variable to `.env.example` with a description, and to `.env.test` with a test value, or empty to leave it unset.

### Database
- Put models and enums in `prisma/models/<domain>.prisma`, and nothing else there. Keep `generator` / `datasource` only in `prisma/schema.prisma`.
- Query only inside the data access layer (`data/**`), through `db` from `@/lib/db`. Do not create new Prisma Client instances.
- Outside development, `lib/db.ts` rewrites the Prisma error of every query so it carries no query values. Do not remove it, and never log a query's arguments or a database error's original text yourself.
- Import generated types from `@/prisma/client`, and enum values used in client code from `@/prisma/browser`. Do not edit `app/generated/` by hand.
- The runtime connects with `DATABASE_URL`; the CLI connects with `DIRECT_URL`.
- Change the schema only through Prisma migrations. `pnpm test:vitest` fails when the schema has changes that no migration in `prisma/migrations` covers.
- Primary keys: `id String @id @default(uuid(7)) @db.Uuid`, and foreign keys referencing them as `String @db.Uuid`. Never use `autoincrement()` IDs.
- Model conventions: snake_case names through `@@map` / `@map`, `DateTime` as `@db.Timestamptz`, `Decimal` for fractional values, and an index that starts with every foreign key column. `Float` is approximate, so use it only where an approximate value is enough, with a `///` comment on the field saying why.
- `prisma/models.vitest.test.ts` checks these model rules and the pinned Prisma versions; fix a model rather than the test.
- Pin `prisma`, `@prisma/client`, and `@prisma/adapter-pg` to the same exact version.

### Server endpoints
- Wrap every exported Route Handler in `withRouteErrorHandler()` and every exported Server Action in `withActionErrorHandler()` (both from `@/lib/server/error-handlers`), as `export const NAME = with...(...)` (enforced by ESLint). Do not hand-roll `try`/`catch` error responses.
- Map errors to Problems only in `@/lib/server/error-mapper`. Expected failures become Problems and are not logged. In Route Handlers, unexpected errors become a 500 Problem, are logged, and carry the log line's `error.id` as `errorId`. Server Actions rethrow unexpected errors, and `error.tsx` shows the digest.
- Validate all external input (JSON body, search params, FormData, route params, action arguments) with zod through `@/lib/server/validation`. An invalid route param means not found.
- Failures are RFC 9457 Problems (`@/lib/problem`). Signal expected failures by throwing `ProblemError`. Define domain problem types in `domains/<domain>/` with `defineProblemType()` and a kebab-case name. Clients branch on `type` only.
- Status rules: client input validation 400, conflict with current state 409, valid input that breaks a business rule 422, missing target 404, rate limit exceeded 429.
- `detail` and extension members reach the client, so keep internal details out of them.
- Write server logs only through `logger` from `@/lib/server/logger`, never `console` directly. Never log request bodies, headers, cookies, tokens, or query strings.
- `/api/health` stays a cheap liveness check: no database, no external calls.

### Data fetching
- Make HTTP calls through `lib/ky.ts`, which never retries by default. In client code, TanStack Query (`lib/query-client.ts`) owns the retry policy.
- Data the server can read directly is read in Server Components through `data/` functions, not fetched again from the client.

### UI
- `components/ui/` is shadcn registry source, and so are `hooks/use-mobile.ts`, `hooks/use-highlighted-code.ts`, and `lib/highlighter.tsx`. Never edit these files; shadcn updates overwrite them.
- When you need a variation, create a derived component in `components/shared/` that wraps `@/components/ui/*` instead of copying the source file.
- Put components used by a single route in that route's `_components/`.
- `app/globals.css` is managed by shadcn. Never edit it; put project styles in `app/shared.css`.
- Add: `pnpm dlx shadcn@latest add <component>`. Update: review with `--diff`, then apply with `--overwrite`.
- Merge classes with `import { cn } from "cn"`.
- Every component in `components/ui/` and `components/shared/` appears in the `/design-system` showcase: use it in a card in `app/(design-system)/components/cards/` and register the card in `showcase.tsx`. `showcase.vitest.test.ts` fails when a component or card is missing.
