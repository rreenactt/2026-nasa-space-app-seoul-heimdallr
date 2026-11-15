# Project Details

> 제출 항목: Project Details (작동 방식, 설계 이유, 도구, 한계, 다음 계획). 2026-11-15 17시 기준 실제 기능으로 다시 씀 (Claude Code 작성, 사람 검토 전).
> 근거: `docs/PLAN.md`(7·9장), `docs/analyses/*.md`(검증 절), `docs/decisions.md`, Method 페이지. 숫자는 문서에 기록된 값만 썼다.
> 제출 페이지 편집기는 마크다운을 바꾸지 않는다. 표는 목록으로 바꿔 두었고, `## ` 줄은 붙여넣은 뒤 편집기에서 제목으로 지정한다. 아래 구분선 사이만 붙여넣는다.

---

## What it does

HEIMDALLR lets anyone look for things that move or change in NASA's SPHEREx all-sky survey, the way Clyde Tombaugh found Pluto: by flipping between images of the same sky taken at different times. Machines suggest where to look, and people check.

1. Explore the sky. A full-screen sky view (Aladin Lite, from 120° down to a few arcminutes) with a coordinate grid, constellation lines, and the RA/Dec under the cursor. Search takes coordinates or a candidate's name, and every view has a shareable link.
2. Open the review queue. Candidates found by our survey, plus the five challenge test targets, wait in a queue you can filter by the part of the sky in view. Each one says whether Gaia already explains it ("answer key") or nobody does ("your call").
3. Watch it change. Clicking a candidate or any point opens the analysis panel: the SPHEREx DR1 images of that patch, one per visit, play as a blink animation, with a difference view (later visit minus first) and a stack view. Gaia DR3 stars moved to each visit's date are drawn on the images, quality flags at the point are listed, and every frame links to its IRSA original.
4. Rate it. Moving, Not moving, or Noise or artifact. Other people's ratings appear only after you rate, so they cannot sway you. Pooled ratings give each candidate a status, and a Most rated tab shows where people looked most.
5. Go further. Five additional analyses open from the same panel (below).
6. Learn as you look. On a first visit, an 11-step tour walks through the real screen, from browsing the sky to rating and sharing a link. A Star guide marks fast-moving Gaia stars on screen with their paths from about 1999 to 2026, so newcomers see what real motion looks like. About and Method pages explain the science and every rule in plain words, with the formulas one click away. The interface is available in English and Korean.

## How it works

- Finding exposures. IRSA's SIA2 service returns every DR1 science exposure that covers the point. Exposures closer than 20 days are grouped into one visit.
- Same detector, same wavelength. SPHEREx uses linear variable filters, so the wavelength changes across each image. We estimate the wavelength at the target pixel from each exposure's footprint and the detector's wavelength table, keep only exposures within ±0.5 × the local bandwidth of one reference wavelength, and re-check the wavelength in each file we read. Mixing wavelengths would make brightness differences look like change.
- Fixed sky grid. Every frame is resampled onto the same 3′ × 3′ grid centered on the input coordinates, north up. Centering on the object would erase its motion.
- Fair display. The zodiacal light model is subtracted, bad pixels are masked (but not the OUTLIER flag, which the pipeline also sets on moving objects), and all visits share one display stretch, so contrast settings cannot fake a change.
- Small transfers. Only the pixels around the point are read from the AWS Open Data copy with byte-range requests. Original FITS files are never stored.
- Honest states. Two or more usable visits: comparable. One visit: "additional analysis needed" (SPHEREx alone cannot compare it; the 25-year comparison still can). None: no observations.

## Where the candidates come from

