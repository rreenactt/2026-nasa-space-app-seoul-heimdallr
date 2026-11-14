# 추가 분석 목록

분석 패널의 "추가 분석" 영역과 관련 화면에 들어갈 기법을 관리하는 곳이다. 모든 기법은 [기획서 6장의 공통 규칙](../PLAN.md#6-추가-분석)을 따른다.

## 기본 분석

분석 패널을 열면 항상 보이는 화면이다. 추가 분석은 아니지만 같은 형식으로 정리했다.

| ID | 이름 | 출력 종류 | 상태 | 담당 |
| --- | --- | --- | --- | --- |
| [`basic-blink`](basic-blink.md) | 블링크 · 차분 · 합산 | view, overlay, text | 1차 구현 | 김재현 |

## 목록

| ID | 이름 | 출력 종류 | 최소 SPHEREx 방문 | 적용 대상 | 화면 배치 | 난이도 | 상태 | 담당 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [`sky-time-machine`](sky-time-machine.md) | Sky Time Machine | view, overlay | 1 | 모든 좌표 | 추가 분석 목록 | 중 | 1차 구현 | 김재현 |
| [`fake-planet-lab`](fake-planet-lab.md) | Fake Planet Lab | overlay, text | 1 | 모든 좌표 | 추가 분석 목록 | 중 | 1차 구현 | 김재현 |
| [`neighborhood-in-motion`](neighborhood-in-motion.md) | Neighborhood in Motion | view | 1 | 약 3.6 pc 안 천체 21개 | 추가 분석 목록 | 중 | 1차 구현 | 김재현 |
| [`sky-sonata`](sky-sonata.md) | Sky Sonata | audio | 1 | 모든 좌표 | 추가 분석 목록 | 하 | 1차 구현 | 김재현 |
| [`comet-breath`](comet-breath.md) | Comet Breath | view, chart | - | 3I/ATLAS만 | 추가 분석 목록 (특별 핀 권장) | 중 | 1차 구현 · 배치 논의 | 김재현 |

- **ID:** 영문 소문자와 하이픈. URL·캐시·파일 이름에 그대로 쓰인다.
- **출력 종류:** `overlay` (이미지 위 표시), `chart` (그래프), `text` (판정 문장), `audio` (소리), `view` (뷰어 모드 전환이나 별도 화면). 여러 개 가능.
- **상태:** `조사 중` → `확정` → `구현 중` → `1차 구현` → `완료` (보류는 `보류`)
- **문서 구성:** 각 문서는 무엇을 알려주나(1) · 왜 필요한가(2) · 입력 데이터(3) · 방법(4) · 출력(5) · 한계(6) · 검증(7) · 코드(8) · 남은 일(9) 순서다.

## 배치 논의가 필요한 기법

- **Comet Breath:** 3I/ATLAS 전용 데이터셋으로만 동작한다. 추가 분석 목록에 두면 대부분의 좌표에서 비활성화되므로, 하늘에 3I/ATLAS 특별 핀을 두고 그 핀에서 진입하는 방식을 권장한다.

## 보류 (추가 분석 아님, 기본 구현에서 제외)

| ID | 이름 | 이유 |
| --- | --- | --- |
| [`blink-arena`](blink-arena.md) | Blink Arena | 좌표 하나가 아니라 여러 후보 카드를 연속으로 판정하는 웹 게임. 시간이 남으면 붙이는 선택 기능 |

## 새 기법 추가 방법

1. [`_template.md`](_template.md)를 복사해 `<ID>.md`로 저장한다.
2. 템플릿 항목을 채운다. 모르는 항목은 "미정"으로 둔다.
3. 위 목록 표에 한 줄 추가한다.
4. 상태가 바뀔 때마다 표를 갱신한다.

## 출처

기법 선정: 팀 아이디어 쇼케이스 문서 "Planet X and SPHEREx 해커톤 프로젝트 아이디어 13선" 중 6개. 이 중 Blink Arena는 추가 분석이 아니라서 목록에서 뺐다 (아래 "보류").
