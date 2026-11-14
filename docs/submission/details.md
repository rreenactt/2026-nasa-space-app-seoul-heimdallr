# Project Details (draft)

> 제출 항목: Project Details (작동 방식, 설계 이유, 도구, 한계, 다음 계획). 초안 2026-11-15 (Claude Code 작성, 사람 검토 전).
> 근거: `docs/PLAN.md`, `docs/analyses/*.md`(검증 절), `docs/decisions.md`. 숫자는 문서에 기록된 값만 썼다.
> 기능 동결(15:00) 뒤 실제로 들어간 기능에 맞춰 `[TODO]`를 채우거나 지운다.

---

## What it does

HEIMDALLR lets anyone look for things that move or change in NASA's SPHEREx all-sky survey, the way Clyde Tombaugh found Pluto: by flipping between images of the same sky taken at different times.

1. **Explore the sky.** A full-screen sky view (Aladin Lite, perspective projection from 120° down to a few arcminutes) shows the current RA/Dec under the cursor. One click on the wide view flies there; a list of places to analyze (the five challenge test targets, later movement candidates) takes you straight to a target.
2. **Pick a point.** Once zoomed in, the cursor becomes a square the size of the analysis cutout. Clicking it, or typing coordinates, opens the analysis panel and puts the point in the URL (`/?ra=&dec=&fov=`) so it can be shared or embedded.
3. **Watch it change.** The panel plays SPHEREx DR1 images of that patch, one per visit (about six months apart), as a blink animation, with a difference view (later visit minus first) and a stack (average) view.
4. **Check what you see.** Gaia DR3 stars, moved to each visit's date, are drawn on the images; quality flags at the point are listed; every frame links to its IRSA original.
5. **Go further (optional).** Five additional analyses open from the same panel (below).

## How it works

- **Finding exposures.** IRSA's SIA2 service returns every DR1 science exposure that covers the point. Exposures closer than 20 days are grouped into one visit.
- **Same detector, same wavelength.** SPHEREx uses linear variable filters, so the wavelength changes across each image. We estimate the wavelength at the target pixel from each exposure's footprint and the detector's wavelength table (error about 0.001 µm), keep only exposures within ±0.5 × the local bandwidth of one reference wavelength, and re-check the wavelength in each file we read. Mixing wavelengths would make brightness differences look like change.
- **Fixed sky grid.** Every frame is resampled onto the same 3′ × 3′ grid centered on the input coordinates (north up, 1.875″ per pixel). Centering on the object would erase its motion.
- **Fair display.** The zodiacal light model is subtracted, bad pixels are masked (but not the OUTLIER flag, which the pipeline also sets on moving objects), and all visits share one display stretch, so contrast settings cannot fake a change.
- **Small transfers.** Only a 48 × 48 pixel area of each exposure is read from the AWS Open Data copy with byte-range requests. Original FITS files are never stored.
- **Honest states.** Two or more usable visits: "comparable". One visit: "additional analysis needed" (SPHEREx alone cannot compare it; the 25-year comparison still can). None: "no observations".

## Additional analyses

| Analysis | What it shows | Checked against |
| --- | --- | --- |
| Sky Time Machine | The same patch in 2MASS (≈2000), WISE (2010), NEOWISE (2014–2024) and SPHEREx (2025), with Gaia predicted paths; users mark positions to measure motion | Barnard's Star measured at 10.39″/yr (247.4″ over 23.81 yr), matching Gaia DR3 |
| Fake Planet Lab | Whether a "moving dot" is really a defect: quality flags, signal-to-noise, shape against the PSF, repeats in other exposures, nearby bright stars | Flag decoding matches IRSA cutouts pixel for pixel (5,112 pixels) |
| Neighborhood in Motion | 21 stars and brown dwarfs within about 3.6 pc placed in 3D from Gaia distances and motions, moved through time, and compared with where SPHEREx saw them | Barnard's Star closest approach in AD 11,736 at 1.155 pc, matching published values (about AD 11,700, 3.75 ly) |
| Sky Sonata | Sources in a SPHEREx image turned into sound by fixed rules (position → pan and pitch, brightness → volume), comparing two visits by ear | Rule tests: identical input gives identical sound; each property changes only its own sound parameter |
| Comet Breath | Interstellar comet 3I/ATLAS before (Aug 2025) and after (Dec 2025) perihelion: images and spectra, with gas production rates quoted from the literature | December CO (4.65 µm) and CO₂ (4.21 µm) bands rise above the continuum, the same direction as the published results |

## Test targets

| Target | Result so far |
| --- | --- |
| Barnard's Star | 3 SPHEREx visits; in the blink the star moves north and lines up with Gaia's predicted positions. Sky Time Machine measures 10.39″/yr (Gaia agrees). |
| Epsilon Indi B | [TODO: 검증 결과 표 작업 후 채움] |
| WISE 0855−0714 | Not in Gaia; position from Luhman & Esplin 2014. In one SPHEREx exposure (D6, 5.0 µm) its signal-to-noise is 1.7, too faint to locate, and the tool says so instead of guessing. [TODO: 블링크 결과] |
| RW Aurigae | [TODO: 변광 확인 결과] |
| R Draconis | [TODO: 변광 확인 결과] |

## Design choices

- **Candidates, not detections.** The tool never claims a discovery. Anything that moves is a candidate for a person to check.
- **Machines suggest, people check.** [TODO: 기능 A(사전 분석 후보 목록)·기능 B(사용자 평가: Moving / Not moving / Noise or artifact, 평가 전에는 다른 사람 평가를 숨김)가 들어간 만큼만 적는다.]
- **No invented data.** Missing observations are shown as missing; synthetic data is always labeled synthetic.
- **Positions with dates.** A moving object's coordinates always carry the time they were observed.

## Tools

Next.js 16 and React 19 (TypeScript), Aladin Lite 3.8.2 (CDS), TanStack Query, Prisma 7 with Neon Postgres for ratings, Vercel. Data from IRSA (SIA2, DataLink, AWS Open Data) and the ESA Gaia Archive. AI coding assistance from Claude Code (see Use of SI).

## Limitations

- **SPHEREx visits are few and close together.** A point is visited about twice a year, so most stars move far less than one 6.2″ pixel between visits. That is why the 25-year comparison exists, and why the blink is a place to look rather than a verdict.
- **Distant solar system objects jump, not slide.** Earth's motion shifts a very distant planet by several arcminutes between visits, more than the 3′ cutout. Such an object would appear in one visit and be absent in the next. [TODO: 컷아웃 크기 선택(결정 #19)이 들어가면 고쳐 쓴다.]
- **Faint objects.** SPHEREx is a wide spectral survey, not a deep imager; very faint objects are below its limit. [TODO: 탐지 한계 수치를 출처와 함께 넣을지 결정.]
- **Temporary background.** During the CDS outage the all-sky background is 2MASS, not SPHEREx; analysis is unaffected.
- [TODO: 동결 시점에 남은 미구현 기능(기능 A·B, 시야 크기 선택 등)을 사실대로 적는다.]

## What's next

- More SPHEREx visits as the survey continues, and linking SPHEREx with NEOWISE and other surveys for longer baselines.
- Known asteroid overlays (JPL, IMCCE SkyBoT) in the blink view.
- [TODO: 남은 계획 정리]