SPHEREx visits are about six months apart and positions scatter by about 9″ between them, so even the fastest star (Barnard's Star, 10.4″ per year) is lost in the noise between two SPHEREx visits. We therefore compare SPHEREx (2025–26) with 2MASS (about 2000), a 25-year baseline.

- In each field, a SPHEREx source with S/N ≥ 20 that has no 2MASS source at its position is paired with a 2MASS source (Ks ≤ 14.5) that has nothing at its position in SPHEREx now, between the field's minimum motion (at least 8″) and 90″, with brightness within a factor of 3.
- Both ends are checked against Gaia DR3 moved to each date. If one Gaia star explains both ends, it is a known moving star. If a Gaia star sits at only one end, it is a chance pair. If no Gaia star explains it, it is unidentified: a candidate for people to check, not a detection.
- Control sample: of 12 stars moving 0.5 to 3″ per year, 8 were recovered as known moving stars, with speeds within 1 to 8% of Gaia.
- First survey: 75,756 random fields on GitHub Actions; 5,384 pairs, of which 262 known moving stars (median speed difference from Gaia 4.3%), 5,081 chance pairs and 41 unidentified. 23 of the 41 lie near the Galactic plane, where chance pairs are common.
- Ratings decide what stays in the queue: fewer than 5 ratings is "needs ratings"; at least 5 with 30% or more Moving is "recommended"; less than 30% Moving or 50% or more Noise or artifact leaves the queue (never deleted); at least 10 ratings with 70% or more Moving on an unidentified candidate is "noteworthy". Known moving stars are the answer key and never leave.

## Additional analyses

- Sky Time Machine: the same patch in 2MASS (about 2000), WISE (2010), NEOWISE (2014–2024) and SPHEREx (2025), with Gaia predicted paths; users mark positions to measure motion. Check: Barnard's Star measured at 10.39″/yr (247.4″ over 23.81 yr), matching Gaia DR3.
- Fake Planet Lab: whether a "moving dot" is really a defect (quality flags, signal-to-noise, shape against the PSF, repeats in other exposures, nearby bright stars), plus a brightness tab that compares visits at the same wavelength and measures saturated stars in a ring outside the core. Check: flag decoding matches IRSA cutouts pixel for pixel (5,112 pixels).
- Neighborhood in Motion: 21 stars and brown dwarfs within about 3.6 pc placed in 3D from Gaia distances and motions, moved through time, and compared with where SPHEREx saw them. Check: Barnard's Star closest approach in AD 11,736 at 1.155 pc, matching published values (about AD 11,700, 3.75 ly).
- Sky Sonata: sources in a SPHEREx image turned into sound by fixed rules (position to pan and pitch, brightness to volume), comparing two visits at the same wavelength source by source. Check: identical input gives identical sound; each property changes only its own sound parameter.
- Comet Breath: interstellar comet 3I/ATLAS before (August 2025) and after (December 2025) perihelion, with images, spectra and gas production rates quoted from the literature. Check: the December CO (4.65 µm) and CO₂ (4.21 µm) bands rise above the continuum, the same direction as the published results.

## Test targets

Every number below was measured with the tool's own analysis code.

- Barnard's Star (fast proper motion, 10.4″/yr): 3 SPHEREx visits; in the blink the star moves north and lines up with Gaia's predicted positions. Sky Time Machine measures 10.39″/yr over 23.81 years, matching Gaia DR3.
- Epsilon Indi B (faint nearby brown dwarf): detected in all 6 exposures over 3 visits (1.11 µm, S/N about 100), 44–48″ from its 2016 Gaia position and within 1.1″ of where Gaia's motion predicts. Nothing remains at the old position.
- WISE 0855−0714 (coldest known brown dwarf, not in Gaia): invisible at the default 1.45 µm. At 4.6 µm a faint signal (S/N 3.6–5.4) sits at its predicted position, but a Gaia star 7.3″ away blends with it, so we call it consistent with WISE 0855, not confirmed.
- RW Aurigae (young variable star): the core is saturated, so Fake Planet Lab measures a ring around it. Between September 2025 and March 2026 the ring changed by +2% (−0.024 ± 0.027 mag over 23 pairs): no change found.
- R Draconis (bright Mira variable): the core is saturated over more than 6 pixels, so the tool picks a 6–10 pixel ring. Between July and October 2025 it faded by 0.62 ± 0.10 mag (4 pairs), and a wider ring agrees (0.64 ± 0.09 mag). A Mira dimming over months is expected.

What this shows: SPHEREx positions match Gaia to a fraction of a pixel when the object is visible; between visits these stars move less than a pixel, so Gaia predictions and the 25-year comparison carry the motion; the detector choice matters for very cold objects; and saturated stars can still be compared through a ring, with the limits stated.

## Design choices

- Candidates, not detections. The tool never claims a discovery, including Planet X. Anything that moves is a candidate for a person to check.
- Machines suggest, people check. The survey only orders where to look; people's ratings decide what stays.
- No invented data. Missing observations are shown as missing; drawings are labelled as drawings; synthetic data is always labelled synthetic.
- Positions with dates. A moving object's coordinates always carry the time they were observed.
- Open to anyone. No sign-in, one rating per browser, shareable links, and plain-language explanations next to the formulas.

## Tools

Next.js 16 and React 19 (TypeScript), Aladin Lite 3.8.2 (CDS), TanStack Query, Prisma 7 with Neon Postgres (ratings and survey results), GitHub Actions (the survey), Vercel. Data from IRSA (SIA2, DataLink, AWS Open Data), the ESA Gaia Archive and JPL. Coding and writing assistance from Claude Code (see Use of SI).

## Limitations

- SPHEREx visits are few and close together. DR1 spans about a year, so a place has a few visits at most and some have only one. Most stars move far less than one 6.2″ pixel between visits, which is why the 25-year comparison exists and why the blink is a place to look rather than a verdict.
- The survey sampled 75,756 random fields, not the whole sky, and missed some very fast and very bright stars in the control sample.
- Distant solar system objects jump rather than slide: Earth's motion shifts a very distant planet by several arcminutes between visits, more than the 3′ cutout, so it would appear in one visit and be absent in the next. This tool has not searched for a planet beyond Neptune in a way that could rule one out.
- Temporary background. While the CDS SPHEREx colour map is offline, the all-sky background is 2MASS; the blink and every analysis use SPHEREx images.

## What's next

- More SPHEREx visits as the survey continues, and a whole-sky survey run.
- Known asteroid overlays (JPL, IMCCE SkyBoT) in the blink view.
- A choice of cutout size, and the SPHEREx colour background once CDS is back.

## Acknowledgments

This publication makes use of data products from the Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer (SPHEREx), which is a joint project of the Jet Propulsion Laboratory and the California Institute of Technology, and is funded by the National Aeronautics and Space Administration.

This research has made use of the NASA/IPAC Infrared Science Archive, which is funded by the National Aeronautics and Space Administration and operated by the California Institute of Technology.

This publication makes use of data products from the Two Micron All Sky Survey, which is a joint project of the University of Massachusetts and the Infrared Processing and Analysis Center/California Institute of Technology, funded by the National Aeronautics and Space Administration and the National Science Foundation.

This publication makes use of data products from the Wide-field Infrared Survey Explorer, which is a joint project of the University of California, Los Angeles, and the Jet Propulsion Laboratory/California Institute of Technology, and NEOWISE, which is a project of the Jet Propulsion Laboratory/California Institute of Technology. WISE and NEOWISE are funded by the National Aeronautics and Space Administration.

This work has made use of data from the European Space Agency (ESA) mission Gaia (https://www.cosmos.esa.int/gaia), processed by the Gaia Data Processing and Analysis Consortium (DPAC, https://www.cosmos.esa.int/web/gaia/dpac/consortium). Funding for the DPAC has been provided by national institutions, in particular the institutions participating in the Gaia Multilateral Agreement.

This project is not affiliated with or endorsed by NASA.
