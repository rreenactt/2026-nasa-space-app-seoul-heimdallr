import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, NO_STORE, parseQuery } from "../../comet/_server/respond";
import { buildPlan } from "../_server/plan";

export const maxDuration = 60;

const querySchema = z
  .object({
    ra: z.coerce.number().min(0).lt(360),
    dec: z.coerce.number().min(-90).max(90),
    detector: z.enum(["D1", "D2", "D3", "D4", "D5", "D6"]).optional(),
  })
  .strict();

/**
 * GET /api/blink/plan — the basic analysis plan for a point: SPHEREx DR1 exposures grouped into visits, with the
 * wavelength at the target estimated per exposure and only frames within the wavelength tolerance kept.
 */
export async function GET(request: NextRequest) {
  const q = parseQuery(request.nextUrl, querySchema);
  if (!q.ok) return q.response;
  try {
    return Response.json(await buildPlan(q.data.ra, q.data.dec, q.data.detector), { headers: NO_STORE });
  } catch (error) {
    return errorResponse(error);
  }
}
