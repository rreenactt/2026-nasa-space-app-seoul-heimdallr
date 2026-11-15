# 로컬 Figma Bridge 제작본 — 내용 대조

최신 제작본: 열려 있는 Figma Design 파일 `제목 없음`의 `HEIMDALLR / Hackathon presentation` 페이지.

이번 제작은 `127.0.0.1:3077`의 사용자 Figma Bridge만 사용했다. 공식 Figma MCP는 사용하지 않았다. 이 버전이 이번 요청의 완성본이며, 기존 공식 Slides 파일은 이전 버전이다.

1920×1080 프레임 7개. 모든 배경의 기본 그라데이션과 청록·보랏빛 radial gradient 값이 동일함을 검사했다. 텍스트 겹침·프레임 경계 초과·컨테이너 초과 검사 통과. 각 장을 이미지로 확인했다. 전체는 편집 가능한 네이티브 텍스트·벡터이고, 관측 이미지나 스크린샷을 합성하지 않았다.

## 1. HEIMDALLR / 01 / A moving sky. A shared search.

Figma node: `3:2`

INTRODUCTION

SOURCE / 01-intro-team.md

NASA SPACE APPS 2026   /   PLANET X AND SPHEREx   /   SEOUL

SCHEMATIC / NOT OBSERVATION DATA

A moving sky.
A shared search.

Explore SPHEREx images, inspect moving-object candidates,
and contribute your judgment. A public tool for everyone,
from curious students to citizen scientists and researchers.

MACHINES SUGGEST. PEOPLE REVIEW.

BUILT BY

rreenactt   /   ansirh   /   tnsgud9

No sign-in  ·  MIT licensed  ·  AI-assisted code and documentation; decisions and review by the team.

---

## 2. HEIMDALLR / 02 / A blink is a clue, not a conclusion.

Figma node: `3:49`

PROBLEM & APPROACH

SOURCE / 02-problem-solution.md

A blink is a clue,
not a conclusion.

THE COMPARISON PROBLEM

01   Match the wavelength.

SPHEREx wavelength varies across pixels.
Use the same detector and matched bands.

02   Keep the sky still.

Compare on a fixed 3′ sky grid, with
Gaia positions propagated to each epoch.

03   Give motion more time.

Pair SPHEREx (2025–26) with
2MASS (~2000): a ~25-year baseline.

FIRST SURVEY / 15 NOV 2026

75,756

sky positions examined  →  5,384 source pairs

262

Known movers

Gaia explains
both positions.

5,081

Gaia static

Chance pairs.
Excluded from review.

41

Unidentified

For human review.
Not discoveries.

4.3% median speed difference vs Gaia for known movers. Control set: 8/12 recovered; four misses remain unexplained.

The 41 unidentified pairs await human review. These counts do not establish classification accuracy or a discovery.

---

## 3. HEIMDALLR / 03 / Public data. A clear path to evidence.

Figma node: `3:106`

ARCHITECTURE

SOURCE / 03-architecture.md

Public data.
A clear path to evidence.

ARCHIVES → TYPESCRIPT ANALYSIS → THE BROWSER

01 / SOURCE

NASA / IPAC IRSA

SPHEREx DR1: SIA2 + AWS L2b
2MASS · WISE · NEOWISE
Gaia DR3 · JPL Horizons
3I/ATLAS observation list

02 / NEXT.JS ON VERCEL

Search. Plan. Cut out.

FITS, RICE and WCS in TypeScript.
Read only the required pixel ranges.
Strict validation for public APIs.

