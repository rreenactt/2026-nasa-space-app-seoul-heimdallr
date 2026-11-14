<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project guidelines

This is a web application built on the Next.js App Router for the 2026 NASA Space Apps hackathon, kept to the minimum the app needs. Keep shared infrastructure (`lib/`, `components/ui/`, `components/shared/`, `config/`) free of domain-specific names and business logic; put the routes and their code under `app/`.

## Structure

```
app/                     # Routes (App Router)
├── (design-system)/     # /design-system UI showcase (closed in production unless NEXT_PUBLIC_DESIGN_SYSTEM=1)
├── **/_components/      # Components used by a single route
├── fonts/               # Pretendard official subset and Pretendard JP, one file per weight (loaded from app/shared.css)
├── globals.css          # shadcn/Tailwind base styles (managed by shadcn, do not edit)
├── shared.css           # Project styles: theme token overrides, extra tokens, utilities
├── icon.svg             # Neutral placeholder site icon (replace with the service icon)
└── layout.tsx           # Root layout · global providers
components/
├── ui/                  # shadcn/ui source (managed by the shadcn CLI, do not edit)
├── shared/              # Derived and composed components (wrap ui to extend it)
└── *-provider.tsx       # Client providers
config/
├── env.ts               # Public environment variables (NEXT_PUBLIC_*)
└── env.server.ts        # Server-only environment variables
hooks/
├── use-mobile.ts        # From shadcn (sidebar), do not edit
└── use-highlighted-code.ts # From shadcn (code-block), do not edit
lib/
├── highlighter.tsx      # Shiki code highlighter from shadcn (code-block), do not edit
├── ky.ts                # HTTP client
├── query-client.ts      # TanStack Query client
└── utils.ts             # cn re-export (shadcn alias)
```

## Commands

- Use pnpm only.
- Do not lower `minimumReleaseAge` in `pnpm-workspace.yaml`. Only an urgent security fix may go into `minimumReleaseAgeExclude`, and it comes out once the version is 7 days old.
- Verify changes with `pnpm lint`, `pnpm typecheck`, and `pnpm build`.
- Node is pinned in `.nvmrc` and `engines`; change both together.

## Rules

### Server / client boundary
- A server-only module starts with `import "server-only"`, a client-only module with `import "client-only"`. Add the guard to every new module that reads server secrets, uses `next/headers` / `next/server`, or depends on browser-only APIs.

### Server code
- Every Server Action and Route Handler is a public endpoint that anyone can call with any input. The app has no sign-in.
- Validate client input with a `.strict()` zod schema before using it.
- Server Action return values and props passed to Client Components are serialized to the browser; pass only the fields the UI needs.

### Environment variables
- Never read `process.env` directly. Add public variables to the zod schema in `config/env.ts` and server-only variables to `config/env.server.ts`, then use them from there. `NODE_ENV` is the exception.
- Never expose secrets as `NEXT_PUBLIC_*`.
- Add every new variable to `.env.example` with a description.

### Data fetching
- Make HTTP calls through `lib/ky.ts`, which never retries by default. In client code, TanStack Query (`lib/query-client.ts`) owns the retry policy.
- Data the server can read directly is read in Server Components, not fetched again from the client.

### UI
- `components/ui/` is shadcn registry source, and so are `hooks/use-mobile.ts`, `hooks/use-highlighted-code.ts`, and `lib/highlighter.tsx`. Never edit these files; shadcn updates overwrite them.
- When you need a variation, create a derived component in `components/shared/` that wraps `@/components/ui/*` instead of copying the source file.
- Put components used by a single route in that route's `_components/`.
- `app/globals.css` is managed by shadcn. Never edit it; put project styles in `app/shared.css`.
- Add: `pnpm dlx shadcn@latest add <component>`. Update: review with `--diff`, then apply with `--overwrite`.
- Merge classes with `import { cn } from "cn"`.
- Show every component in `components/ui/` and `components/shared/` in the `/design-system` showcase: use it in a card in `app/(design-system)/components/cards/` and register the card in `showcase.tsx`.
