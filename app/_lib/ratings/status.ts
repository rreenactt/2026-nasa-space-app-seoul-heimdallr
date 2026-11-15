import { MIN_RATINGS, type RatingTally } from "./types";

/** A candidate's status from its ratings (PLAN.md chapter 7, decision #57). */
export type RatedStatus = "noteworthy" | "needs-ratings" | "recommended" | "excluded";

/** Thresholds from the chapter 7 table, kept in this one place (the server list and the panel both use them). */
export const STATUS_RULES = {
  /** Ratings needed before a status other than "needs ratings". */
  minRatings: MIN_RATINGS,
  /** Ratings and Moving share an unidentified pair needs to be noteworthy. */
  noteworthyRatings: 10,
  noteworthyMoving: 0.7,
  /** Below this Moving share, or at this Noise or artifact share, an unidentified pair leaves the queue. */
  recommendMoving: 0.3,
  excludeNoise: 0.5,
} as const;

/**
 * The status a tally gives a candidate, or undefined with no ratings (no status is made up, absolute principle 4).
 * A known mover is never excluded or noteworthy: it is the answer key, so a low Moving share means the motion is hard
 * to see in the blink, not that Gaia DR3 is wrong.
 */
export function ratingStatus(tally: RatingTally | null | undefined, match: "known" | "unidentified"): RatedStatus | undefined {
  if (!tally || tally.total === 0) return undefined;
  if (tally.total < STATUS_RULES.minRatings) return "needs-ratings";
  if (match === "known") return "recommended";
  const moving = tally.moving / tally.total;
  if (tally.total >= STATUS_RULES.noteworthyRatings && moving >= STATUS_RULES.noteworthyMoving) return "noteworthy";
  if (moving < STATUS_RULES.recommendMoving || tally.noiseOrArtifact / tally.total >= STATUS_RULES.excludeNoise) {
    return "excluded";
  }
  return "recommended";
}
