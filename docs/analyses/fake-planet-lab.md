# Fake Planet Lab (가짜 행성 해부실)

| 항목 | 내용 |
| --- | --- |
| ID | `fake-planet-lab` |
| 상태 | **1차 구현됨** (분석 패널 "Additional analyses"에서 열림) |
| 담당 | 김재현 (`rreenactt`) |
| 출력 종류 | overlay, text |
| 최소 SPHEREx 방문 횟수 | 1 |
| 적용 대상 | 모든 좌표 |
| 화면 배치 | 추가 분석 목록 → "Download data" → "Open" |
| 데이터 | IRSA SPHEREx DR1, AWS L2b 바이트 범위, Gaia DR3 |

## 1. 무엇을 알려주나

"움직이는 점처럼 보이지만 실제로는 결함인 것"을 가려낸다. 사용자가 고른 점에 대해 품질 플래그(우주선 흔적, 포화, 유령상, 잔상 등), 신호 대 잡음비, 모양(PSF 대비 크기), 다른 노출에서의 반복, 근처 밝은 별을 점검하고 항목별 결과를 체크리스트로 보여준다.

## 2. 왜 필요한가

- 대부분의 "새 천체 발견" 주장은 검출기 결함에서 나온다. 이 점검이 없으면 블링크에서 깜빡이는 점을 그대로 후보로 믿게 된다.
- 사용자 평가의 세 선택지 중 "Noise or artifact"를 판단하는 근거를 준다. 다른 분석(Neighborhood in Motion의 SPHEREx 비교, Sky Sonata)도 이 코드를 그대로 쓴다.

## 3. 입력 데이터

- IRSA SIA2(`spherex_dr1`)로 좌표를 덮는 노출 목록
- DataLink로 확인한 L2b 파일에서 필요한 행만: IMAGE, FLAGS(RICE_1 압축), VARIANCE, ZODI, WCS-WAVE (AWS 공개 버킷 우선)
- Gaia DR3 밝은 별 (G < 10, 반경 2′, 관측 시점으로 고유운동 이동)
- 원본은 저장하지 않는다.

## 4. 방법

1. **노출 고르기:** 기본으로 서로 다른 방문의 노출 최대 3장을 고른다. 사용자가 바꿀 수 있다.
2. **플래그 해석:** 비트 번호를 코드에 박지 않고 파일 헤더의 `MSKNnnnn`(이름)·`MSKDnnnn`(설명)에서 읽는다. 분류:
   - 측정 제외: NONFUNC, MISSING_DATA, HOT, COLD, SUR_ERROR
   - 오염 경고: 포화, 우주선, 유령상, 잔상, 누화, 줄무늬
   - 맥락: OUTLIER (결함으로 치지 않음, [결정 #28](../decisions.md))
   - 정보: SOURCE, FULLSAMPLE, DICHROIC, PHANMISS
   - 해석 미지원: 그 밖 (모르는 비트는 모른다고 표시)
3. **화면:** 같은 하늘 격자(4′, 북쪽 위)에 최근접 방식으로만 옮겨, 화면 픽셀마다 원본 픽셀 번호를 따라갈 수 있고 플래그 비트가 섞이지 않게 한다. 화면은 IMAGE − ZODI, 모든 방문에 같은 스트레치. 레이어는 색으로만 덮고 영상을 지우지 않는다.
4. **점검 (모두 원본 픽셀에서 계산):**
   - 자료 유효성, 후보 위·주변 6px의 품질 플래그
   - 잘라낸 가장자리와 검출기 가장자리 구분
   - 2px 조리개 S/N (VARIANCE + 배경 오차)
   - PSF 대비 크기·늘어짐 (S/N ≥ 10일 때, 2σ 픽셀, 픽셀화 보정)
   - 다른 독립 노출에서도 보이는지
   - 비교 조건 (같은 검출기, 대역폭 안 파장, 시간)
   - Gaia 밝은 별 근처인지 (유령상·포화 번짐 원인)
5. **판정:** `Quality issue found` / `Needs further review` / `No issue found in current checks`. 항목별 `Issue`·`Caution`·`OK`·`Info`·`Not checked`. 점검하지 않은 항목은 통과로 표시하지 않는다.
6. **기록:** 후보 좌표, 관측 ID, 항목별 결과, 사용자 판정(`Moving` / `Not moving` / `Noise or artifact`), 메모, 원본 URL·읽은 범위·규칙 버전(`fpl-checks-1`)을 브라우저 탭에 쌓고 JSON으로 내려받는다. 서버에는 저장하지 않는다.

## 5. 출력

- **overlay:** 원인별 플래그 레이어 (켜고 끄기)
- **text:** 항목별 체크리스트와 종합 판정, 픽셀을 누르면 그 픽셀의 모든 비트 설명
- **기록:** JSON 내려받기

## 6. 한계와 주의

- 플래그가 모든 결함을 잡지는 못한다. "No issue found"는 "진짜 천체"라는 뜻이 아니라고 화면에 적는다.
- OUTLIER는 움직이는 천체에도 붙으므로 결함 근거로 쓰지 않는다.
- PSF 모델 기반 형태 점검, 합성·실제 사례 갤러리, 자동 후보 제안은 없다.

## 7. 검증

- Barnard's Star(2025 위치) 중심: BLOOM·OVERFLOW·TRANSIENT·SUR_ERROR가 잡혀 `Quality issue found`. 밝은 별 점검이 이 별 자체(G 8.2, 1.9″)를 찾음.
- 네 비트가 겹친 픽셀(TRANSIENT+SUR_ERROR+NONFUNC+SOURCE)을 정확히 풀어 보임.
- 주변 밝은 별 4개의 크기 7.4–11.0″ (PSF 7.4″) → 점광원으로 판정.
- FLAGS 압축 해제를 IRSA 잘라내기와 대조해 5,112픽셀 일치.

## 8. 코드와 참고 자료

- 서버: `app/api/fpl/search`, `app/api/fpl/frame`, `app/api/fpl/neighbors`
- 화면·점검: `app/_components/fake-planet-lab/`, `app/_lib/fpl/`
- FITS 읽기: `app/_lib/comet/remote-fits.ts`, `app/_lib/comet/rice.ts`
- [SPHEREx 데이터 제품 (플래그 정의)](https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-products/)

## 9. 남은 일

- 판정 표기를 `PLAN.md` 5장의 `ok`/`warn`과 맞추기
- 블링크 뷰어 위에 오탐 레이어를 겹쳐 보기(5장 `overlay` 배치)
