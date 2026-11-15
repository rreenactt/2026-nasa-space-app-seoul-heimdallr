# Space Agency Data (draft)

> 제출 항목: Space Agency Data. NASA 자료를 최소 1개 포함하고, 데이터가 프로젝트에 어떤 영감을 줬는지도 적는다 (서울 D-Day PDF 27쪽).
> 우주기관이 아닌 출처(CDS 등)는 References 칸에 적는다. 초안 2026-11-15 (Claude Code 작성, 사람 검토 전).
> 근거: `docs/analyses/*.md` 3장(입력 데이터), `app/_components/sky/constants.ts`.

---

## NASA Data

- **SPHEREx Data Release 1 (DR1), NASA/IPAC Infrared Science Archive (IRSA).** The core of the tool. Exposures are found with IRSA's SIA2 service (`spherex_dr1` collection), located with IRSA DataLink, and read from the AWS Open Data bucket `nasa-irsa-spherex` (L2b images) with HTTP byte-range requests, so only a small area around the chosen point is transferred. We use the IMAGE, FLAGS, VARIANCE, ZODI and WCS-WAVE extensions. Original FITS files are never stored; every view links back to the IRSA original.
- **SPHEREx observations of interstellar comet 3I/ATLAS (IRSA).** The comet-specific observation list and DR1 images from August and December 2025, used for the Comet Breath spectra.
- **2MASS, WISE (AllWISE and the cryogenic mission) and NEOWISE images (IRSA).** Used in Sky Time Machine to compare the same patch of sky across about 25 years (2MASS around 2000 to SPHEREx in 2025). WISE and NEOWISE frames are read from IRSA's copies on AWS when available.
- **2MASS color HiPS mirrored by IRSA.** Temporary background of the all-sky view while the CDS SPHEREx color tiles are unavailable (CDS outage, November 2026). The credit line names 2MASS, the This view panel says it is not SPHEREx, and the Method page explains why.

## Space Agency Partner Data

- **ESA Gaia Data Release 3**, from the ESA Gaia Archive (IRSA's copy as a fallback). Star positions are moved from epoch 2016.0 to each observation date with their proper motions, so known stars can be told apart from anything that moved.

## How the data shaped the project

> [TODO] 사람 검토 필요: 아래는 기획 문서(`docs/PLAN.md`, `docs/decisions.md`)의 설계 이유를 옮긴 것이다. 팀이 실제로 겪은 순서와 다르면 고친다.

- SPHEREx revisits every point of the sky about every six months. That turned a spectral survey into a time series, and made the 1930 blink method possible on a modern all-sky dataset.
- SPHEREx's linear variable filters change wavelength across each image. Comparing different wavelengths would fake a change, so the tool compares only the same detector at matching wavelengths.
- The visits are few and close together, so most stars barely move between them. That limit led to Sky Time Machine, which adds 2MASS, WISE and NEOWISE for a 25-year baseline, and to Gaia DR3 as the reference for what known stars should do.

## Other archives (listed under References)

- **CDS SPHEREx QR2 color HiPS** (Strasbourg Astronomical Data Center): intended background of the all-sky view, for browsing only; analysis always uses IRSA DR1 data. [TODO] 제출 시점에 CDS가 복구됐는지 확인하고 문장을 고친다.

## Challenge resources we used

- NASA/IPAC Infrared Science Archive (IRSA) and its SPHEREx resources
- Gaia Mission Data (Data Release 3)
- WiseView, as the model for the blink viewer
- Aladin (CDS) for the sky display
