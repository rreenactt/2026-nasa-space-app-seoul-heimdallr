# 1쪽. 프로젝트 소개와 팀원 소개

## 프로젝트: HEIMDALLR

**NASA의 SPHEREx 전천 탐사 이미지에서 움직이는 천체 후보를 누구나 함께 찾고 확인하는 공개 웹 도구.**

- **대회:** NASA International Space Apps Challenge 2026, 서울 (11/14 09:00 – 11/15 23:59 KST)
- **챌린지:** Planet X and SPHEREx
- **사이트:** <https://2026-nasa-space-app-seoul-heimdallr.vercel.app/> (로그인 없음)
- **라이선스:** MIT

### 한 문장으로

3D 하늘을 둘러보다 한 지점을 클릭하면, 그 자리를 SPHEREx가 시간 차이를 두고 찍은 이미지가 블링크(번갈아 보기)로 재생된다. 고정된 별은 그대로 있고 움직인 천체만 자리를 옮긴다.

### 콘셉트: 기계가 후보를 찾고, 사람이 확인한다

1. **기계:** 사전 조사가 하늘에서 "움직임 후보"를 찾아 목록과 하늘 위 표시로 추천한다.
2. **사람:** 사용자가 블링크와 추가 분석으로 직접 보고 `Moving` / `Not moving` / `Noise or artifact` 중 하나로 평가한다.
3. **순환:** 평가가 쌓이면 후보의 상태가 바뀐다 (평가 부족 → 추천 유지 / 추천 제외 / 주목할 후보).

### 대상 사용자

1. 천문에 관심 있는 일반인과 학생
2. 시민과학 참여자
3. 빠르게 확인하고 싶은 연구자

### 하지 않는 주장

- Planet X를 발견했다고 말하지 않는다. 결과는 언제나 "후보"다.
- 자동 분류 정확도를 성과로 내세우지 않는다.
- 사람들의 평가는 과학적 확인이 아니라 "합의도"로 표시한다 (화면 문구: `Agreement, not a confirmed discovery`).

## 팀 HEIMDALLR

| 이름 | GitHub | 담당 |
| --- | --- | --- |
| 김재현 | `rreenactt` | 기본 분석(블링크)과 추가 분석 5개, 분석 패널의 데이터 계층, 움직임 후보 조사 파이프라인(SPHEREx × 2MASS)과 후보 DB, 사전 저장(Cloudflare R2) |
| 허한결 | `ansirh` | 기획, 3D 하늘 화면, 하늘 화면 UI 디자인과 개편 (Figma "HEIMDALLR UI"), 평가로 후보 상태 매기기 |
| 이순형 | `tnsgud9` | 프로젝트 초기 구성(Next.js, 디자인 시스템), CI와 Vercel 배포, Prisma + Neon DB 구성, 익명 평가 저장, R2 스토리지 모듈 **(확인 필요: 상태 문서가 비어 있어 커밋 기록으로 적음)** |

- 팀원 영문 이름 표기는 레포에 없다. 슬라이드에는 각자 확인한 표기를 넣는다.

### AI 사용

코드와 내부 문서 대부분을 Claude Code(Anthropic)의 도움으로 작성했다. 항상 팀원의 지시로 작업했고 팀이 검토했으며, 결정은 사람이 내렸다. 작업 기록은 `docs/memory/ai-usage.md`에 있다. AI가 만든 이미지·영상·소리·데이터를 관측 자료처럼 보여주지 않는다.

---

근거: `AGENTS.md`(프로젝트 맥락), `README.md`, `docs/memory/direction.md`, `docs/memory/status/*.md`, `docs/decisions.md` #57, `git log`(작성자별 커밋)
