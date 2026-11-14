# References (draft)

> 제출 항목: References. 데이터·도구·코드·이미지 출처, 링크, 라이선스, 감사 문구. 초안 2026-11-15 (Claude Code 작성, 사람 검토 전).
> 감사 문구는 지어내지 않는다. `[TODO: paste]` 칸에는 링크한 공식 페이지의 문구를 그대로 붙여넣는다.
> 라이선스는 `package.json`의 버전 기준으로 다시 확인한다.

---

## Data and acknowledgments

| Source | Use | Acknowledgment / citation |
| --- | --- | --- |
| SPHEREx DR1, NASA/IPAC IRSA | Blink, difference, stack and all additional analyses | Required acknowledgment on the [IRSA SPHEREx page](https://irsa.ipac.caltech.edu/Missions/spherex.html), beginning "This publication makes use of data products from the Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer (SPHEREx)…" [TODO: paste full text]. Images: "Courtesy NASA/JPL-Caltech". |
| SPHEREx QR2 color HiPS, CDS | All-sky background (browsing only) | QR2 DOI [10.26131/IRSA652](https://doi.org/10.26131/IRSA652) ([QR overview](https://irsa.ipac.caltech.edu/data/SPHEREx/docs/overview_qr.html)). CDS HiPS acknowledgment [TODO: paste from CDS] |
| IRSA | Every SPHEREx, 2MASS, WISE and NEOWISE request | IRSA acknowledgment [TODO: paste from IRSA] |
| 2MASS images and color HiPS | Sky Time Machine, temporary sky background | 2MASS acknowledgment [TODO: paste from IRSA 2MASS page]; Skrutskie et al. 2006, AJ 131, 1163 |
| WISE / AllWISE | Sky Time Machine | WISE acknowledgment and journal reference [TODO: paste from IRSA WISE page] |
| NEOWISE | Sky Time Machine | Acknowledgment on the [NEOWISE page](https://irsa.ipac.caltech.edu/data/WISE/docs/release/NEOWISE/expsup/index.html) [TODO: paste] |
| Gaia DR3, ESA | Known-star positions at each visit, nearby-star map | "This work has made use of data from the European Space Agency (ESA) mission Gaia (https://www.cosmos.esa.int/gaia), processed by the Gaia Data Processing and Analysis Consortium (DPAC)…" [TODO: paste full text from the [Gaia DR3 credit page](https://gea.esac.esa.int/archive/documentation/GDR3/Miscellaneous/sec_credit_and_citation_instructions/)]. Cite Gaia Collaboration 2016 (The Gaia mission) and Gaia Collaboration 2023 (Gaia DR3: Summary of the contents and survey properties). Data: [doi:10.5270/esa-qa4lep3](https://doi.org/10.5270/esa-qa4lep3) |

## Papers

- Lisse et al. 2025b, arXiv:2512.07318 (v3), and Lisse et al. 2026, arXiv:2601.06759 (v2): 3I/ATLAS gas production rates quoted in Comet Breath. arXiv:2508.15469 (v2) is shown as superseded. [TODO: titles]
- Luhman & Esplin 2014, arXiv:1409.5899 (v1): parallax, proper motion and position of WISE 0855−0714 (not in Gaia), used in Neighborhood in Motion.
- van Wijk & Nuij 2003, "Smooth and efficient zooming and panning", IEEE Symposium on Information Visualization: the zoom-and-pan path of the sky view's flights.

## Software

| Project | License | Use |
| --- | --- | --- |
| [Aladin Lite](https://github.com/cds-astro/aladin-lite) 3.8.2, CDS | LGPL-3.0 (source at the link) | All-sky view |
| [d3-celestial](https://github.com/ofrohn/d3-celestial) constellation lines, Olaf Frohn | BSD-3-Clause (`app/_components/sky/data/LICENSE-d3-celestial.txt`) | Constellation stick figures |
| [Pretendard](https://github.com/orioncactus/pretendard), Kil Hyung-jin | SIL Open Font License 1.1 (`app/fonts/LICENSE.txt`) | Typeface |
| Next.js, React | MIT | Web framework |
| three.js, React Three Fiber | MIT | 3D map in Neighborhood in Motion |
| TanStack Query, ky, zod | MIT | Data fetching and validation |
| Prisma | Apache-2.0 | Ratings database access |
| shadcn/ui, Base UI, Tailwind CSS | MIT | Interface components and styling |
| lucide | ISC | Icons |
| Recharts | MIT | Charts |

## This project

- Source code: [TODO: GitHub URL] — MIT License (`LICENSE`)
- AI tools: see Use of SI (`ai-usage.md`)
