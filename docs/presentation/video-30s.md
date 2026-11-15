# 30초 시연 영상 대본 (초안)

> 제출 칸 Project Demonstration용. 규정: 슬라이드 7장 이하 또는 영상 30초 이하, 로그인 없이 열리는 공개 링크.
> 2026-11-15 허한결 요청으로 Claude Code가 작성. 장면·자막은 사람이 확정한다. 카드 디자인과 음악은 아직 고르는 중.
> 숫자는 모두 제출 원고(`docs/submission/summary.md`, `details.md`, `test-targets.md`)와 같은 값이다.

## 참고한 영상

- 느낌 기준: AGNI, "Know where, before it burns" (NASA Space Apps 2026, 30초) https://www.youtube.com/watch?v=5hC8s6jMZw4
  - 실제 앱 화면과 깔끔한 모션 그래픽 카드를 2–4초마다 번갈아 보여 준다.
  - 카드는 네모 블록 쌓기, 막대 타임라인, 올라가며 세어지는 큰 숫자로 데이터를 말한다.
  - 검증 근거를 숫자로 보여 준다("Blind test on 2025 data").
  - 팀 사진·말하는 사람·긴 자막 없이 짧은 단어만 쓴다. 마지막은 브랜드 색 화면에 이름, URL, 팀·대회명.
- 같은 챌린지 경쟁작: Team Oblivion "SPHEREx Explorer" https://www.youtube.com/watch?v=lhi7lI8fvHg (블링크, JPL 대조까지 보여 줌). 우리 차별점은 25년 비교, 조사 규모, 사람이 평가하는 구조, 측정 검증.
- 30초 영상 공통 구조: 훅(0–4초) → 맥락(3–5초) → 앱 시연(15–20초) → 마무리 카드(2–4초).

## 장면과 자막

| # | 시간 | 종류 | 화면 | 자막 (영어) |
| --- | --- | --- | --- | --- |
| 1 | 0–3초 | 앱 | 하늘 전체 화면이 은하 중심으로 천천히 확대 | The whole sky, in 102 colours of infrared. |
| 2 | 3–6초 | 카드 | 픽셀 격자 두 장이 번갈아 깜빡이고 점 하나만 이동 | Did something move? |
| 3 | 6–10초 | 앱 | 한 지점 클릭 → 블링크 재생, Gaia 예측 위치 겹침 | Blink real SPHEREx images. Same detector, same wavelength. |
| 4 | 10–13초 | 카드 | 타임라인 막대 "2MASS · 2000" → "SPHEREx · 2025", 사이에 "25 years" | 25 years apart. |
| 5 | 13–16초 | 카드 | 숫자 75,756 fields가 올라간 뒤 262 known moving stars · 41 unidentified candidates로 갈라짐 | 75,756 fields searched. |
| 6 | 16–21초 | 앱 | 검토 목록 → 후보 열기 → Moving 클릭 → 다른 사람들의 평가가 나타남 | We find candidates. You check them. |
| 7 | 21–24초 | 앱 | Sky Time Machine, Fake Planet Lab, Comet Breath를 1초씩 | 5 deeper analyses. |
| 8 | 24–27초 | 카드 | 큰 숫자 10.39″/yr | Barnard's Star, measured. Matches Gaia DR3. |
| 9 | 27–30초 | 마무리 | 이름과 정보 | HEIMDALLR / Sky Explorer Community for SPHEREx / 2026-nasa-space-app-seoul-heimdallr.vercel.app / Team HEIMDALLR · Seoul · NASA Space Apps Challenge 2026 |

- "102 colours"는 챌린지 소개문의 "102 bands of near-infrared light"에서 왔다.
- 5번은 발견이 아니라 candidates로 쓴다 (절대 원칙 1).
- NASA 로고는 쓰지 않는다. AI로 만든 이미지가 들어가면 워터마크를 넣는다 (절대 원칙 8).

## 카드 디자인 레퍼런스 (Dribbble, 고르는 중)

| 방향 | 레퍼런스 | 가져올 점 |
| --- | --- | --- |
| 어두운 우주 + 넓은 자간 글자 | Matt Pealing, Atmosphere infographic https://dribbble.com/shots/17936889-Atmosphere-infographic-print · https://dribbble.com/shots/17936877-Atmosphere-infographic-print | 별 배경 위 얇고 넓은 자간의 대문자, 높이를 눈금으로 표시 → 4번 타임라인 카드 |
| 과학 인포그래픽 | Vip Sitaraman, American Scientist Infographic https://dribbble.com/shots/14480269-American-Scientist-Infographic | 어두운 배경, 실제 천체 이미지 + 가는 선 주석 → 3·8번 |
| 선으로 그린 숫자 | Arseniy Mehovnikov, 2019 https://dribbble.com/shots/5810515-2019 | 외곽선 숫자의 입체 이동 → 5·8번 큰 숫자 |
| 패턴으로 채운 숫자 | Bas van Brandwijk, 36 Days of Type https://dribbble.com/shots/21466042-36-Days-of-Type-9 · https://dribbble.com/shots/21397069-36-Days-of-Type-0 | 숫자를 작은 점·선으로 채움 → 별·픽셀 느낌의 숫자 |
| 어두운 데이터 대시보드 모션 | TheMotionDot, Dashboard Animation https://dribbble.com/shots/27701094-Cybersecurity-Dashboard-Animation-Motion-Design-Data-Viz | 검은 배경 + 강조색 하나로 차트가 그려지는 움직임 |
| 관제실 UI | Kyle Chaplin, Colony OS https://dribbble.com/shots/27536241-Colony-OS-Reimagining-Mission-Control · George Railean, Satellite Orbit Dial https://dribbble.com/shots/27876420-Satellite-Tracking-Dashboard-Orbit-Dial-UI-Animation | 행성·궤도 위 데이터 표시 → 1·9번 |

## 음악 후보 (Pixabay, Pixabay Content License)

Pixabay 라이선스는 상업적 사용과 유튜브 업로드를 허용하고 출처 표기를 요구하지 않는다. 그래도 설명란에 곡명과 작곡가를 적는다. 유튜브 Content ID 경고가 붙으면 Pixabay 라이선스로 해제한다. 음악은 들어 보고 사람이 고른다.

| 곡 | 길이 | 느낌 (태그) | 링크 |
| --- | --- | --- | --- |
| Infographic Technology, The_Mountain | 1:38 | 모던 클래식, 인포그래픽·기술 | https://pixabay.com/music/modern-classical-infographic-technology-167600/ |
| Technology, AtlasAudio | 1:12 | 비트, 기술 (좋아요 12K) | https://pixabay.com/music/beats-technology-613340/ |
| Science - Science Music, JonasBlakewood | 1:03 | 코퍼레이트, 과학 (10K) | https://pixabay.com/music/corporate-science-science-music-562844/ |
| Minimal Ambient Technology, AleXZavesa | 1:44 | 앰비언트, 차분한 우주 | https://pixabay.com/music/ambient-minimal-ambient-technology-632734/ |
| Documentary - Technology, Cinematic-Soul | 2:53 | 다큐멘터리 비트 (7.4K) | https://pixabay.com/music/beats-documentary-technology-622736/ |
| Space, leberch | 2:40 | 앰비언트 SF (16K) | https://pixabay.com/music/ambient-space-626368/ |
| Cinematic Trailer Daub, daub_audio | 0:30 | 서스펜스 트레일러, 정확히 30초 | https://pixabay.com/music/suspense-cinematic-trailer-daub-168002/ |
