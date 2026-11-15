# NASA Data · Space Agency Partner & Other Data (제출 칸 원고)

> 제출 페이지의 두 칸은 "Link Text + Link Url" 줄 단위다. 한 줄에 하나씩 "Add New Link"로 넣는다.
> 한 칸에 최대 25줄까지 들어간다(2026-11-15 입력하며 확인). 그래서 Partner 칸에서 Shiki를 뺐다. Shiki는 프로덕션에서 닫혀 있는 `/design-system` 화면에서만 쓴다.
> 2026-11-15 17시 기준. 코드에서 실제로 쓰는 외부 자료를 grep으로 확인하고, 모든 URL이 열리는지 curl로 확인했다 (ESA Gaia Archive는 이 컴퓨터에서 응답 시간 초과라 ESA Gaia DR3 소개 페이지로 대신함).
> 맨 아래 "Confirm All Work is Original" 체크는 바깥 자료를 이 두 칸에 모두 적었다는 뜻이다. 감사 문구는 Project Details 끝의 Acknowledgments에 넣는다.
> `references.md`, `data.md`는 이 파일의 근거(용도·라이선스 설명)로 남긴다.

## NASA Data (필수)

| Link Text | Link Url |
| --- | --- |
| SPHEREx Data Release 1 (NASA/IPAC Infrared Science Archive) | https://irsa.ipac.caltech.edu/Missions/spherex.html |
| SPHEREx archive documentation: data products, FLAGS, spectral WCS (IRSA) | https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-products/ |
| SPHEREx images on AWS Open Data (IRSA cloud access) | https://irsa.ipac.caltech.edu/cloud_access/ |
| SPHEREx observations of interstellar comet 3I/ATLAS (IRSA) | https://irsa.ipac.caltech.edu/data/SPHEREx/docs/comet3iatlas/index.html |
| 2MASS images and Point Source Catalog (IRSA) | https://irsa.ipac.caltech.edu/Missions/2mass.html |
| 2MASS color HiPS mirrored by IRSA (sky background) | https://irsa.ipac.caltech.edu/data/hips/CDS/2MASS/Color/ |
| WISE, AllWISE and NEOWISE images (IRSA) | https://irsa.ipac.caltech.edu/Missions/wise.html |
| NEOWISE Explanatory Supplement (IRSA) | https://irsa.ipac.caltech.edu/data/WISE/docs/release/NEOWISE/expsup/index.html |
| JPL Horizons (3I/ATLAS ephemeris) | https://ssd.jpl.nasa.gov/horizons/ |

## Space Agency Partner & Other Data

| Link Text | Link Url |
| --- | --- |
| ESA Gaia Data Release 3 (star positions and motions; fast-star list for the Star guide) | https://www.cosmos.esa.int/web/gaia/dr3 |
| Aladin Lite 3.8.2, CDS (all-sky viewer, LGPL-3.0) | https://github.com/cds-astro/aladin-lite |
| d3-celestial constellation lines, Olaf Frohn (BSD-3-Clause) | https://github.com/ofrohn/d3-celestial |
| Pretendard typeface (SIL Open Font License 1.1) | https://github.com/orioncactus/pretendard |
| IVOA Simple Image Access 2.0 | https://www.ivoa.net/documents/SIA/ |
| Lisse et al. 2025, SPHEREx discovery of water ice and a CO2 coma in 3I/ATLAS (arXiv:2508.15469) | https://arxiv.org/abs/2508.15469 |
| Lisse et al. 2025, SPHEREx pre-perihelion mapping of H2O, CO2 and CO in 3I/ATLAS (arXiv:2512.07318) | https://arxiv.org/abs/2512.07318 |
| Lisse et al. 2026, SPHEREx re-observation of 3I/ATLAS in December 2025 (arXiv:2601.06759) | https://arxiv.org/abs/2601.06759 |
| Luhman & Esplin 2014, parallax and proper motion of WISE 0855−0714 (arXiv:1409.5899) | https://arxiv.org/abs/1409.5899 |
| Doré et al. 2014, Cosmology with the SPHEREx All-Sky Spectral Survey (arXiv:1412.4872) | https://arxiv.org/abs/1412.4872 |
| van Wijk & Nuij 2003, Smooth and efficient zooming and panning (sky view flights) | https://www.win.tue.nl/~vanwijk/zoompan.pdf |
| Next.js (MIT) | https://github.com/vercel/next.js |
| React (MIT) | https://github.com/facebook/react |
| three.js (MIT) | https://github.com/mrdoob/three.js |
| React Three Fiber (MIT) | https://github.com/pmndrs/react-three-fiber |
| TanStack Query (MIT) | https://github.com/TanStack/query |
| ky (MIT) | https://github.com/sindresorhus/ky |
| zod (MIT) | https://github.com/colinhacks/zod |
| Prisma (Apache-2.0) | https://github.com/prisma/prisma |
| shadcn/ui (MIT) | https://github.com/shadcn-ui/ui |
| Base UI (MIT) | https://github.com/mui/base-ui |
| Tailwind CSS (MIT) | https://github.com/tailwindlabs/tailwindcss |
| Lucide icons (ISC) | https://github.com/lucide-icons/lucide |
| Recharts (MIT) | https://github.com/recharts/recharts |
| Claude Code, Anthropic (SI coding and writing assistant) | https://claude.com/claude-code |

## Acknowledgments (Project Details 끝에 붙임)

- 출처: SPHEREx는 IRSA SPHEREx 페이지, IRSA는 https://irsa.ipac.caltech.edu/ack.html, 2MASS는 https://ipac.caltech.edu/dois, WISE·NEOWISE는 AllWISE Explanatory Supplement 1.6b, Gaia는 ESA 표준 문구(2026-11-15 ESA 문서 서버가 응답하지 않아 원문 대조 못 함, 접속되면 확인). 나머지는 2026-11-15에 공식 페이지와 대조.
