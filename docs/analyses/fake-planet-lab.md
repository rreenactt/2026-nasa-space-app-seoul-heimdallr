# Fake Planet Lab (가짜 행성 해부실)

| 항목 | 내용 |
| --- | --- |
| ID | `fake-planet-lab` |
| 상태 | 확정 · **1차 구현됨** (분석 패널 토글에서 열림) |
| 담당 | 김재현 (`rreenactt`) |
| 출력 종류 | overlay, text |
| 최소 SPHEREx 방문 횟수 | 1 |
| 적용 대상 | 모든 좌표 |
| 화면 배치 | 추가 분석 목록 |
| 난이도 | 중 |
| 예상 소요 시간 | 미정 |

## 1. 무엇을 알려주나

"행성처럼 보이지만 아닌 것"을 보여준다. 우주선 흔적, 유령상, 포화, 잔상을 레이어로 켜고 끄며, 후보가 오탐일 가능성을 체크리스트로 알려준다.

## 2. 왜 필요한가

대부분의 Planet X 프로젝트가 건너뛰는 검증 단계를 사용자에게 보여준다. 평가의 "잡음·결함" 판단에 직접 쓰이고, 기능 A 후보와 다른 분석의 품질 관문으로 재사용할 수 있다.

## 3. 입력 데이터

- 기본 분석 결과: 방문별 컷아웃
- SPHEREx 스펙트럼 이미지 MEF의 플래그·분산 확장
- Gaia DR3 밝은 별 목록 (포화·유령상 원인 확인)

## 4. 방법

1. 컷아웃의 픽셀 상태 플래그와 분산 확장을 레이어로 만든다.
2. 레이어를 우주선 흔적 / 유령상 / 포화 별 / 잔상으로 나눈다.
3. 후보 위치에 각 원인이 겹치는지 확인해 "가짜일 가능성" 체크리스트를 만든다.

## 5. 출력

- **한 줄 요약 예시:** "오탐 원인 0개 · 신뢰도 높음" / "포화 별 근처 · 주의"
- **판정 표시:** 원인 없음 `ok`, 원인 1개 이상 `warn`
- **overlay:** 원인별 레이어 (켜고 끄기 가능)
- **text:** 후보별 체크리스트

## 6. 실행 조건과 한계

- 플래그가 모든 오탐을 잡지는 못한다. "원인 없음"이 "진짜"를 뜻하지는 않는다고 표시한다.
- 대표 오탐 사례 갤러리(교육용)는 시간이 남으면 추가한다.

## 7. 검증

밝은 테스트 대상(Barnard's Star 등) 주변에서 포화·유령상 레이어가 제대로 표시되는지 확인한다.

## 8. 참고 자료

- 출처: 팀 아이디어 쇼케이스 문서
- [SPHEREx 데이터 제품](https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-products/)

## 9. 구현 기록 (2026-11-14)

- **위치:** 분석 패널 오른쪽 "Additional analyses"의 토글 (`app/_components/analyses/additional-analyses.tsx`). 패널의 ra/dec·대상 이름·출처를 초기 대상으로 받아 열린다. (`app/_components/fake-planet-lab/`)
- **데이터:** IRSA SIA2(`spherex_dr1`)로 좌표를 덮는 노출을 찾고, DataLink로 확인한 L2b 파일에서 필요한 행만 HTTP 바이트 범위로 읽는다(AWS 공개 버킷 우선). IMAGE·FLAGS(RICE_1 압축 해제)·VARIANCE·ZODI·WCS-WAVE를 쓴다. 원본은 저장하지 않는다.
- **플래그 해석:** 비트 번호를 하드코딩하지 않고 파일 헤더의 `MSKNnnnn`/`MSKDnnnn`에서 이름·설명을 읽는다. 분류: 측정 제외(NONFUNC·MISSING_DATA·HOT·COLD·SUR_ERROR), 오염 경고(포화·우주선·유령상·잔상·누화·줄무늬), 맥락(OUTLIER), 정보(SOURCE·FULLSAMPLE·DICHROIC·PHANMISS), 해석 미지원(그 밖). 한 픽셀의 여러 비트를 모두 풀어 보여준다.
- **OUTLIER는 결함으로 치지 않는다.** SPHEREx 파이프라인은 기준 하늘과 다른 픽셀을 OUTLIER로 표시해서, 움직이는 천체(예: 3I/ATLAS 코마 중심)도 여기에 걸린다. 측정 원에서는 가리지 않고 "자세히 보기"로만 쓴다.
- **표시:** 같은 하늘 격자(4′, 북쪽 위)에 최근접 방식으로만 옮긴다. 화면 픽셀마다 원본 픽셀 번호를 추적할 수 있고, 플래그 비트가 섞이지 않는다. 화면은 IMAGE − ZODI, 표시 중인 모든 방문에 같은 스트레치. 레이어는 색으로만 덮고 영상을 지우지 않는다.
- **점검(원본 픽셀에서 계산):** 자료 유효성, 후보 위·주변 6px의 품질 플래그, cutout 가장자리와 검출기 가장자리 구분, 2px 조리개 S/N(VARIANCE + 배경 오차), PSF 대비 크기·늘어짐(S/N ≥ 10, 2σ 픽셀, 픽셀화 보정), 다른 독립 노출에서의 반복, 비교 조건(검출기·대역폭 내 파장·시간), Gaia DR3 밝은 별(G < 10, 2′, 관측 시점으로 고유운동 이동).
- **판정:** `Quality issue found` / `Needs further review` / `No issue found in current checks`. 항목별 `Issue`·`Caution`·`OK`·`Info`·`Not checked`. 점검하지 않은 항목은 통과로 표시하지 않는다. 5장의 `ok`/`warn` 표기와 맞추는 일은 패널 통합 때 정한다.
- **기록:** 후보 좌표, 관측 ID, 항목별 결과, 사용자 판정(`Moving` / `Not moving` / `Noise or artifact`), 메모, 원본 URL·읽은 범위·규칙 버전(`fpl-checks-1`)을 브라우저 탭에 쌓고 JSON으로 내려받는다. 서버에 저장하지 않는다.
- **검증:** Barnard's Star(2025 위치) 중심에서 BLOOM·OVERFLOW·TRANSIENT·SUR_ERROR가 잡혀 `Quality issue found`. 밝은 별 점검이 이 별 자체(G 8.2, 1.9″)를 찾음. 네 비트가 겹친 픽셀(TRANSIENT+SUR_ERROR+NONFUNC+SOURCE)을 정확히 해석. 주변 밝은 별 4개의 크기 7.4–11.0″ (PSF 7.4″) → 점광원으로 판정.
- **안 한 것:** 합성 연습 사례·실제 사례 갤러리, PSF 모델 기반 형태 점검, 자동 후보 제안.
