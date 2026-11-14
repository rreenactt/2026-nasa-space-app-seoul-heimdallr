/**
 * Fake Planet Lab — shared types. Nothing here is persisted by the server.
 */

/** One SPHEREx DR1 exposure (one detector) covering the searched position. */
export interface FplExposure {
  key: string; // `${obsId}:${detector}`
  obsId: string;
  detector: string; // D1..D6
  tStart: number; // MJD
  tEnd: number;
  /** Detector-wide wavelength range (µm) from ObsCore — not the wavelength at the target. */
  emMinUm: number;
  emMaxUm: number;
  fileUrl: string;
  collection: string;
}

export interface FplSearchResult {
  ra: number;
  dec: number;
  queryUrl: string;
  searchedAt: string;
  exposures: FplExposure[];
}

export interface BrightNeighbor {
  sourceId: string;
  ra: number;
  dec: number;
  gmag: number;
  separationArcsec: number;
}

export type CheckStatus = "issue" | "caution" | "ok" | "info" | "not-checked";

export interface CheckItem {
  id: string;
  label: string;
  status: CheckStatus;
  summary: string;
  details: string[];
}

export type Verdict = "quality-issue" | "needs-review" | "no-issue-found";

/** User's judgment, using the team's evaluation labels. */
export type Judgment = "undecided" | "moving" | "not-moving" | "noise-or-artifact";
