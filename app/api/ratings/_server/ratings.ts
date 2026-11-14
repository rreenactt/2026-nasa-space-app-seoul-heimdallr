import "server-only";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { ratingStates } from "@/data/ratings";
import type { RatingChoice } from "@/prisma/client";
import type { RatingChoiceId, RatingState } from "@/app/_lib/ratings/types";
import { ang2pixNest, RATING_HPX_ORDER } from "./healpix";

/** The blink panel compares SPHEREx DR1 images only (PLAN.md chapter 4), so every rating is of DR1. */
export const RATING_RELEASE = "DR1";

export const VOTER_COOKIE = "hd_voter";
export const NO_STORE = { "Cache-Control": "no-store" } as const;

export const TO_DB: Record<RatingChoiceId, RatingChoice> = {
  moving: "MOVING",
  "not-moving": "NOT_MOVING",
  "noise-or-artifact": "NOISE_OR_ARTIFACT",
};
const FROM_DB = Object.fromEntries(Object.entries(TO_DB).map(([id, db]) => [db, id])) as Record<RatingChoice, RatingChoiceId>;

export const raSchema = z.coerce.number().min(0).lt(360);
export const decSchema = z.coerce.number().min(-90).max(90);

/** The fixed sky cell a point falls in (absolute principle 2). */
export const cellOf = (ra: number, dec: number) => ang2pixNest(RATING_HPX_ORDER, ra, dec);

export function readVoter(request: NextRequest): string | null {
  const value = request.cookies.get(VOTER_COOKIE)?.value;
  return value && z.uuid().safeParse(value).success ? value : null;
}

/** Rating states for points, in order. Others' ratings stay hidden until rated (decision #6), enforced here. */
export async function statesFor(points: { ra: number; dec: number }[], voterId: string | null): Promise<RatingState[]> {
  const cells = points.map((p) => cellOf(p.ra, p.dec));
  const states = await ratingStates(RATING_RELEASE, [...new Set(cells)], voterId);
  const byCell = new Map([...new Set(cells)].map((cell, i) => [cell, states[i]]));
  return cells.map((cell) => {
    const { choice, tally } = byCell.get(cell)!;
    return { mine: choice && FROM_DB[choice], tally };
  });
}
