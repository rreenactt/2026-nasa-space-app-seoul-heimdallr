/**
 * Comet Breath — shared types between the Route Handlers (server) and the popup (client).
 * Everything here is serializable JSON; nothing is persisted on either side.
 */

export type PeriodId = "2025-08" | "2025-12";

/** One row of the IRSA 3I/ATLAS observation list (one detector of one exposure). */
export interface ObservationEntry {
  /** `${obsId}:${detector}` — unique per row. */
  key: string;
  obsId: string;
  detector: string; // "D1".."D6"
  utcStart: string; // ISO, from t_min (MJD)
  utcEnd: string; // ISO, from t_max (MJD)
  mjdMid: number;
  exptimeS: number;
  cometRa: number; // predicted comet position for this exposure (deg)
  cometDec: number;
  imageRa: number; // image center s_ra / s_dec (deg) — not the comet
  imageDec: number;
  /** Detector-wide wavelength range from the list. Not the wavelength at the comet. */
  emMinUm: number;
  emMaxUm: number;
  accessUrl: string;
  accessFormat: string;
  /** Release named by the list (currently spherex_qr2). */
  listCollection: string;
  period: PeriodId | null;
}

export interface ObservationIndex {
  source: string;
  fetchedAt: string;
  entries: ObservationEntry[];
}

/** WCS needed client-side for sky→pixel (TAN-SIP, sky→detector polynomials AP/BP). */
export interface TanSipWcs {
  crpix: [number, number]; // 1-based
  crval: [number, number]; // deg
  cd: [[number, number], [number, number]]; // deg/pixel (CDELT·PC)
  ap: Record<string, number>; // "p_q" → coefficient
  bp: Record<string, number>;
}

/** SPHEREx WAVE-TAB lookup (WCS-WAVE extension) plus the cutout→raw pixel mapping. */
export interface WaveLookup {
  x: number[]; // control points in raw detector pixels (1-based)
  y: number[];
  /** Flattened VALUES with TDIM (2, nx, ny): index = k + 2 * (ix + nx * iy); k=0 wavelength, k=1 bandwidth. */
  values: number[];
  crpix: [number, number];
  crval: [number, number];
  cdelt: [number, number];
}

export interface FlagBit {
  bit: number;
  name: string;
  description: string;
}

/** A cutout read on demand for one observation. Arrays are base64 of little-endian typed-array buffers. */
export interface FramePayload {
  key: string;
  obsId: string;
  detector: string;
  release: string; // e.g. spherex_dr1
  fileUrl: string; // full L2b FITS on IRSA (not downloaded as a whole)
  /** Where the pixels were range-read from, and which rows/columns. */
  pixelSource: string;
  datalinkUrl: string;
  /** Cutout origin in the full detector image (0-based x, y). */
  origin: [number, number];
  centerRa: number;
  centerDec: number;
  width: number;
  height: number;
  /** Float32 little-endian, row 0 = FITS row 1 (bottom). */
  image: string;
  variance: string;
  zodi: string;
  /** Int32 little-endian. */
  flags: string;
  flagBits: FlagBit[];
  wcs: TanSipWcs;
  wave: WaveLookup | null;
  header: {
    bunit: string;
    dateObs: string;
    dateAvg: string;
    mjdAvg: number;
    xposureS: number;
    psfFwhmArcsec: number | null;
    omegaMedianArcsec2: number | null;
    l1Dqa: string | null;
    l2Dqa: string | null;
  };
}

export interface ApertureParams {
  /** Aperture radius (pixels). The August paper used 12″ ≈ 2 px. */
  rAp: number;
  /** Background annulus (pixels). The paper used ≈1′–3′. */
  rIn: number;
  rOut: number;
  /** Exclude SOURCE-flagged (catalog star) pixels from the background annulus. */
  maskSourcesInAnnulus: boolean;
}

export type QualityReason = "edge" | "masked" | "low-snr" | "dqa-fail" | "no-wave";

export interface PhotometryResult {
  /** Comet pixel position in the cutout (0-based, x right, y up as in FITS). */
  x: number;
  y: number;
  wavelengthUm: number | null;
  bandwidthUm: number | null;
  fluxMjy: number;
  errorMjy: number;
  snr: number;
  backgroundMjySr: number;
  backgroundSigma: number;
  apertureArea: number; // effective pixels
  apertureCoverage: number; // fraction of aperture weight on usable pixels
  annulusPixels: number;
  omegaSr: number;
  quality: "ok" | "flagged";
  reasons: QualityReason[];
}

export interface GeometryResult {
  mjd: number;
  center: string;
  rHelAu: number;
  deltaAu: number;
  source: string;
}

export type RateStatus = "detection" | "tentative" | "upper-limit";

export interface PublishedRate {
  id: string;
  species: string;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;
  /** molecules / s */
  productionRate: number;
  /** 1σ absolute uncertainty in molecules/s, or null when not given. */
  uncertainty: number | null;
  uncertaintyNote: string;
  status: RateStatus;
  method: string;
  aperture: string;
  sourceId: string;
  location: string; // section / sentence in the paper
  /** True when a later paper re-analysed the same exposures and replaces this value. */
  superseded: boolean;
  provenance: "paper" | "own-analysis";
}

export interface PaperSource {
  id: string;
  shortName: string;
  title: string;
  version: string;
  url: string;
  data: string;
}
