import type { NextRequest } from "next/server";
import { z } from "zod";
import { findReviewCandidate } from "@/data/motion-candidates";
import { toMovementCandidate } from "@/app/_components/sky/candidate-batch";
import type { CandidateLookup } from "@/app/_components/sky/review-queue";
import { parseSkyName } from "@/app/_components/sky/sky-search";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** A candidate name is truncated from the SPHEREx position, so it can sit up to about 1.5″ (RA) and 1″ (Dec) away. */
const NAME_RADIUS_ARCSEC = 3;

const querySchema = z.object({ name: z.string().trim().min(8).max(40) }).strict();

/**
 * GET /api/candidates/lookup?name=J… — the reviewed candidate (known mover or unidentified) of the latest survey run
 * that a J-name points to. Read from the database on every call, never cached, so a search finds candidates added
 * since the page loaded and not those removed. A 2MASS designation matches the candidate paired with that source (its
 * SPHEREx position, not the 1997–2001 one); a candidate name matches the candidate at its position.
 */
export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  const name = parsed.success ? parseSkyName(parsed.data.name) : null;
  if (!name) {
    return Response.json({ message: "Give a J-name, for example J082927.2+550714." }, { status: 400, headers: NO_STORE });
  }
  try {
    const found = await findReviewCandidate(
      name.twoMass
        ? { tmassDesignation: `2MASS ${name.designation}` }
        : { ...name.point, radiusArcsec: NAME_RADIUS_ARCSEC },
    );
    const body: CandidateLookup = {
      candidate: found ? toMovementCandidate(found.row, found.surveyId) : null,
      point: name.point,
    };
    return Response.json(body, { headers: NO_STORE });
  } catch (error) {
    console.error("Candidate lookup failed", error instanceof Error ? error.name : "unknown error");
    return Response.json({ message: "Could not reach the candidate list." }, { status: 503, headers: NO_STORE });
  }
}
