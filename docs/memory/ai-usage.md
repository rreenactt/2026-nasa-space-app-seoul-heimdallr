# AI 사용 기록

> 대회 제출 페이지의 "Use of SI"(AI 도구 사용 내역)를 작성하기 위한 기록이다.
> AI로 코드·문서·이미지·데이터를 만들었으면 한 줄 추가한다. 최신 기록을 아래에 쌓는다.
>
> 대회 규정 요약:
> - 어떤 도구를 어디에 어떻게 썼는지 밝힌다.
> - AI로 만든 이미지·영상에는 눈에 보이는 워터마크를 넣는다.
> - AI로 만든 음성·코드·데이터는 설명문과 메타데이터에 생성 사실을 표시한다.
> - AI 생성물에 NASA 로고·깃발·미션 식별자를 넣지 않는다.

| 날짜 | 사람 | 도구 | 작업 | 생성물 위치 | 사람 검토 |
| --- | --- | --- | --- | --- | --- |
| 2026-11-14 | ansirh | Claude | 챌린지 분석, 기획 문서·공통 메모리 초안 작성 | `docs/`, `AGENTS.md`, `CLAUDE.md` | 허한결 검토 |
| 2026-11-14 | ansirh | Claude Code | 기획 문서 커밋, 문서 간 불일치 검토, 평가 선택지 이름 통일, MIT `LICENSE` 추가 | `docs/`, `LICENSE`, `README.md` | 허한결 지시, 검토 필요 |
| 2026-11-14 | ansirh | Claude Code | SPHEREx 방문 1회 상태를 "추가 분석 필요"로 바꾸고 평가 허용, 방문 개념 조사·설명 | `docs/` | 허한결 지시, 검토 필요 |
| 2026-11-14 | ansirh | Claude Code | 다른 탐사와의 비교 규칙 정리, 프레임 합산 조건·방문 1회 평가 집계 반영, `AGENTS.md` 원칙 4 수정 | `AGENTS.md`, `docs/` | 허한결 지시, 검토 필요 |
| 2026-11-14 | ansirh | Claude Code | Blink Arena 구조 검토, 추가 분석에서 빼고 보류 처리 | `docs/` | 허한결 지시, 검토 필요 |
| 2026-11-14 | ansirh | Claude | 비교 처리 시 신경써야 할 점 정리, 3D 하늘 구현 자료 조사와 추천안 작성 | `docs/PLAN.md`, `docs/decisions.md` | 허한결 지시, 검토 필요 |
| 2026-11-14 | ansirh | Claude Code | 3D 하늘 추천안 검토, 레포 구조·패키지 확인, 결정 사항(PC 전용, 오버레이 패널, URL 최소, 소행성 시점, 배경 저장, 시야 전환) 문서 반영 | `AGENTS.md`, `docs/` | 허한결 지시, 검토 필요 |
| 2026-11-14 | ansirh | Claude Code | 3D 하늘 1단계 구현 (천구 격자·시선 조작·커서 RA/Dec, Aladin Lite 자동 전환), 패키지 설치, Aladin Lite 이벤트 확인 | `app/page.tsx`, `app/_components/sky/`, `docs/` | 허한결 지시, 검토 필요 |
| 2026-11-14 | ansirh | Claude Code | CDS 장애 확인, 2MASS 대체 배경 생성 스크립트와 360° 배경 이미지 생성, 천구 텍스처·Aladin Lite 컨테이너 수정 | `scripts/sky-background/`, `public/sky/`, `app/_components/sky/`, `docs/` | 허한결 지시, 검토 필요 |
