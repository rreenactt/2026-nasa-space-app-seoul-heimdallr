/**
 * Basic analysis (PLAN.md chapter 4): which SPHEREx exposures of a point can be compared, per visit.
 */

export interface PlannedExposure {
  key: string; // `${obsId}:${detector}`
  obsId: string;
  detector: string;
  tStart: number; // MJD
  tEnd: number;
  /** Wavelength / bandwidth at the target, estimated from the footprint corners and the detector's WAVE table. */
  estWavelengthUm: number | null;
  estBandwidthUm: number | null;
  fileUrl: string;
  /** Why it is not used (null = used). */
  excluded: string | null;
}

export interface PlannedVisit {
  index: number; // 1-based
  start: number; // MJD of first exposure in the visit (all detectors)
  end: number;
  /** Exposures of the chosen detector in this visit; `excluded` null = combined into this visit's frame. */
  exposures: PlannedExposure[];
}

export interface DetectorSummary {
  detector: string;
  exposures: number;
  visits: number;
  emMinUm: number;
  emMaxUm: number;
}

export type BlinkStatus = "comparable" | "additional-analysis-needed" | "no-observations";

export interface BlinkPlan {
  ra: number;
  dec: number;
  release: string;
  status: BlinkStatus;
  detectors: DetectorSummary[];
  detector: string | null;
  /** Reference wavelength chosen so that the most visits have an exposure within tolerance. */
  referenceWavelengthUm: number | null;
  toleranceUm: number | null;
  toleranceRule: string;
  visits: PlannedVisit[];
  queryUrl: string;
  processingVersion: string;
}
