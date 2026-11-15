import type { MessageKey } from "@/app/_i18n/message-keys";

/** Rating choices in the API (decision #12) and their UI labels as translation keys (Moving / Not moving / Noise or artifact). */
export const RATING_CHOICES = ["moving", "not-moving", "noise-or-artifact"] as const;
export type RatingChoiceId = (typeof RATING_CHOICES)[number];

export const RATING_KEYS: Record<RatingChoiceId, MessageKey> = {
  moving: "review.moving",
  "not-moving": "review.notMoving",
  "noise-or-artifact": "review.noiseOrArtifact",
};

/** Decorative emoji shown before each label (hidden from screen readers). */
export const RATING_EMOJI: Record<RatingChoiceId, string> = {
  moving: "🌠",
  "not-moving": "📍",
  "noise-or-artifact": "⚡",
};

/** Below this many ratings the point shows "Too few ratings" (PLAN.md chapter 8). */
export const MIN_RATINGS = 5;

/** Most points one summary request may ask about (the "Places to analyze" list). */
export const MAX_SUMMARY_POINTS = 50;

export type RatingTally = { total: number; moving: number; notMoving: number; noiseOrArtifact: number };

/** One point's rating state. `tally` is null until this browser has rated the point, so others' ratings stay hidden. */
export interface RatingState {
  mine: RatingChoiceId | null;
  tally: RatingTally | null;
}

/** Share of "Moving" ratings as a whole percent (the agreement, glossary). */
export const movingShare = (tally: RatingTally) => Math.round((tally.moving / tally.total) * 100);

/** How many places the "Most rated places" board lists. */
export const MOST_RATED_LIMIT = 10;

/**
 * One row of the Review queue's "Most rated" tab (decision #58): the sky cell's center, how many ratings it has, and this browser's
 * state there. Shares appear only where this browser has rated (decision #6); the count alone shows no direction.
 */
export interface MostRatedPlace {
  ra: number;
  dec: number;
  total: number;
  state: RatingState;
  /**
   * The reviewed candidate in this cell (the one with the highest SNR if there are several), at its SPHEREx position,
   * so the row can name it and open it where it is. Null for a cell with no candidate.
   */
  candidate: { id: string; match: "known" | "unidentified"; ra: number; dec: number } | null;
}
