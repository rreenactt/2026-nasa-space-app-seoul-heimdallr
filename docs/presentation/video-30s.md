# 30초 시연 영상

> 제출 칸 Project Demonstration용. 규정: 슬라이드 7장 이하 또는 영상 30초 이하, 로그인 없이 열리는 공개 링크.
> 2026-11-15 허한결 요청으로 Claude Code가 녹화·카드·편집을 하고, 구성·대사·카드·음악은 허한결이 정했다. 유튜브 업로드는 허한결.
> 숫자는 모두 제출 원고(`docs/submission/summary.md`, `details.md`, `test-targets.md`)와 같은 값이다.

## 최종 구성 (30.0초, 900프레임)

| 시간 | 화면 | 대사 (TTS) |
| --- | --- | --- |
| 0–3.5초 | 앱: 은하 중심으로 확대 | SPHEREx scanned the whole sky. |
| 3.5–7.5초 | 앱: Epsilon Indi B 블링크 → Difference | Blink its images. Did something move? |
| 7.5–10.5초 | 카드: 2MASS 2000 → SPHEREx 2025, 25 years apart | Twenty-five years after 2MASS. |
| 10.5–13.5초 | 카드: 75,756곳 → 5,384짝 · 262 known · 41 unidentified | Forty-one candidates so far. |
| 13.5–20.5초 | 앱: 검토 목록 → 후보 J174146.9-293330 → 블링크 → Moving 클릭 → 집계("Needs ratings · 1 of 5") 확대 | Anyone can check them. Every rating updates the list. |
| 20.5–23.5초 | 앱: 추가 분석 5개를 0.6초씩 | Five more ways to look closer. |
| 23.5–26.5초 | 카드: Barnard's Star 10.39″/yr, Gaia DR3와 일치 | Measured. It matches Gaia. |
| 26.5–30초 | 마무리: HEIMDALLR / Sky Explorer Community for SPHEREx / URL / Team HEIMDALLR · Seoul · NASA Space Apps Challenge 2026 | HEIMDALLR. |

- 카드 디자인은 A(별 배경 + 넓은 자간 대문자, Matt Pealing "Atmosphere"·Vip Sitaraman "American Scientist" 참고)를 썼다. B(검은 대시보드 + 강조색 하나, TheMotionDot·Kyle Chaplin·George Railean 참고)와 비교해 골랐다.
- 음악: "Infographic Technology", The_Mountain (Pixabay Content License). 설명란에 곡명·작곡가·링크를 적었다. 후보였던 "Cinematic Trailer Daub", daub_audio는 쓰지 않음.
- 대사는 TTS(AI 음성)로 만들었고 유튜브 설명란에 밝혔다.
- 대본 첫 안에 있던 "Did something move?" 카드는 대사를 줄이면서 뺐고, 같은 질문을 블링크 장면 대사로 옮겼다.

## 녹화 방법과 지킨 것

- 앱 화면은 프로덕션 사이트를 실제 데이터로 녹화했다. 카드는 HTML/CSS 애니메이션을 프레임별로 찍어 만들었다.
- 블링크는 미리 계산해 둔 좌표(테스트 대상 핀, 조사 후보)만 썼다. 그 밖의 좌표는 IRSA가 502를 돌려줄 수 있다.
- 하늘 이동이 끊기지 않게, 같은 페이지에서 같은 경로를 먼저 한 번 날아 타일을 받아 둔 뒤 녹화했다(새로고침하면 타일을 다시 받는다).
- 평가 장면의 Moving 1건은 허한결이 정해 프로덕션에 실제로 넣었다(브라우저 1개, 다시 찍을 때도 같은 브라우저라 1건 그대로). 시연용 가짜 평가는 넣지 않았다(결정 #57, 절대 원칙 4).
- NASA 로고는 쓰지 않았다.

## 참고한 영상

- 느낌 기준: AGNI, "Know where, before it burns" (NASA Space Apps 2026, 30초) https://www.youtube.com/watch?v=5hC8s6jMZw4. 실제 앱 화면과 깔끔한 모션 카드를 2–4초마다 번갈아 보여 주고, 마지막은 이름·URL·팀·대회명.
- 같은 챌린지 경쟁작: Team Oblivion "SPHEREx Explorer" https://www.youtube.com/watch?v=lhi7lI8fvHg. 우리 차별점은 25년 비교, 조사 규모, 사람이 평가하는 구조, 측정 검증.
