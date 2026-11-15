# 허한결 (`ansirh`) 현재 상태

> 본인 또는 본인의 AI만 고친다. 지난 작업은 쌓지 말고 최근 상태만 남긴다.
> 최종 갱신: 2026-11-15

## 담당

- 기획
- 3D 하늘 화면 (`app/_components/sky/`)
- 하늘 화면 UI 개편 (분석 패널 바깥, 디자인 정본 Figma "HEIMDALLR UI")

## 진행 중

- 검토 목록 선택과 열기 분리(결정 #49), 화면 중심 십자선(결정 #50) PR (`feat/web-design-fix` → `main`)
- 다음: 검토 목록에 실제 후보 연결(`MOVEMENT_CANDIDATES` ↔ `data/motion-candidates.ts`), 이어서 접힌 아래 막대·마우스 올림 이름표·"Most rated places" 위치를 Figma에 반영
- (실험) 하늘 화면 "빠르게 움직이는 별" 겹쳐 보기: 시야 1° 이하에서 Gaia DR3 고유운동으로 연도 슬라이더(1950–2050)에 맞춘 예상 위치·궤적 (브랜치 `feat/sky-fast-stars`, `main` 미반영). 이 브랜치의 결정 초안 번호 #35는 `main`의 #35(평가 저장 방식)와 겹치므로 반영할 때 번호를 다시 매긴다. 보기 좋지 않으면 통째로 뺀다

## 완료

- 검토 목록 선택과 열기 분리 (결정 #49): 행 클릭·`N` `P`는 선택하고 날아가기만, 하늘에 링과 ID·RA/Dec 이름표. `Enter`·Open blink·다시 클릭으로 연다. 목록을 접으면 선택 해제. 선택이 없으면 `Enter`는 화면 가운데 분석
- 화면 중심 십자선 (결정 #50): 5° 이하·액자 없음에서 가운데가 빈 십자선과 RA/Dec, `Enter` 키 표시
- Figma 정리: 현재 시안을 줄별(Explore, Review screens, Pages)로 배치하고 예전 시안은 "Sky screen · Archive" 페이지로 옮김. "nothing selected", "aiming (view center)" 프레임 추가
- 하늘 화면 UI 개편 2차 (PR #13, 결정 #47): Figma와 어긋난 곳 수정(시야 눈금, 검토 목록, Show on sky, 단축키 창, About 도식·히어로), 정보 도구 "This view"와 Menu 재구성, 이동 중 커서 좌표 갱신
- 하늘 화면 UI 개편 (PR #10, `main` 병합 fa402b4, 결정 #36–#40):
  - 상단 메뉴: Sky / About / Method 탭, About·Method 페이지
  - 액자: Figma "I · Frame states"의 6장면. 대상으로 이동할 때 흰 링을 띄우고, 착지한 뒤 분석 패널을 연다. 패널이 열리면 하늘을 45% 어둡게 한다
  - 오른쪽 도구 열, Show on sky 패널, `C` 토글
  - 검토 목록 패널, 열어 본 곳 기록, How to rate
  - FOV 눈금(바늘이 카메라를 프레임마다 따라감), 키보드 단축키와 도움말
  - 인트로: Figma "I · Intro 1–4" 그대로, 약 5.4초
  - 후보 표시 구조: 밀도 육각형 → 묶음 원 → 개별 기호
- 하늘 화면 기반 작업:
  - Aladin Lite 하나로 통일 ([결정 #29](../../decisions.md))
  - 클릭 지점으로 확대 이동 (PR #6)
  - "분석할 곳" 목록과 Next 버튼 ([결정 #32](../../decisions.md))
  - 지금 보는 하늘 링크 `?view=` ([결정 #34](../../decisions.md), PR #8)
- 방문 번호 불일치 원인 분석 → GitHub 이슈 #7 (김재현이 `fa6d16e`로 수정, 이슈는 열려 있음)
- 타일 프록시 로컬 실험 기록: [`docs/experiments/2026-11-14-sky-tile-proxy/`](../../experiments/2026-11-14-sky-tile-proxy/README.md)

## 막힘

- `/api/ratings`는 빌드할 때 `DATABASE_URL`이 필요하다. 로컬은 `.env`로 해결. Vercel에 이 변수가 있는지 이순형 확인 필요
- CDS 장애로 하늘 배경은 SPHEREx가 아닌 2MASS 임시 배경이다 ([결정 #25](../../decisions.md))
- 타일 프록시 적용은 배포 담당(이순형) 확인 필요 (`PLAN.md` 14장)
- 팀 결정 대기: 컷아웃 크기(#19, 챌린지 선택 4 "시야 크기 선택"과 직결), 추가 분석 결과 요약 줄, 3I/ATLAS 진입 위치, 이름 검색 대체, 기능 A 후보 파이프라인

## 다음 할 일

- 결정 #47 문서 PR 병합
- 1920px 화면 점검: 어긋나는 곳만 Figma에 1920 프레임을 만들어 고친 뒤 웹 반영
- 검토 목록에 실제 움직임 후보 연결 (`MOVEMENT_CANDIDATES` ← 결정 #41의 `MotionCandidate` DB)
- UI 개편에서 남은 것:
  - 후보 데이터 연결
  - 선택·호버 이름표
  - 접힌 하단 막대
  - 액자가 켜졌을 때 도구 열 옆 FOV 숫자
  - "Most rated places" 위치를 Figma에 넣기
- About 페이지의 SPHEREx 수치(발사 시기, 102색, 0.75–5 µm, 약 6개월 재방문)를 NASA·IRSA 자료로 확인
- 테스트 대상 5개 검증 결과 표 (챌린지 필수, 아직 없음)
- 빠른 별 실험 유지·제거 결정
- CDS 복구 시 `SKY_SURVEY`를 SPHEREx 컬러로 되돌리기
