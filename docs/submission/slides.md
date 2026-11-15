# Project Demo: 7-slide outline (draft)

> 제출 항목: Project Demo. **GIF를 넣은 슬라이드 7장(제목 장 포함)으로 정함 (결정 #46).** 외부에 올리고 공개 링크 1개를 낸다. 파일 업로드는 없다.
> 초안 2026-11-15 (Claude Code 작성, 사람 검토 전). 슬라이드 문구는 영어, 아래 메모는 한국어.
> 구조는 서울 D-Day 안내 PDF 20쪽의 권장 구성을 따른다. 심사 기준(`docs/memory/direction.md`): Impact, Creativity, Validity, Relevance, Presentation.

---

| # | 권장 구성 (PDF 20쪽) | Title (draft) | Message | Visual | 심사 기준 |
| --- | --- | --- | --- | --- | --- |
| 1 | 제목, 팀, 챌린지, 문제 | HEIMDALLR: watch the infrared sky change | Team HEIMDALLR · [TODO: 팀원 영문 이름 3명 — 김재현, 허한결, 이순형] · Challenge: Planet X and SPHEREx. Problem in one line: SPHEREx images the whole sky in 102 colors every six months, more than anyone can look through alone. | 하늘 화면 전체 + 팀 로고 (NASA 로고 금지, 절대 원칙 8) | Presentation |
| 2 | 문제와 사용자 | Finding what moves, the way Pluto was found | Same sky, different times: fixed stars stay, moving things jump. Tombaugh did this by eye in 1930; SPHEREx now gives the whole sky twice a year. Users: anyone curious, students, amateur astronomers, who have no tool to blink SPHEREx images today. | 블링크 GIF (Barnard's Star) | Relevance, Impact |
| 3 | 해결책과 핵심 기능 | Click anywhere, watch it move | Sky → zoom → click → blink, difference, stack. Coordinates in the URL for sharing. Five deeper analyses: Sky Time Machine (25 years), Fake Planet Lab, Neighborhood in Motion, Sky Sonata (accessibility), Comet Breath (3I/ATLAS). | 기능 흐름 4칸 + 분석 5개 아이콘 | Creativity |
| 4 | 화면과 사용 경험 | From the whole sky to one pixel in seconds | Smooth fly-to, square cursor the size of the cutout, places list with the five test targets, honest states ("comparable", "additional analysis needed", "no observations"). | 3D 이동 녹화 → 패널 열림 (짧은 GIF 2개) | Presentation |
| 5 | NASA·파트너 데이터 활용 | Built on NASA's SPHEREx DR1 | SPHEREx DR1 from IRSA (SIA2, DataLink, AWS byte-range reads, no FITS stored); 2MASS, WISE, NEOWISE for a 25-year baseline; ESA Gaia DR3 stars moved to each visit's date. How the data shaped the idea: six-month revisits made blinking possible, LVF filters forced same-wavelength comparison. | 데이터 흐름도 (IRSA → 컷아웃 → 블링크, Gaia 겹치기) | Relevance, Validity |
| 6 | 구현, 설계, 결과 | Doing it right, and tested on the challenge targets | Same detector and wavelength only, fixed sky grid, quality flags. Barnard's Star: 10.39″/yr measured = Gaia. What worked and what did not, for all five targets. | 비교 규칙 4칸 + 테스트 대상 검증 결과 표 | Validity |
| 7 | 기대 효과, 다음 단계, 출처 | Honest by design, and what's next | Candidates, never discoveries. Few visits today; more data and people checking make it stronger. Next: more SPHEREx visits, asteroid overlays. Site link, repo link, key credits (NASA/IPAC IRSA, ESA Gaia, CDS). | 한계 3줄 + 다음 계획 + 사이트 링크·QR + 출처 한 줄 | Impact |

## 메모

- 1장: 팀원 이름은 영어 표기를 각자 확인받아 넣는다. 지어내지 않는다.
- 6장의 테스트 대상 검증 결과 표는 `test-targets.md` 초안이 있다 (사람 검토 전). 내용이 많으면 검증 표를 우선하고 비교 규칙은 줄인다.
- "개발진이 후보를 분석·업데이트하고 사용자가 확인한다" 순환(기능 A·B)은 동결 시점 구현 범위에 따라 3장 또는 7장에 넣는다. 구현되지 않았으면 "다음 계획"으로만 말한다.
- PDF 32쪽: 완성하지 못한 부분도 설계와 이유를 보여주면 된다. 미구현 기능은 7장에 "다음 단계"로 솔직하게 적는다.
- 캡처는 프로덕션에서, 사전 저장된 테스트 대상 좌표로 찍는다 (IRSA 지연 대비).
- 숫자는 `details.md`와 같은 값만 쓴다.
- 링크는 로그아웃 상태(시크릿 창)에서 열리는지 확인한다. GIF가 재생되는 도구(예: Google Slides)를 쓴다.
