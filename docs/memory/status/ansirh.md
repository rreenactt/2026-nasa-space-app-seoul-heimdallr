# 허한결 (`ansirh`) 현재 상태

> 본인 또는 본인의 AI만 고친다. 지난 작업은 쌓지 말고 최근 상태만 남긴다.
> 최종 갱신: 2026-11-15

## 담당

- 기획
- 3D 하늘 화면 (`app/_components/sky/`)
- 하늘 화면 UI 개편 (분석 패널 바깥, 디자인 정본 Figma "HEIMDALLR UI")

## 진행 중

- 검토 목록에 실제 움직임 후보 연결 (로컬 브랜치 `fix/ui-candidates`, 작업 폴더 `ui-fix`, 원격 미푸시)
- 검토 목록 행 고르기와 열기 분리 (로컬 브랜치 `feat/web-design-fix`, 작업 폴더 `ui`, 원격 미푸시)

## 완료

- Star guide (PR #15, 결정 #48): 오른쪽 도구 줄 토글. 고유운동 0.2″/년 이상 Gaia DR3 별 70,254개 정적 목록(`public/data/gaia-fast-stars.json`, `scripts/fast-stars-catalog.ts`)에서 화면 안 별을 매 프레임 골라 배경 위치 사각형, 2026년 위치까지 이동선, 빠른 5개에 지시선 설명을 그림. 나타남·사라짐 애니메이션, 왼쪽 아래 안내 카드(누르면 그 별로 이동). 화면 그림 측정 시안과 별도 실험 브랜치 `feat/sky-fast-stars`(빠른 별 겹쳐 보기)는 쓰지 않기로 하고 삭제
- 테스트 대상 측정 실패 원인 분석 → GitHub 이슈 #12 (WISE 0855 노출·검출기·Gaia 겹침, RW Aur 포화 중심 픽셀, R Dra 포화). 분석 코드는 김재현 담당이라 바꾸지 않고 추가형 개선만 제안
- 제출물 초안·README·테스트 대상 기록 (PR #11), 결정 #47 기록 (PR #14)
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

- 1920px 화면 점검: 어긋나는 곳만 Figma에 1920 프레임을 만들어 고친 뒤 웹 반영
- UI 개편에서 남은 것:
  - 선택·호버 이름표
  - 접힌 하단 막대
  - 액자가 켜졌을 때 도구 열 옆 FOV 숫자
  - "Most rated places" 위치를 Figma에 넣기
- About 페이지의 SPHEREx 수치(발사 시기, 102색, 0.75–5 µm, 약 6개월 재방문)를 NASA·IRSA 자료로 확인
- 테스트 대상 검증 결과 표 확정 (초안 `docs/submission/test-targets.md`, 실패 원인은 이슈 #12)
- 프로덕션에서 Star guide 확인 (토글, 빠른 이동, 10° 넘게 축소 후 다시 확대, 카드 행 클릭)
- `AGENTS.md` 구조 표에 `public/`(정적 데이터) 추가를 팀에 제안
- CDS 복구 시 `SKY_SURVEY`를 SPHEREx 컬러로 되돌리기
