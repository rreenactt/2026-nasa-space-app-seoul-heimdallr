# Project Demo: 7-slide outline (draft)

> 제출 항목: Project Demo (슬라이드 7장, 공개 링크 1개). 초안 2026-11-15 (Claude Code 작성, 사람 검토 전).
> 13:00 "산출물 초안" 관문의 슬라이드 목차. 슬라이드 문구는 영어, 아래 메모는 한국어.
> 심사 기준(`docs/memory/direction.md`): Impact, Creativity, Validity, Relevance, Presentation.

---

| # | Title (draft) | Message | Visual | 심사 기준 |
| --- | --- | --- | --- | --- |
| 1 | HEIMDALLR: watch the infrared sky change | SPHEREx images the whole sky in 102 colors every six months — more than anyone can look through alone. HEIMDALLR lets anyone flip through it. | 하늘 화면 전체 + 로고 (NASA 로고 금지, 절대 원칙 8) | Presentation |
| 2 | Blink: how Pluto was found | Same sky, different times: fixed stars stay, moving things jump. We bring the 1930 method to SPHEREx. | 블링크 GIF (Barnard's Star) | Relevance |
| 3 | Click anywhere, watch it move | Sky → zoom → click → blink, difference, stack. Coordinates in the URL for sharing. | 3D 이동 녹화 → 패널 열림 (짧은 GIF 2개) | Creativity |
| 4 | Doing it right | Same detector and wavelength only (LVF), fixed sky grid, Gaia stars at each visit's date, quality flags. | 비교 규칙 도식 4칸 | Validity |
| 5 | Tested on the challenge targets | Barnard's Star: 10.39″/yr measured = Gaia. What worked and what did not, for all five targets. | 테스트 대상 검증 결과 표 | Validity |
| 6 | Five ways to look deeper | Sky Time Machine (25 years), Fake Planet Lab, Neighborhood in Motion, Sky Sonata (accessibility), Comet Breath (3I/ATLAS). | 분석 5개 화면 캡처 | Creativity, Impact |
| 7 | Honest by design, and what's next | Candidates, never discoveries. Few visits today; more data and people checking make it stronger. Link to the site. | 한계 3줄 + 다음 계획 + 사이트 링크·QR | Impact |

## 메모

- 5장은 테스트 대상 검증 결과 표(챌린지 필수, 아직 없음)가 나와야 완성된다.
- "Machines suggest, people check" 순환(기능 A·B)은 동결 시점 구현 범위에 따라 3장 또는 7장에 넣는다. 구현되지 않았으면 "다음 계획"으로만 말한다.
- 캡처는 프로덕션에서, 사전 저장된 테스트 대상 좌표로 찍는다 (IRSA 지연 대비).
- 숫자는 `details.md`와 같은 값만 쓴다.
