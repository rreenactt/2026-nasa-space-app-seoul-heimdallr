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
├── generated/prisma/    # Generated Prisma Client (`pnpm db:generate`, gitignored; import from `@/prisma/client`)
├── icon.svg             # Neutral placeholder site icon (replace with the service icon)
└── layout.tsx           # Root layout · global providers
components/
├── ui/                  # shadcn/ui source (managed by the shadcn CLI, do not edit)
├── shared/              # Derived and composed components (wrap ui to extend it)
└── *-provider.tsx       # Client providers
config/
├── env.ts               # Public environment variables (NEXT_PUBLIC_*)
└── env.server.ts        # Server-only environment variables
data/                    # Database access (the only place that imports lib/db.ts)
prisma/
├── schema.prisma        # Generator and datasource only
├── models/              # Models and enums, one <domain>.prisma per domain
└── migrations/          # `pnpm db:migrate` output (committed)
prisma.config.ts         # Prisma CLI config (schema directory, DIRECT_URL)
docker-compose.yaml      # Local development Postgres (`pnpm docker:db`)
hooks/
├── use-mobile.ts        # From shadcn (sidebar), do not edit
└── use-highlighted-code.ts # From shadcn (code-block), do not edit
lib/
├── db.ts                # The single Prisma Client (server-only, strips query values from errors)
├── highlighter.tsx      # Shiki code highlighter from shadcn (code-block), do not edit
├── ky.ts                # HTTP client
├── query-client.ts      # TanStack Query client
├── storage.ts           # Cloudflare R2 via AWS SDK (server-only): put/get/head/delete, presigned upload URLs
├── upload.ts            # Browser upload to a presigned URL with progress (client-only)
└── utils.ts             # cn re-export (shadcn alias)
.github/workflows/
└── vercel-production.yml # Checks, then deploys main to Vercel production
```

## Commands

- Use pnpm only.
- Do not lower `minimumReleaseAge` in `pnpm-workspace.yaml`. Only an urgent security fix may go into `minimumReleaseAgeExclude`, and it comes out once the version is 7 days old.
- Verify changes with `pnpm lint`, `pnpm typecheck`, and `pnpm build`.
- Node is pinned in `.nvmrc` and `engines`; change both together.
- Database: `pnpm docker:db` starts the local Postgres, `pnpm db:migrate` applies schema changes, `pnpm db:generate` regenerates the client (also runs on install).

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

# 프로젝트 맥락 (HEIMDALLR)

> 이 절은 팀원 모두의 AI(Claude Code, ChatGPT)가 공유하는 프로젝트 공통 메모리다. 위의 코딩 규칙과 함께 따른다.
> 팀 합의로만 바꾼다. 개인 지시나 개인 작업 메모는 넣지 않는다 (아래 "개인 메모리").
> 이 파일 전체를 200줄 이내로 유지하고, 자세한 내용은 `docs/`로 넘긴다.

## 프로젝트

- **챌린지:** Planet X and SPHEREx (NASA Space Apps Seoul, 11/14 09:00 – 11/15 23:59 KST)
- **한 줄 설명:** 누구나 3D 하늘을 둘러보다 한 지점을 클릭하면 그 자리의 SPHEREx 이미지가 블링크로 재생되고, 움직이는 천체를 함께 찾고 검증하는 공개 웹 도구
- **콘셉트:** 기계가 후보를 찾고, 사람이 확인한다
- **팀:** 김재현 (`rreenactt`), 허한결 (`ansirh`), 이순형 (`tnsgud9`)

## 어디를 보면 되나

| 알고 싶은 것 | 문서 |
| --- | --- |
| 방향성, 범위, 하지 않는 것 | `docs/memory/direction.md` |
| 마일스톤과 현재 단계 | `docs/memory/milestones.md` |
| 기획 전체 (기능, UX, 데이터, 구조) | `docs/PLAN.md` |
| 추가 분석 기법 | `docs/analyses/README.md` |
| 지금까지 내린 결정과 이유 | `docs/decisions.md` |
| 아직 정하지 않은 것 | `docs/PLAN.md` 14장 |
| 팀원별 현재 작업 | `docs/memory/status/` |
| 용어 | `docs/memory/glossary.md` |
| AI 사용 기록 | `docs/memory/ai-usage.md` |

## 절대 원칙

과학적 타당성과 정직성이 심사와 직결된다. 코드, 화면 문구, 문서 모두에 적용한다.

1. **"감지"가 아니라 "후보"로 표현한다.** Planet X 발견이나 자동 분류 정확도를 성과로 주장하지 않는다.
2. **이동 비교는 입력 좌표 기준의 고정 하늘 격자에서 한다.** 목표 천체를 매번 중앙에 맞추면 움직임이 사라진다.
3. **같은 검출기·비슷한 파장끼리만 비교한다.** SPHEREx는 LVF라서 한 이미지 안에서도 위치마다 파장이 다르다.
4. **데이터를 지어내지 않는다.** 관측이 부족하면 부족하다고 표시한다 (SPHEREx 방문 1회는 "추가 분석 필요"). 없는 관측을 지어내 채우지 않는다. 합성 데이터는 항상 합성이라고 표시한다.
5. **결과가 없어도 솔직하게 보여준다.** 못 찾았으면 탐지 한계와 함께 "없음"을 표시한다.
6. **움직이는 천체의 좌표는 관측 시점과 함께 다룬다.**
7. **원본 FITS는 저장하지 않는다.** 화면용 이미지와 메타데이터만 저장하고 원본은 IRSA 링크로 남긴다.
8. **NASA 로고를 프로젝트 브랜드로 쓰지 않는다.** AI로 만든 이미지·영상에는 워터마크를 넣는다.

## 데이터 기준

- SPHEREx: IRSA, **DR1 우선 (없으면 QR3)**. QR2 예제 경로를 그대로 쓰지 않는다.
- 예외: 3D 하늘 배경(둘러보기)에만 CDS SPHEREx QR2 컬러 HiPS를 쓴다. 분석은 위 기준을 따른다.
- 보조: Gaia DR3, JPL·MPC 소행성, 2MASS·AllWISE·NEOWISE, 3I/ATLAS 전용 영상
- 테스트 대상: Barnard's Star, Epsilon Indi B, WISE 0855, RW Aurigae, R Draconis

## 작업 규칙

- 대회 시작(11/14 09:00 KST) 이후 작성한 코드만 커밋한다.
- 커밋 메시지는 기존 형식을 따른다: `init:` `feat:` `fix:` `docs:` `ci:` `chore:` + 영어 명령문 (예: `docs: Add the project plan`).
- `main`에 푸시하면 Vercel 프로덕션에 배포된다. 푸시 전에 `pnpm lint`, `pnpm typecheck`를 통과시킨다.
- 기획을 바꾸는 결정은 `docs/decisions.md`에 기록하고 `docs/PLAN.md` 해당 장을 같은 커밋에서 고친다.
- 기능 동작을 바꾸는 코드는 관련 문서를 같은 커밋에서 고친다.
- 사용자에게 보이는 화면 문구와 제출물은 영어, `docs/`의 내부 문서는 한국어로 쓴다.

## AI가 작업할 때

- 작업 전에 `docs/memory/milestones.md`와 담당자의 `docs/memory/status/<깃허브 닉네임>.md`를 읽고 현재 단계를 확인한다.
- 작업 세션이 끝나면 담당자의 status 파일 갱신을 제안한다. 다른 사람의 status 파일은 고치지 않는다.
- AI로 코드·문서·이미지를 만들었으면 `docs/memory/ai-usage.md`에 한 줄 추가를 제안한다. 대회 제출 시 AI 사용 내역을 밝혀야 한다.
- 이 절과 `docs/memory/direction.md`는 사람이 합의해서 바꾼다. AI는 수정을 제안만 한다.
- 결정은 사람이 내린다. AI는 `docs/decisions.md` 기록을 돕는다.

## 개인 메모리 (레포에 올리지 않음)

- **Claude Code:** 이 프로젝트에만 적용할 개인 지시는 `CLAUDE.local.md`(gitignore 처리됨), 모든 프로젝트에 적용할 개인 지시는 `~/.claude/CLAUDE.md`에 둔다. 자동 메모리는 각자 컴퓨터에만 저장된다.
- **ChatGPT:** 개인 지시는 각자의 ChatGPT 설정(사용자 지정 지침, 메모리)에 둔다.
- **ChatGPT 사용 시:** 일반 대화는 레포를 자동으로 읽지 않는다. 대화를 시작할 때 이 파일과 필요한 문서를 첨부하거나, GitHub 연결 기능으로 레포를 읽게 한다.
