import "server-only";
import { unstable_cache } from "next/cache";
import { latestReviewBatch, type ReviewCandidateRow } from "@/data/motion-candidates";
import { cellTallies, type Tally } from "@/data/ratings";
import { ratingStatus } from "@/app/_lib/ratings/status";
import { RATING_RELEASE } from "@/app/api/ratings/_server/ratings";
import type { CandidateBatch, MovementCandidate } from "./review-queue";

const MJD_UNIX_EPOCH = 40587;

/** IAU-style name from the SPHEREx position, truncated not rounded: J171439.5+265546. */
function coordinateName(ra: number, dec: number) {
  const pad = (value: number, width: number) => String(value).padStart(width, "0");
  const totalRa = Math.floor((ra / 15) * 36000); // tenths of a second of time
  const hh = Math.floor(totalRa / 36000);
  const mm = Math.floor((totalRa % 36000) / 600);
  const ss = (totalRa % 600) / 10;
  const totalDec = Math.floor(Math.abs(dec) * 3600);
  const dd = Math.floor(totalDec / 3600);
  const dm = Math.floor((totalDec % 3600) / 60);
  const ds = totalDec % 60;
  return `J${pad(hh, 2)}${pad(mm, 2)}${ss.toFixed(1).padStart(4, "0")}${dec < 0 ? "-" : "+"}${pad(dd, 2)}${pad(dm, 2)}${pad(ds, 2)}`;
}

/**
 * Ratings are of DR1 cells; the survey names its release "spherex_dr1". Only a DR1 survey's candidates take statuses
 * from the ratings.
 */
const ratedRelease = (release: string) => release.toUpperCase().endsWith(RATING_RELEASE);

/** The tallies of the cells these candidates sit in, or none when the survey is not of the rated release. */
export async function talliesFor(rows: ReviewCandidateRow[], release: string): Promise<Map<number, Tally>> {
  if (!ratedRelease(release)) return new Map();
  return cellTallies(RATING_RELEASE, [...new Set(rows.map((row) => row.hpxIndex))]);
}

/**
 * A database row as the sky screen sees it (the batch list and the search lookup share this). The status comes from
 * the ratings of the candidate's cell (decision #57); without ratings it has none.
 */
export function toMovementCandidate(row: ReviewCandidateRow, surveyId: string, tally?: Tally): MovementCandidate {
  const match = row.match === "KNOWN_MOVER" ? "known" : "unidentified";
  return {
    id: coordinateName(row.raDeg, row.decDeg),
    ra: row.raDeg,
    dec: row.decDeg,
    observedAt: new Date((row.epochMjd - MJD_UNIX_EPOCH) * 86_400_000).toISOString(),
    detections: row.spherexVisits,
    detector: row.detector,
    wavelengthUm: row.wavelengthUm,
    snr: row.snr,
    match,
    pmTotalMasYr: row.pmTotalMasYr,
    separationArcsec: row.separationArcsec,
    baselineYears: row.baselineYears,
    tmassDesignation: row.tmassDesignation,
    gaiaSourceId: row.gaiaSourceId,
    gaiaPmMasYr: row.gaiaPmMasYr,
    synthetic: row.isSynthetic,
    batchId: surveyId,
    status: ratingStatus(tally, match),
  };
}

async function load(): Promise<CandidateBatch> {
  const batch = await latestReviewBatch();
  if (!batch) return { state: "empty" };
  const tallies = await talliesFor(batch.candidates, batch.release);
  const candidates = batch.candidates.map((row) => toMovementCandidate(row, batch.surveyId, tallies.get(row.hpxIndex)));
  return {
    state: "ready",
    batchId: batch.surveyId,
    release: batch.release,
    pointsSearched: batch.pointsSearched,
    pointsFailed: batch.pointsFailed,
    chancePairs: batch.chancePairs,
    candidates,
  };
}

// Candidates can be added to or removed from the database at any time, so the list is kept for one minute only; the
// search asks the database directly (api/candidates/lookup). Bump the version in the key whenever the shape of a
// MovementCandidate changes, so a cached old shape is never served.
const cachedLoad = unstable_cache(load, ["sky-candidate-batch", "v3"], { revalidate: 60 });

/**
 * The latest survey batch for the sky screen. If the database cannot be reached the screen says so rather than
 * showing an empty sky as if nothing had been found (absolute principle 5).
 */
export async function getCandidateBatch(): Promise<CandidateBatch> {
  try {
    return await cachedLoad();
  } catch (error) {
    console.error("Could not load the candidate batch", error instanceof Error ? error.name : "unknown error");
    return { state: "unavailable" };
  }
}
