# IRSA·S3 동시 요청 한계 측정 (2026-11-14, rreenactt)

> 상태: **측정 완료, 코드에 반영함** (WISE·NEOWISE S3 읽기, IBE 동시 2개 제한, NEOWISE 검색 TIME 분할).
> 측정 위치: 한국 가정용 회선, Node 25. 프로덕션(Vercel iad1)과 지연·대역폭이 다르다.

## 한 줄 요약

IRSA IBE 잘라내기만 클라이언트당 동시 2개 제한이 있다. SIA2·DataLink·AWS S3는 측정 범위에서 제한이 없었다. 그래서 WISE·NEOWISE를 같은 파일의 S3 사본에서 읽고, NEOWISE 검색을 기간 8개로 나눠 동시에 보내 Sky Time Machine이 약 90초 → 48초로 줄었다.

## 측정 결과

| 대상 | 동시 요청 | 결과 |
| --- | --- | --- |
| IBE 잘라내기 (NEOWISE) | 1 / 4 / 8 / 16 | 200 1 / 200 2·503 2 / 200 2·503 6 / 200 2·503 14 — **항상 2개만 성공**, 503은 0.4초 안에 옴 |
| SIA2 검색 | 1 / 4 / 8 | 모두 200 (중앙값 2–3초, 한 번은 23.7초) |
| DataLink | 1 / 4 / 8 / 16 | 모두 200 (0.7–1.8초) |
| S3 `nasa-irsa-spherex` 64 KB 범위 | 5 / 10 / 20 / 40 / 80 | 모두 206 (80개 3.7초) |
| S3 `nasa-irsa-wise` 헤더 범위 | 16–20 | 모두 206 (0.3–0.8초) |
| IRSA IBE 파일 범위 읽기 (잘라내기 아님) | 1 / 4 / 8 | 모두 206 |

| NEOWISE SIA2 (Barnard's Star, 반경 0.094°) | 시간 | 행 수 |
| --- | --- | --- |
| 한 번 | 24.9초 | 7,210 |
| `TIME` 4구간 동시 | 8.3초 | 7,210 |
| `TIME` 8구간 동시 | 5.3초 | 7,210 |

## 알게 된 것

- WISE·NEOWISE L1b는 IRSA AWS 공개 버킷 `nasa-irsa-wise`(us-west-2)에 있다. 키는 IBE 경로에서 `images/`가 끼어든 형태다. 예: `ibe/data/wise/neowiser/p1bm_frm/4a/...` → `wise/neowiser/images/p1bm_frm/4a/...`, `cryo_3band/3band_p1bm_frm` → `wise/cryo-3band/images/3band_p1bm_frm`.
- L1b `-int-1b.fits`는 압축 없는 float32 1016×1016, HDU 하나, 헤더 약 37 KB(`MAGZP`·`MJD_OBS`·SIP 포함).
- SIA2 CSV의 `cloud_access` 값은 따옴표 없이 쉼표가 든 JSON이라 CSV로 그대로 파싱하면 깨진다. 그래서 코드는 이 열을 읽지 않고 경로 규칙으로 키를 만든다.
- IBE 잘라내기는 원본 WCS를 그대로 두고 `CRPIX`만 옮긴다. S3 행 읽기도 같은 방식이라 위치 결과가 같다.
- SPHEREx L2b HDU 순서: PRIMARY(2,880) → IMAGE(헤더 23,040, 데이터 16.6 MB) → FLAGS(압축, 파일마다 다름) → VARIANCE → ZODI → EPSF → WCS-WAVE. 헤더를 따라가려면 왕복 6–7번이 필요하다.

## 재현

```sh
node irsa-limit.mjs ibe 1,4,8,16   # IBE 잘라내기
node irsa-limit.mjs sia 1,4,8      # SIA2
node s3-limit.mjs                  # SPHEREx S3·IRSA 파일 범위 읽기 (DataLink 측정 부분은 첫 측정 뒤 뺐음)
node wise-s3.mjs                   # WISE S3 키·동시 읽기
node stm-time.mjs http://localhost:3000 8   # 앱의 Sky Time Machine 전체 시간 (서버 실행 필요)
node cmp.mjs                       # IBE 잘라내기와 S3 프레임 헤더 비교
```

IRSA에 요청을 많이 보내므로 필요할 때만 돌린다.
