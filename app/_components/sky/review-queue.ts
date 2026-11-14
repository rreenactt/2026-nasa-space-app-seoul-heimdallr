import type { EquatorialCoordinates } from "./sky-coordinates";
import { TEST_TARGETS, type TestTarget } from "./test-targets";

/** A candidate's state after the periodic tally of ratings (PLAN.md chapter 7, candidates/status.json). */
export type CandidateStatus = "noteworthy" | "needs-ratings" | "recommended" | "excluded";

/**
 * One movement candidate from the detection pipeline (PLAN.md chapter 7, "후보 항목"). Fields follow the batch files
 * the website will read (candidates/index.json); nothing here is computed in the browser.
 */
export type MovementCandidate = EquatorialCoordinates & {
  /** Fixed ID made from the release and the position, so re-detections merge and ratings stick to it. */
  id: string;
  /** Observation time of the position (absolute principle 6), ISO 8601. */
  observedAt: string;
  /** Number of epochs the source was detected in. */
  detections: number;
  detector: string;
  wavelengthUm: number;
  snr: number;
  /** Designation of the known asteroid it matches, or null for an unidentified candidate. */
  knownAsteroid: string | null;
  batchId: string;
  /** From candidates/status.json; absent until ratings are tallied, and never filled in by the website. */
  status?: CandidateStatus;
};

/**
 * Movement candidates produced so far. Empty: the pipeline has not produced a batch yet, and the list shows that
 * instead of inventing entries (absolute principle 4). Load candidates/index.json here once batches exist.
 */
export const MOVEMENT_CANDIDATES: MovementCandidate[] = [];

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
 * spread evenly, then recommended ones. Not yet tallied counts as short of ratings.
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
    .filter(
      (candidate) =>
        filter.match === "all" || (filter.match === "known") === (candidate.knownAsteroid !== null),
    )
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status ?? "needs-ratings"] - STATUS_ORDER[b.status ?? "needs-ratings"] || b.snr - a.snr,
    );
}

/** The whole review order: the test targets first, then the candidates. */
export function reviewQueue(filter: CandidateFilter = ALL_CANDIDATES): ReviewEntry[] {
  return [
    ...TEST_TARGETS.map(
      (target): ReviewEntry => ({ kind: "test", id: target.id, name: target.name, point: target, target }),
    ),
    ...orderCandidates(MOVEMENT_CANDIDATES, filter).map(
      (candidate): ReviewEntry => ({
        kind: "candidate",
        id: candidate.id,
        name: `Candidate ${candidate.id}`,
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

/** The entry after the current one, wrapping around; the first entry when the current point is not in the queue. */
export function nextReviewEntry(queue: ReviewEntry[], current: ReviewEntry | undefined): ReviewEntry | undefined {
  if (queue.length === 0) return undefined;
  const index = current ? queue.findIndex((entry) => entry.id === current.id) : -1;
  const next = queue[(index + 1) % queue.length];
  return next.id === current?.id ? undefined : next;
}
