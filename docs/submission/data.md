# Space Agency Data (draft)

> 제출 항목: Space Agency Data. 챌린지 Resources의 NASA 자료를 최소 1개 포함. 초안 2026-11-15 (Claude Code 작성, 사람 검토 전).
> 근거: `docs/analyses/*.md` 3장(입력 데이터), `app/_components/sky/constants.ts`.

---

## NASA data

- **SPHEREx Data Release 1 (DR1), NASA/IPAC Infrared Science Archive (IRSA).** The core of the tool. Exposures are found with IRSA's SIA2 service (`spherex_dr1` collection), located with IRSA DataLink, and read from the AWS Open Data bucket `nasa-irsa-spherex` (L2b images) with HTTP byte-range requests, so only a small area around the chosen point is transferred. We use the IMAGE, FLAGS, VARIANCE, ZODI and WCS-WAVE extensions. Original FITS files are never stored; every view links back to the IRSA original.
- **SPHEREx observations of interstellar comet 3I/ATLAS (IRSA).** The comet-specific observation list and DR1 images from August and December 2025, used for the Comet Breath spectra.
- **2MASS, WISE (AllWISE and the cryogenic mission) and NEOWISE images (IRSA).** Used in Sky Time Machine to compare the same patch of sky across about 25 years (2MASS around 2000 to SPHEREx in 2025). WISE and NEOWISE frames are read from IRSA's copies on AWS when available.
- **2MASS color HiPS mirrored by IRSA.** Temporary background of the all-sky view while the CDS SPHEREx color tiles are unavailable (CDS outage, November 2026). The screen says it is 2MASS, not SPHEREx.

## Other agencies and archives

- **ESA Gaia Data Release 3**, from the ESA Gaia Archive (IRSA's copy as a fallback). Star positions are moved from epoch 2016.0 to each observation date with their proper motions, so known stars can be told apart from anything that moved.
- **CDS SPHEREx QR2 color HiPS** (Strasbourg Astronomical Data Center). Intended background of the all-sky view, for browsing only; analysis always uses IRSA DR1 data. [TODO] 제출 시점에 CDS가 복구됐는지 확인하고 문장을 고친다.

## Challenge resources we used

- NASA/IPAC Infrared Science Archive (IRSA) and its SPHEREx resources
- Gaia Mission Data (Data Release 3)
- WiseView, as the model for the blink viewer
- Aladin (CDS) for the sky display
