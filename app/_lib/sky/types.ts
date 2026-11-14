/**
 * Sky Time Machine — types shared by the Route Handlers and the popup. Plain JSON, nothing persisted.
 */

export type MissionId = "2mass" | "wise" | "neowise" | "spherex";

/** Celestial WCS for TAN or SIN (optionally with SIP), with sky→pixel polynomials when the file has them. */
export interface CelestialWcs {
  projection: "TAN" | "SIN";
  crpix: [number, number]; // 1-based
  crval: [number, number]; // deg
  cd: [[number, number], [number, number]]; // deg / pixel
  /** Detector→sky SIP (A/B) and sky→detector (AP/BP), "p_q" → coefficient. */
  a: Record<string, number>;
  b: Record<string, number>;
  ap: Record<string, number>;
  bp: Record<string, number>;
}

/** The common sky grid every frame is resampled onto: TAN, north up, east left. Row 0 is the top row. */
export interface SkyGrid {
  ra: number;
  dec: number;
  fovArcmin: number;
  n: number;
}

/** One exposure (or atlas image) found by IRSA SIA2. */
export interface Exposure {
  id: string;
  collection: string;
  band: string;
  /** MJD of the exposure (start / end). */
  tStart: number;
  tEnd: number;
  /** IRSA IBE science image, or the SPHEREx DataLink obs id + detector. */
  source: { kind: "ibe"; url: string } | { kind: "spherex"; obsId: string; detector: string };
  pixelScaleArcsec: number;
  /** Image center from the archive (s_ra, s_dec), used to prefer frames that cover the field. */
  center: [number, number] | null;
}

/** A timeline stop: one band of one mission over one real observing window (one sky pass). */
export interface Epoch {
  id: string;
  mission: MissionId;
  product: string;
  collections: string[];
  band: string;
  wavelengthLabel: string;
  /** MJD range of all exposures found in the window. */
  timeStart: number;
  timeEnd: number;
  /** Exposures that will be combined (a subset, spread over the window). */
  exposures: Exposure[];
  totalExposures: number;
}

export interface MissionSearchResult {
  mission: MissionId;
  collections: string[];
  queryUrls: string[];
  searchedAt: string;
  epochs: Epoch[];
  exposureCount: number;
}

/** A frame resampled onto the grid. `data` is base64 Float32 (little-endian), NaN where no data. */
export interface EpochFrame {
  epochId: string;
  grid: SkyGrid;
  data: string;
  /** Exposures actually combined, with their own times. */
  used: { id: string; url: string; mjd: number }[];
  failed: { id: string; reason: string }[];
  /** MJD range of the exposures actually used. */
  timeStart: number;
  timeEnd: number;
  coverage: number;
  combine: string;
  /** SPHEREx: wavelength at the grid center from the WAVE-TAB lookup. */
  wavelengthUm: number | null;
  sourcePixelArcsec: number;
  processingVersion: string;
}

export interface GaiaStar {
  sourceId: string;
  ra: number; // epoch 2016.0
  dec: number;
  pmra: number; // mas/yr (includes cos δ)
  pmdec: number;
  parallax: number | null;
  gmag: number | null;
}
