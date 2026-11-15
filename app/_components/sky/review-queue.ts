import type { EquatorialCoordinates } from "./sky-coordinates";
import { TEST_TARGETS, type TestTarget } from "./test-targets";

/** A candidate's state after the periodic tally of ratings (PLAN.md chapter 7, candidates/status.json). */
export type CandidateStatus = "noteworthy" | "needs-ratings" | "recommended" | "excluded";

/**
 * How the Gaia DR3 check explained a candidate pair (decision #41). A known mover is a star Gaia already tracks: the
 * answer key to compare the blink against. An unidentified pair has no catalog explanation, so people judge it.
 */
export type CandidateMatch = "known" | "unidentified";

/**
 * One movement candidate from the SPHEREx DR1 × 2MASS survey (PLAN.md chapter 7, decision #41), read from the
 * database on the server (candidate-batch.ts). Nothing here is computed in the browser.
 */
export type MovementCandidate = EquatorialCoordinates & {
  /** IAU-style name from the SPHEREx position, fixed for the position so ratings stick to it. */
  id: string;
  /** Observation time of the SPHEREx position (absolute principle 6), ISO 8601. */
  observedAt: string;
  /** SPHEREx visits the source was found in. */
  detections: number;
  detector: string;
  wavelengthUm: number;
  snr: number;
  match: CandidateMatch;
  /** Motion implied by the 2MASS → SPHEREx pair, and the gap and time between the two positions. */
  pmTotalMasYr: number;
  separationArcsec: number;
  baselineYears: number;
  tmassDesignation: string;
  /** The Gaia DR3 star that explains a known mover, and its catalog motion. */
  gaiaSourceId: string | null;
  gaiaPmMasYr: number | null;
  /** Always labelled as synthetic when true (absolute principle 4). */
  synthetic: boolean;
  batchId: string;
  /** From the rating tally; absent until ratings are tallied, and never filled in by the website. */
  status?: CandidateStatus;
};

/** The latest survey run as the sky screen sees it. */
export type CandidateBatch =
  | { state: "empty" }
  | { state: "unavailable" }
  | {
      state: "ready";
      batchId: string;
      release: string;
      pointsSearched: number;
      pointsFailed: number;
      /** Gaia static pairs (chance pairs): counted, not listed. */
      chancePairs: number;
      candidates: MovementCandidate[];
    };

/** One stop in the review order: a test target or a movement candidate. */
export type ReviewEntry =
  | { kind: "test"; id: string; name: string; point: EquatorialCoordinates; target: TestTarget }
  | { kind: "candidate"; id: string; name: string; point: EquatorialCoordinates; candidate: MovementCandidate };

export type CandidateFilter = {
  status: "all" | CandidateStatus;
  match: "all" | "known" | "unidentified";
};

export const ALL_CANDIDATES: CandidateFilter = { status: "all", match: "all" };

/**
 * Review priority (PLAN.md chapter 7): noteworthy candidates first, then those still short of ratings so ratings
 * spread evenly, then recommended ones. Not yet tallied counts as short of ratings. Within a status, unidentified
 * pairs come before known movers: only people can settle them.
 */
const STATUS_ORDER: Record<CandidateStatus, number> = { noteworthy: 0, "needs-ratings": 1, recommended: 2, excluded: 3 };

/**
 * Candidates in the order to review them. Excluded candidates leave the list but are not deleted: typing their
 * coordinates still opens them (PLAN.md chapter 7).
 */
export function orderCandidates(candidates: MovementCandidate[], filter: CandidateFilter): MovementCandidate[] {
  return candidates
    .filter((candidate) => candidate.status !== "excluded")
    // A status filter matches tallied candidates only; an untallied one is not shown as "needs ratings".
    .filter((candidate) => filter.status === "all" || candidate.status === filter.status)
    .filter((candidate) => filter.match === "all" || filter.match === candidate.match)
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status ?? "needs-ratings"] - STATUS_ORDER[b.status ?? "needs-ratings"] ||
        Number(a.match === "known") - Number(b.match === "known") ||
        b.snr - a.snr,
    );
}

/** The whole review order: the test targets first, then the candidates. */
export function reviewQueue(candidates: MovementCandidate[], filter: CandidateFilter = ALL_CANDIDATES): ReviewEntry[] {
  return [
    ...TEST_TARGETS.map(
      (target): ReviewEntry => ({ kind: "test", id: target.id, name: target.name, point: target, target }),
    ),
    ...orderCandidates(candidates, filter).map(
      (candidate): ReviewEntry => ({
        kind: "candidate",
        id: candidate.id,
        name: candidate.id,
        point: candidate,
        candidate,
      }),
    ),
  ];
}

/** The entry at a position, within `toleranceDeg` (one arcsecond by default). */
export function findReviewEntry(
  queue: ReviewEntry[],
  { ra, dec }: EquatorialCoordinates,
  toleranceDeg = 1 / 3600,
): ReviewEntry | undefined {
  return queue.find(({ point }) => {
    const dRa = (((ra - point.ra + 540) % 360) - 180) * Math.cos((dec * Math.PI) / 180);
    return Math.hypot(dRa, dec - point.dec) <= toleranceDeg;
  });
}
