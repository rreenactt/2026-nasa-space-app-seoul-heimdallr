# 프레젠테이션 원고

> 발표 7쪽의 내용 원고다. 쪽마다 파일 하나.
> 작성: 2026-11-15, Claude Code가 레포(`origin/main` 기준 코드와 `docs/`)를 읽고 정리했다. 사람 검토 전.
> 숫자와 사실은 모두 레포에 기록된 값만 썼다. 각 파일 끝의 "근거"에 출처 파일을 적었다.

| 쪽 | 파일 | 내용 |
| --- | --- | --- |
| 1 | [`01-intro-team.md`](01-intro-team.md) | 프로젝트 소개, 팀원 소개 |
| 2 | [`02-problem-solution.md`](02-problem-solution.md) | 챌린지가 제시한 문제, 우리의 해결책 |
| 3 | [`03-architecture.md`](03-architecture.md) | 아키텍처: 데이터, 서버, DB, 사용자, 기술, API |
| 4 | [`04-analysis-blink-time-machine.md`](04-analysis-blink-time-machine.md) | 분석 도구 ① Blink, ② Sky Time Machine |
| 5 | [`05-analysis-fake-planet-neighborhood.md`](05-analysis-fake-planet-neighborhood.md) | 분석 도구 ③ Fake Planet Lab, ④ Neighborhood in Motion |
| 6 | [`06-analysis-sonata-comet.md`](06-analysis-sonata-comet.md) | 분석 도구 ⑤ Sky Sonata, ⑥ Comet Breath |
| 7 | [`07-how-to-use-summary.md`](07-how-to-use-summary.md) | 이용 방법, 정리 |

## 발표 전에 사람이 확인할 것

레포만으로는 확정할 수 없어서 원고에 "확인 필요"로 적어 둔 항목이다.

1. **이순형의 담당 범위.** `docs/memory/status/tnsgud9.md`가 비어 있어 커밋 기록으로만 적었다 (1쪽).
2. **팀원 영문 이름 표기.** 레포에 없다. 슬라이드에 넣을 때 각자 확인한다 (1쪽).
3. **R2 사전 저장 상태.** 코드는 `main`에 있지만, 상태 문서(11/15 16:45)에는 "채우는 중"이고 Vercel에 `R2_*` 환경 변수 등록이 필요하다고 적혀 있다. 발표 시점에 프로덕션에서 동작하는지 확인한다 (3쪽).
4. **하늘 배경.** CDS 장애가 계속이면 배경은 SPHEREx가 아니라 2MASS다. 발표 당일 상태를 확인한다 (3쪽, 7쪽).
5. **테스트 대상 검증 표.** `docs/submission/test-targets.md`는 "사람 검토 전" 초안이다 (2쪽, 7쪽).
6. **결정 #30, #31, #41, #56**은 문서에 "제안(팀 확인 필요)"으로 남아 있다. 구현은 되어 있다.
7. **화면 문구는 영어가 기본**이다. 이 원고는 내부 문서 규칙에 따라 한국어로 썼고, 화면에 나오는 이름과 버튼은 영어 그대로 적었다.
