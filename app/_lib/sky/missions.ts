import type { MissionId } from "./types";

export interface MissionConfig {
  id: MissionId;
  label: string;
  /** IRSA SIA2 / ObsCore collections searched for this mission. */
  collections: string[];
  product: string;
  bands: { id: string; label: string; wavelength: string }[];
  defaultBand: string;
  /** Exposures combined per observing window (spread over the window). */
  maxStack: number;
  /** Gap (days) that starts a new observing window. */
  windowGapDays: number;
  years: string;
}

export const MISSIONS: Record<MissionId, MissionConfig> = {
  "2mass": {
    id: "2mass",
    label: "2MASS",
    collections: ["twomass_allsky"],
    product: "2MASS All-Sky Atlas Image (overlapping tiles from the same night used together)",
    bands: [
      { id: "J", label: "J", wavelength: "1.25 µm" },
      { id: "H", label: "H", wavelength: "1.65 µm" },
      { id: "K", label: "Ks", wavelength: "2.16 µm" },
    ],
    defaultBand: "K",
    maxStack: 4,
    windowGapDays: 1,
    years: "1997–2001",
  },
  wise: {
    id: "wise",
    label: "WISE",
    collections: ["wise_allsky", "wise_3bandcryo", "wise_2bandcryo"],
    product: "WISE L1b single exposures → median stack per visit (computed by this tool)",
    bands: [
      { id: "W1", label: "W1", wavelength: "3.4 µm" },
      { id: "W2", label: "W2", wavelength: "4.6 µm" },
    ],
    defaultBand: "W1",
    maxStack: 5,
    windowGapDays: 20,
    years: "2010–2011",
  },
  neowise: {
    id: "neowise",
    label: "NEOWISE",
    collections: ["neowiser"],
    product: "NEOWISE-R L1b single exposures → median stack per visit (computed by this tool)",
    bands: [
      { id: "W1", label: "W1", wavelength: "3.4 µm" },
      { id: "W2", label: "W2", wavelength: "4.6 µm" },
    ],
    defaultBand: "W1",
    maxStack: 5,
    windowGapDays: 20,
    years: "2013–2024",
  },
  spherex: {
    id: "spherex",
    label: "SPHEREx",
    collections: ["spherex_dr1"],
    product: "SPHEREx L2b spectral images (one exposure per visit; wavelength varies with position)",
    bands: [
      { id: "D1", label: "D1", wavelength: "0.75–1.1 µm" },
      { id: "D2", label: "D2", wavelength: "1.1–1.6 µm" },
      { id: "D3", label: "D3", wavelength: "1.6–2.4 µm" },
      { id: "D4", label: "D4", wavelength: "2.4–3.8 µm" },
      { id: "D5", label: "D5", wavelength: "3.8–4.4 µm" },
      { id: "D6", label: "D6", wavelength: "4.4–5.0 µm" },
    ],
    defaultBand: "D4",
    maxStack: 1,
    windowGapDays: 20,
    years: "2025–",
  },
};

export const MISSION_ORDER: MissionId[] = ["2mass", "wise", "neowise", "spherex"];

export interface SkyExample {
  id: string;
  name: string;
  /** Field center (deg). */
  ra: number;
  dec: number;
  fovArcmin: number;
  note: string;
  /** Where the coordinates come from. */
  source: string;
}

/**
 * Centers are chosen so the expected motion over 2000–2025 stays inside the field.
 * Barnard's Star / ε Indi A: Gaia DR3 position at 2016.0 (queried from IRSA gaia_dr3_source).
 */
export const EXAMPLES: SkyExample[] = [
  {
    id: "barnard",
    name: "Barnard's Star",
    ra: 269.44850252544,
    dec: 4.73942005111,
    fovArcmin: 8,
    note: "One of the stars with the largest proper motion (Gaia DR3 about 10.4″/yr, northward). It moves about 4′ in 25 years. It is bright and may be saturated in 2MASS and WISE.",
    source: "Gaia DR3 4472832130942575872 (2016.0)",
  },
  {
    id: "eps-ind",
    name: "ε Indi A",
    ra: 330.8724078796,
    dec: -56.79725466123,
    fovArcmin: 8,
    note: "Gaia DR3 about 4.7″/yr. The primary is very bright (G≈4.3) and saturates. The brown dwarf companions ε Indi Ba/Bb lie about 7′ away and may be outside this field.",
    source: "Gaia DR3 6412595290592307840 (2016.0)",
  },
  {
    id: "wise0855",
    name: "WISE 0855−0714",
    ra: 133.795125,
    dec: -7.245139,
    fovArcmin: 5,
    note: "A very cold brown dwarf, seen mainly in W2. It is not in Gaia, so no predicted path is shown. It may not be visible in 2MASS or SPHEREx; that reflects differences in sensitivity and wavelength, not an object that appeared out of nowhere.",
    source: "AllWISE designation coordinates J085510.83−071442.5 (position around 2010)",
  },
];

export const PROCESSING_VERSION = "stm-1: SIA2 search → IBE/S3 cutout → bilinear reprojection onto a shared TAN grid → median background subtraction, MAGZP 22.5 normalization → median stack";
