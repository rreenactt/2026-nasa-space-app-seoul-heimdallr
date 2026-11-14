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
| 2026-11-14 | ansirh | Claude Code | 3D 하늘 2단계 구현 (테스트 대상 핀·별자리 선·조준선, 클릭 시 분석 패널 껍데기, `?ra=&dec=&fov=` URL 상태), 테스트 대상 좌표 IRSA 조회 | `app/page.tsx`, `app/_components/sky/`, `docs/PLAN.md` | 허한결 지시, 검토 필요 |
| 2026-11-14 | ansirh | Claude Code | 3D 하늘 검색창 (테스트 대상 이름·좌표 입력), 조준선 확대 시 크기 갱신 수정 | `app/_components/sky/`, `docs/PLAN.md` | 허한결 지시, 검토 필요 |
| 2026-11-14 | rreenactt | Claude Code | Comet Breath 구현: 3I/ATLAS 관측 목록·DR1 대응 확인, S3 바이트 범위 읽기·RICE_1 해제, 측광·기간 합성 스펙트럼, 논문 방출률 정리(arXiv 본문 확인) | `app/_components/comet-breath/`, `app/_lib/comet/`, `app/api/comet/` | 김재현 지시, 검토 필요 |
| 2026-11-14 | rreenactt | Claude Code | Sky Time Machine 구현: 2MASS·WISE·NEOWISE·SPHEREx SIA2 검색, 공통 격자 재투영, WISE 통과별 중앙값 합성, Gaia 정렬 검증 | `app/_components/sky-time-machine/`, `app/_lib/sky/`, `app/api/sky/` | 김재현 지시, 검토 필요 |
| 2026-11-14 | rreenactt | Claude Code | Fake Planet Lab 구현: FLAGS 헤더 기반 비트 해석·레이어, 후보 점검 8종, 기록 JSON 내보내기 | `app/_components/fake-planet-lab/`, `app/_lib/fpl/`, `app/api/fpl/` | 김재현 지시, 검토 필요 |
| 2026-11-14 | rreenactt | Claude Code | 추가 분석 3개 구현 기록, 결정 #26–28 제안, `PLAN.md` 4·14장 갱신 | `docs/` | 김재현 지시, 검토 필요 |
| 2026-11-14 | ansirh | Claude Code | 3D 하늘을 Aladin Lite 하나(TAN 투영)로 통일해 둘러보기 ↔ 조준 전환 경계 제거, 별자리 선 캔버스 그리기, 결정 #29 기록 | `app/_components/sky/`, `docs/PLAN.md`, `docs/decisions.md` | 허한결 지시, 검토 필요 |
| 2026-11-14 | ansirh | Claude Code | 하늘 타일 로딩 원인 조사(Aladin 요청 취소·미러·연결 수 측정)와 타일 프록시 로컬 실험, 실험 기록 문서·측정 스크립트 작성 | `docs/experiments/2026-11-14-sky-tile-proxy/`, `docs/PLAN.md` | 허한결 지시, 검토 필요 |
| 2026-11-14 | rreenactt | Claude Code | Neighborhood in Motion 구현: Gaia DR3 근접 천체 조회·이름 확인, WISE 0855 문헌값(arXiv:1409.5899 표 확인), 3D 직선 운동 모델·불확실성 표본, 3D 지도·하늘 시점·SPHEREx 연결, 구현 기록 | `app/_components/neighborhood/`, `app/_lib/nim/`, `app/api/nim/`, `docs/analyses/neighborhood-in-motion.md` | 김재현 지시, 검토 필요 |
| 2026-11-14 | rreenactt | Claude Code | Sky Sonata 구현: 원본 픽셀 광원 검출, 고정 소리 규칙·공유 밝기 범위 A/B 비교, Web Audio 엔진, 키보드·화면 읽기 지원, 합성 연습, 구현 기록 | `app/_components/sky-sonata/`, `app/_lib/sonata/`, `docs/analyses/sky-sonata.md` | 김재현 지시, 검토 필요 |
| 2026-11-14 | rreenactt | Claude Code | 추가 분석 5개를 분석 패널 "Additional analyses" 토글에 연결(패널 지점을 초기 대상으로 전달), 홈 버튼 줄 제거, `?stm=`·`?sonata=` 호환, STM 링크를 표준 `/?ra=&dec=&fov=`로 변경 | `app/_components/analyses/`, `app/_components/sky/analysis-panel.tsx`, `app/_components/sky/sky-explorer.tsx`, `app/page.tsx`, `docs/analyses/` | 김재현 지시, 검토 필요 |
| 2026-11-14 | rreenactt | Claude Code | 분석 패널 블링크 뷰어(블링크·차분·합산, 검출기 칩, Gaia 겹쳐 보기)와 요약 구현, 노출 파장 추정·허용치 선택 계획 API, 결정 #30 제안 | `app/_components/blink/`, `app/_lib/blink/`, `app/api/blink/`, `app/_components/sky/analysis-panel.tsx`, `docs/` | 김재현 지시, 검토 필요 |
| 2026-11-14 | rreenactt | Claude Code | 분석 패널 로딩 화면(블링크 자료·방문별 Gaia를 다 받은 뒤 표시, 진행바), 추가 분석별 "Download data" 대기열·진행바·예상 시간·취소, 받은 자료로 바로 여는 "Open", 결정 #31 제안 | `app/_components/analyses/`, `app/_components/blink/`, `app/_components/sky/analysis-panel.tsx`, 각 분석 데이터 훅, `docs/` | 김재현 지시, 검토 필요 |
| 2026-11-14 | ansirh | Claude Code | 하늘 화면 넓은 시야에서 빈 곳 클릭 시 그 지점으로 2° 확대 이동 (분석 패널은 조준 시야에서 클릭), 이동·확대를 한 애니메이션으로 매 프레임 계산(van Wijk·Nuij 경로), 조준 사각형 크기를 매 프레임 맞춤 | `app/_components/sky/`, `docs/PLAN.md` | 허한결 지시, 검토 필요 |
| 2026-11-14 | ansirh | Claude Code | 하늘 화면 "분석할 곳" 목록(테스트 대상 + 움직임 후보 검토 순서·필터 구조)과 분석 패널 "다음" 버튼 | `app/_components/sky/`, `docs/PLAN.md`, `docs/decisions.md` | 허한결 지시, 검토 필요 |
| 2026-11-14 | ansirh | Claude Code | 하늘 조작(확대·축소 버튼, 시야 표시, 겹쳐 보기 켜고 끄기, 지금 보는 하늘 링크 `?view=`), 평가 안내 문구를 사실대로 수정, 방문 수 불일치 원인 분석(이슈 #7) | `app/_components/sky/`, `app/page.tsx`, `docs/` | 허한결 지시, 검토 필요 |
| 2026-11-14 | rreenactt | Claude Code | IRSA·S3 동시 요청 한계 측정(IBE 2개, SIA2·DataLink·S3 여유), WISE·NEOWISE를 AWS 공개 버킷에서 바이트 범위로 읽기(IBE 대체 경로), IBE 동시 2개 제한·빠른 재시도, NEOWISE 검색 TIME 8분할, FITS 헤더·DataLink 메모리 캐시, 추가 분석 동시 다운로드 | `app/api/sky/_server/archive.ts`, `app/_lib/comet/remote-fits.ts`, `app/api/comet/_server/irsa.ts`, `app/_components/analyses/`, `docs/` | 김재현 지시, 검토 필요 |
| 2026-11-14 | rreenactt | Claude Code | 분석 문서 6개를 구현 기준으로 재정리(무엇·왜·입력·방법·출력·한계·검증·코드·남은 일, 기본 분석 `basic-blink.md` 신설), 인수인계 문서, IRSA 동시 요청 측정 기록·스크립트 | `docs/analyses/`, `docs/memory/handoff/`, `docs/experiments/2026-11-14-irsa-concurrency/` | 김재현 지시, 검토 필요 |
| 2026-11-14 | rreenactt | Claude Code | 블링크 슬라이더 방문 번호 표시 수정(보이는 방문 기준 위치와 원래 방문 번호 분리, 요약에 프레임 없는 방문 수 표시) | `app/_components/blink/blink-viewer.tsx`, `docs/analyses/basic-blink.md` | 김재현 지시(팀원 보고 확인), 검토 필요 |
| 2026-11-15 | tnsgud9 | Claude Code | 끊어진 커밋(6072b33)의 Prisma 7 셋업 복원: `lib/db.ts`, Prisma 스키마·설정, 로컬 Postgres, 환경 변수, Prisma 에이전트 스킬, 결정 #33 기록 | `lib/db.ts`, `prisma/`, `prisma.config.ts`, `docker-compose.yaml`, `config/env.server.ts`, `.agents/skills/`, `.claude/skills/`, `docs/` | 이순형 지시, 검토 필요 |
| 2026-11-15 | ansirh | Claude Code | 하늘 화면 UI 개편: 레퍼런스 사이트 CSS 분석, Figma 시안 제작(figma-bridge, 인트로·액자 상태·검토 목록·시야별 후보 표시·밀도 4안 비교·후보 토글·단축키 안내, 상단 탭 3안 비교, About·Method 페이지 초안), 결정 #36–#40 기록 | Figma "HEIMDALLR UI" → "Sky screen · Directions", `docs/PLAN.md`, `docs/decisions.md` | 허한결 지시·결정, 검토 필요 |
| 2026-11-15 | ansirh | Claude Code | 하늘 화면 UI 개편 구현(결정 #36–#40): 머리 띠·3탭, 액자 상태, 오른쪽 도구 줄, About·Method 페이지, 검토 목록 패널·열람 기록, 시야 눈금, Show on sky·단축키·단축키 목록, 인트로, 시야별 후보 표시 구조(육각 밀도·묶음 원·상태 기호) | `app/_components/site/`, `app/_components/sky/`, `app/about/`, `app/method/`, `app/layout.tsx`, `app/shared.css`, `docs/` | 허한결 지시, 검토 필요 |
| 2026-11-15 | ansirh | Claude Code | 제출물 초안(요약·상세 설명·데이터·출처·AI 사용, 슬라이드 7장 목차), 감사 문구 공식 출처 조사, 마일스톤·산출물 일정 갱신 | `docs/submission/`, `docs/memory/milestones.md` | 허한결 지시, 검토 필요 |
