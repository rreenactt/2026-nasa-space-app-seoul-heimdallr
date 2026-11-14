# 실험 코드

로컬 실험에 쓴 코드다. **레포에는 커밋하지 않았다.** 커밋하면 `main` 배포 때 공개 엔드포인트가 그대로 열리므로, 적용이 정해지면 아래 "적용 시 바꿀 점"을 반영해서 넣는다.

## 1. 프록시 Route Handler

`app/api/hips/2mass-color/[...path]/route.ts`

```ts
import "server-only";
import { z } from "zod";
import { api } from "@/lib/ky";

// EXPERIMENT (not committed): relays the IRSA 2MASS color HiPS so tiles reach the browser over our server's
// connections instead of one long-haul HTTP/2 connection to IRSA.
const UPSTREAM = "https://irsa.ipac.caltech.edu/data/hips/CDS/2MASS/Color";

// Only the files Aladin Lite reads from a HiPS: the properties file and JPEG tiles.
const hipsPath = z
  .string()
  .regex(/^(properties|Norder\d{1,2}\/Allsky\.jpg|Norder\d{1,2}\/Dir\d{1,7}\/Npix\d{1,9}\.jpg)$/);

export async function GET(_request: Request, ctx: RouteContext<"/api/hips/2mass-color/[...path]">) {
  const { path } = await ctx.params;
  const parsed = hipsPath.safeParse(path.join("/"));
  if (!parsed.success) return new Response("Not found", { status: 404 });

  const upstream = await api.get(`${UPSTREAM}/${parsed.data}`, { throwHttpErrors: false, timeout: 20_000 });
  if (!upstream.ok) return new Response(null, { status: upstream.status === 404 ? 404 : 502 });
  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/octet-stream",
      "Cache-Control": "no-store",
    },
  });
}
```

동작 확인(로컬): `properties`·타일은 200, `../../etc`나 `Norder3/x.fits` 같은 허용 밖 경로는 404.

## 2. 비교용 분기

`app/_components/sky/sky-view.tsx`의 Aladin 옵션에서 `survey`를 바꿔, URL에 `?hipsProxy=1`이 있을 때만 프록시를 쓰게 했다. 같은 빌드에서 두 방식을 번갈아 재기 위한 임시 분기다.

```ts
// EXPERIMENT (not committed): `?hipsProxy=1` loads the tiles through /api/hips.
survey: new URLSearchParams(window.location.search).has("hipsProxy")
  ? `${window.location.origin}/api/hips/2mass-color`
  : SKY_SURVEY.hips,
```

Aladin Lite에는 절대 URL을 넘긴다. URL이 아닌 문자열은 HiPS ID로 보고 CDS 목록 서버에 조회하기 때문이다(CDS 장애 중).

## 적용 시 바꿀 점

- `?hipsProxy` 분기를 없애고 `app/_components/sky/constants.ts`의 `TWO_MASS_COLOR_SURVEY.hips`를 프록시 주소로 바꾼다(브라우저에서 절대 URL로 만든다).
- `Cache-Control`을 `no-store`에서 엣지 캐시(`public, s-maxage=…`)로 바꾼다. 타일은 바뀌지 않는 파일이다.
- 함수 리전과 `maxDuration`을 정한다.
- 화면의 출처 표시(크레딧)는 그대로 둔다. 타일 내용은 IRSA의 2MASS HiPS 그대로다.
- `docs/decisions.md` 기록, `docs/PLAN.md` 9장 갱신을 같은 커밋에서 한다.
