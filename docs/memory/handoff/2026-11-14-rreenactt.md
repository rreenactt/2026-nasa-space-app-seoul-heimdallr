# 인수인계: 분석 패널·추가 분석·데이터 속도 (2026-11-14, rreenactt)

> 김재현(`rreenactt`)이 Claude Code와 한 작업을 다음 사람(또는 다음 AI 세션)이 이어받도록 정리했다.
> 현재 상태 요약은 [`status/rreenactt.md`](../status/rreenactt.md), 분석별 상세는 [`docs/analyses/`](../../analyses/README.md)에 있다.

## 1. 지금 어디까지 왔나

| 영역 | 상태 | 문서 |
| --- | --- | --- |
| 기본 분석 (블링크·차분·합산, Gaia 겹치기) | 구현·main 반영 | [`basic-blink.md`](../../analyses/basic-blink.md) |
| 패널 로딩 화면 (블링크 자료를 다 받은 뒤 표시, 진행바) | 구현·main 반영 (`93f770e`) | 결정 #31 |
| 추가 분석 5개 + "Download data" → 진행바 → "Open" | 구현·main 반영 | [`analyses/README.md`](../../analyses/README.md) |
| 동시 다운로드·S3 읽기·NEOWISE 검색 분할 | **구현, 아직 커밋 안 함** | [`experiments/2026-11-14-irsa-concurrency`](../../experiments/2026-11-14-irsa-concurrency/README.md) |
| 분석 문서 6개 재정리 (무엇·왜·어떻게) | **작성, 아직 커밋 안 함** | `docs/analyses/*.md` |

### 커밋 안 된 변경 (이 문서 작성 시점)

- 코드: `app/api/sky/_server/archive.ts`(WISE S3 읽기, IBE 동시 2개, 503 빠른 재시도, NEOWISE TIME 8분할), `app/_lib/comet/remote-fits.ts`(헤더 캐시·같은 버퍼 재사용), `app/api/comet/_server/irsa.ts`(DataLink 캐시, `rangeFetcher.url`), `app/_components/analyses/`(대기열 제거, 동시 8개), `use-sky-data.ts`·`use-comet-data.ts`(동시 8개)
- 문서: `PLAN.md` 5장, `decisions.md` #31 수정, `analyses/*`, `ai-usage.md`, `status/rreenactt.md`, 이 문서, 실험 기록
- `pnpm typecheck`·`lint`·`build` 통과, 브라우저(로컬 운영 빌드)에서 시험함

## 2. 구조 한눈에

```
하늘 클릭/검색 → /?ra=&dec=&fov= → 분석 패널 (app/_components/sky/analysis-panel.tsx)
  ├─ BlinkProvider (blink-context.tsx): /api/blink/plan → /api/fpl/frame ×N → /api/fpl/neighbors ×방문
  │    └─ BlinkGate: 다 받을 때까지 진행바, 그다음 뷰어 + 오른쪽 열
  └─ AdditionalAnalyses (analyses/additional-analyses.tsx)
       └─ "Download data" → prefetch.ts가 각 다이얼로그와 같은 query key로 TanStack Query 캐시를 채움 → "Open"
```

- 받은 자료는 브라우저 메모리(TanStack Query)에만 둔다. 서버는 파일 위치(DataLink)와 FITS 헤더만 프로세스 메모리에 잠깐 기억한다(픽셀·원본 FITS 저장 없음).
- `prefetch.ts`는 각 다이얼로그의 **기본 선택과 query key를 그대로 복제**한다. 다이얼로그의 기본값·key를 바꾸면 여기도 같이 바꿔야 "Open"이 다시 로딩하지 않는다.

## 3. 측정값 (Barnard's Star, 한국 PC, 로컬 운영 빌드)

| 항목 | 이전 | 지금 |
| --- | --- | --- |
| 블링크 패널 표시 | 14초 | 6.8초 |
| Fake Planet Lab / Sonata / Neighborhood / Comet | 하나씩 차례로 | 동시에, 모두 15초 안 |
| Sky Time Machine 27시점 | 약 90초 | 48–64초 |
| 전부 한꺼번에 | 2분 이상 | 64초 |

프로덕션은 함수가 미국 동부(iad1, `vercel.json` 없음 = 기본값)에서 돌아 S3·IRSA와 가깝다. 프로덕션에서 다시 재 보지는 않았다.

## 4. 알아야 할 함정

- **IRSA IBE 잘라내기는 동시 2개.** 3번째부터 즉시 503. 2MASS는 S3 사본이 없어 이 제한을 그대로 받는다.
- **SIA2 `cloud_access` 열은 CSV로 파싱하면 깨진다** (따옴표 없는 쉼표). WISE S3 키는 경로 규칙으로 만든다.
- **OUTLIER 플래그는 측정 영역에서 가리지 않는다** (움직이는 천체가 걸림, 결정 #28).
- **LVF:** 같은 검출기라도 노출마다 목표 파장이 다르다. 비교 전 `WCS-WAVE`로 확인한다 (결정 #30).
- **브라우저 도구로 시험할 때** 45초 넘는 스크립트는 끊긴다. 결과를 `window`에 쌓고 나중에 읽는다.
- **Windows에서 서버 끄기:** 명령줄 패턴으로 프로세스를 고르면 다른 사람이 띄운 서버까지 끌 수 있다(실제로 3001 개발 서버를 껐다). 포트로 PID를 확인하고 그 PID만 끈다.
- pnpm은 `npx --yes pnpm@12.16.0 …`로 실행했다.
- GitHub 원격 저장소 주소가 `rreenactt/2026-nasa-space-app-seoul-heimdallr`로 옮겨졌다는 안내가 나온다(`git remote set-url` 미실행).

## 5. 사람이 정해야 할 것

- 결정 #30 (파장 허용치 ±0.5×대역폭), #31 (패널 로딩·추가 분석 다운로드 방식): "제안" 상태
- 처리 결과 CDN 캐시 여부 (절대 원칙 7 "원본 FITS 저장 안 함"과의 관계 확인 필요)
- Comet Breath 진입 위치 (3I/ATLAS 특별 핀)
- Blink Arena 보류 유지 (#18)

## 6. 다음 할 일 (제안 순서)

1. 커밋 안 된 변경을 브랜치에서 커밋 → 최신 main과 합치기 → 푸시 (사용자 요청 시)
2. 프로덕션에서 속도 다시 재기 (Vercel 로그의 함수 시간 포함)
3. Comet Breath·Sky Time Machine 화면 문구 영어화 (`AGENTS.md` 규칙)
4. 블링크: 알려진 소행성 겹치기, 사용자 평가, `mode`·`det` URL 상태
5. Sky Time Machine: SPHEREx 채널을 비교 미션 파장에 자동 맞춤
6. 3001 개발 서버 다시 띄우기 (사용자 환경)
