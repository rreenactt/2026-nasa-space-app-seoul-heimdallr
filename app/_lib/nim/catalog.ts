import type { NeighborObject } from "./types";

/**
 * Names for Gaia DR3 sources. Gaia carries no names: each was matched by position, parallax and
 * brightness against the well-known system at that place (checked 2026-11-14). The source_id is the key.
 */
export const GAIA_NAMES: Record<string, { name: string; kind: string; notes?: string[] }> = {
  "5853498713190525696": { name: "Proxima Centauri", kind: "M dwarf" },
  "4472832130942575872": { name: "Barnard's Star", kind: "M dwarf" },
  "3864972938605115520": { name: "Wolf 359", kind: "M dwarf" },
  "762815470562110464": { name: "Lalande 21185", kind: "M dwarf" },
  "2947050466531873024": {
    name: "Sirius B",
    kind: "White dwarf",
    notes: ["Sirius A has no Gaia DR3 astrometry; this source is the white-dwarf companion (G ≈ 8.5).", "RUWE 2.4: the orbit around Sirius A disturbs the single-star solution."],
  },
  "5140693571158946048": {
    name: "Luyten 726-8 (component, G 10.8)",
    kind: "M dwarf binary component",
    notes: ["UV Ceti / BL Ceti pair. RUWE > 10: the binary orbit corrupts this astrometric solution. Components are not labelled A/B here."],
  },
  "5140693571158739840": {
    name: "Luyten 726-8 (component, G 10.5)",
    kind: "M dwarf binary component",
    notes: ["UV Ceti / BL Ceti pair. RUWE > 10: the binary orbit corrupts this astrometric solution. Components are not labelled A/B here."],
  },
  "4075141768785646848": { name: "Ross 154", kind: "M dwarf" },
  "1926461164913660160": { name: "Ross 248", kind: "M dwarf" },
  "5164707970261890560": { name: "ε Eridani", kind: "K dwarf", notes: ["Very bright (G 3.5): RUWE 2.7, no Gaia radial velocity."] },
  "6553614253923452800": { name: "Lacaille 9352", kind: "M dwarf" },
  "3796072592206250624": { name: "Ross 128", kind: "M dwarf" },
  "1872046609345556480": { name: "61 Cygni A", kind: "K dwarf" },
  "1872046574983497216": { name: "61 Cygni B", kind: "K dwarf" },
  "2154880616774131840": { name: "Struve 2398 A", kind: "M dwarf" },
  "2154880616774131712": { name: "Struve 2398 B", kind: "M dwarf" },
  "385334230892516480": { name: "Groombridge 34 A", kind: "M dwarf" },
  "385334196532776576": { name: "Groombridge 34 B", kind: "M dwarf" },
  "6412595290592307840": { name: "ε Indi A", kind: "K dwarf", notes: ["Very bright (G 4.3). Its motion is not the motion of ε Indi B."] },
  "6412596012146801152": {
    name: "ε Indi B (Ba+Bb)",
    kind: "Brown dwarf pair",
    notes: [
      "Gaia sees Ba and Bb as one source; RUWE 4.3 means the pair's orbit disturbs the solution.",
      "No orbit of Ba around Bb is drawn: no orbital solution is used here.",
      "Position and motion are this source's own — not borrowed from ε Indi A.",
    ],
  },
};

/** Gaia sources fetched in addition to the parallax cut (ε Indi system, just beyond 3.6 pc). */
export const EXTRA_GAIA_IDS = ["6412595290592307840", "6412596012146801152"];

/** Objects not in Gaia DR3, with values read from the paper (tables checked 2026-11-14). */
export const LITERATURE_OBJECTS: NeighborObject[] = [
  {
    id: "lit:wise0855",
    name: "WISE 0855−0714",
    nameBasis: "Literature object",
    kind: "Y dwarf (brown dwarf)",
    source: {
      catalog: "literature",
      reference: "Luhman & Esplin 2014, arXiv:1409.5899v1 — Table 2 (parallax, proper motion), Table 1 (Spitzer position, MJD 56839.7)",
      url: "https://arxiv.org/abs/1409.5899",
    },
    epoch: 2014.4967, // MJD 56839.7
    ra: 133.7858505,
    dec: -7.2443176,
    parallax: { value: 433, error: 15 },
    pmra: { value: -8100, error: 20 },
    pmdec: { value: 700, error: 20 },
    radialVelocity: null,
    correlations: null,
    ruwe: null,
    gmag: null,
    notes: [
      "Too faint for Gaia in visible light; values from Spitzer/WISE astrometry.",
      "The reference position is one observed epoch, so it still contains a parallax shift of up to 0.43″.",
      "Errors are treated as independent (the paper gives no correlations).",
    ],
  },
];