/api/blink/plan · /api/fpl/frame
/api/sky/* · /api/ratings

03 / PARTICIPATE

Explore. Inspect. Rate.

Aladin Lite sky exploration
Fixed-grid reprojection
Blink + five additional analyses
Anonymous review; no account

NEON / PRISMA

Candidates + ratings

Epoch-tagged candidates and ratings.
Linked by HEALPix order 11.

CLOUDFLARE R2

Precomputed responses

Live fallback on a cache miss.
Production coverage needs confirmation.

GITHUB ACTIONS

Survey + deployment

Survey metadata; raw FITS never stored.
Sky backdrop is navigation only.

---

## 4. HEIMDALLR / 04 / Time makes motion visible.

Figma node: `3:172`

TIME & MOTION

SOURCE / 04-analysis-blink-time-machine.md

Time makes motion visible.

One sky grid for recent visits. A longer baseline for slow motion.

01 / BLINK

Keep the sky fixed.

VISIT 1

VISIT 2

SCHEMATIC / NOT OBSERVATION DATA

Blink  /  Difference  /  Stack

Same detector; target wavelength within ±0.5 bandwidth.
Fixed 3′ × 3′ grid, shared display scale, zodiacal subtraction.
Gaia positions, quality flags and source links remain visible.

02 / SKY TIME MACHINE

Give motion 25 years.

10.39″/yr

Barnard's Star: 247.4″ over 23.81 years.
Consistent with Gaia DR3.

2MASS

~2000

WISE

2010

NEOWISE

2014–24

SPHEREx

2025–

Compare positions across missions, not brightness.
SPHEREx alone has ~9″ inter-visit position noise.

0 visits: no observations. 1 visit: additional analysis needed. Difference patterns may be artifacts; parallax can move a source outside the 3′ field.

---

## 5. HEIMDALLR / 05 / Separate a source from a convincing artifact.

Figma node: `3:255`

QUALITY & CONTEXT

SOURCE / 05-analysis-fake-planet-neighborhood.md

Separate a source
from a convincing artifact.

03 / FAKE PLANET LAB

Inspect the original pixels.

QUALITY

Flags + aperture signal-to-noise

SHAPE

PSF size, elongation and repeatability

CONTEXT

Matched wavelength + nearby bright stars

Unchecked items remain “Not checked”.
“No issue found” does not establish a real object.

04 / NEIGHBORHOOD IN MOTION

Place the movement in 3D.

21 nearby stars and brown dwarfs within ~3.6 pc.
Measured distances and motion, with explicit assumptions.

BARNARD'S STAR

1.155 pc

Closest approach: 11,736 CE (~3.77 ly).

SCHEMATIC / LINEAR-MOTION MODEL

Missing radial velocities are assumptions, not zeroes.
Long extrapolations are educational; Galactic gravity
and binary orbits are not modelled.

5,112 / 5,112 FLAG PIXELS MATCH IRSA

R Draconis: +0.62 ± 0.10 mag (4 matched pairs).
Jul → Oct 2025 dimming in relative annular flux.
The core is saturated; this is not total-source brightness.

---

## 6. HEIMDALLR / 06 / The sky, translated into sound and spectra.

Figma node: `3:314`

SOUND & SPECTRA

SOURCE / 06-analysis-sonata-comet.md

The sky, translated
into sound and spectra.

05 / SKY SONATA

Another way to compare.

A disclosed mapping from SPHEREx pixels to sound.
Sonification, not a recording from space.

x position

Stereo pan + timing

y position

Pitch

brightness

Volume

Matched-wavelength A/B data share one flux scale.
Keyboard control, text descriptions, mono mode,
and a permanent Stop control support comparison.

Synthetic practice is labelled. Human listening
verification is still required.

06 / COMET BREATH

3I/ATLAS, across two epochs.

Aug 1–15 / Dec 8–14, 2025. Epoch-specific positions,
DR1-verified pixels and period-composite spectra.

CO₂

CO

0.75 μm

4.26

4.65

BAND POSITIONS / NOT A MEASURED SPECTRUM

ONE FLAG, A 93% DIFFERENCE.

Masking OUTLIER suppressed measured CO₂ flux ~93%.
Keep it in the source aperture; mask it in the background.
This lesson also informs Blink and Fake Planet Lab.

No invented perihelion data. Fluxes lack distance correction.
Production rates are cited paper values, not our estimates.

LISSE ET AL. 2025/26 · arXiv:2512.07318; 2601.06759

---

## 7. HEIMDALLR / 07 / Your judgment belongs here.

Figma node: `3:378`

PARTICIPATION

SOURCE / 07-how-to-use-summary.md

Your judgment
belongs here.

A public workflow, from a place in the sky
to evidence you can inspect and share.

01

EXPLORE

Drag the sky or enter RA/Dec.

02

CHOOSE

Open a candidate or test target.

03

INSPECT

Blink; run additional analyses.

04

RATE + SHARE

Review, revisit, and copy the URL.

Moving / Not moving / Noise or artifact.
Rate before seeing others’ votes.
Agreement is not a confirmed discovery.

VALIDATION / FIVE REQUIRED TARGETS

Repository results; human review is pending.

Barnard's Star

LONG BASELINE

10.39″/yr over 23.81 years; consistent with Gaia DR3.

Epsilon Indi B

CONSISTENT

Seen in all 6 exposures (S/N 97–102); within 1.1″
of the predicted position.

WISE 0855−0714

REVIEW NEEDED

Weak D6 signal blends with a nearby star.
Not confirmed.

RW Aurigae

SATURATED CORE

Core saturated. No change found in matched-
wavelength relative annular flux.

R Draconis

RELATIVE FLUX

Core saturated; relative annular dimming of
+0.62 ± 0.10 mag (4 matched pairs).

TRY HEIMDALLR →

2026-nasa-space-app-seoul-heimdallr.vercel.app

NEXT / Review 41 candidates; investigate missed controls; add known-asteroid overlays. Live archive access can be slow.

## 제출 전 확인

- 원고의 다섯 테스트 결과는 사람 검토 전 상태다. 미확인 41개는 발견이 아니다.
- R2 프로덕션 사전 저장 범위, 하늘 배경의 실제 출처, Sky Sonata 청취 확인은 별도 확인 대상이다.
- 팀원의 미확정 영문 이름·담당 범위를 만들지 않고 GitHub 아이디를 썼다.
- 원고·앱 코드·개인 status·AI 사용 기록은 이번 디자인 제작에서 수정하지 않았다. 담당자의 status와 AI 사용 기록에 이번 로컬 Bridge 제작 내역을 추가할 것을 제안한다.

