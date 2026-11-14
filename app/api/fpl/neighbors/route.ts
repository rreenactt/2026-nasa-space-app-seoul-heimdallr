import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, NO_STORE, parseQuery } from "../../comet/_server/respond";
import { brightNeighbors } from "../_server/search";

export const maxDuration = 60;

const querySchema = z
  .object({
    ra: z.coerce.number().min(0).max(360),
    dec: z.coerce.number().min(-90).max(90),
    radius: z.coerce.number().min(5).max(300).default(120),
    maxG: z.coerce.number().min(3).max(16).default(12),
    /** Decimal year of the observation; Gaia positions are moved to it. */
    epoch: z.coerce.number().min(2000).max(2040).default(2025.8),
  })
  .strict();

/** GET /api/fpl/neighbors — bright Gaia DR3 stars around a candidate, moved to the observation epoch (ESA Gaia Archive, IRSA fallback). */
export async function GET(request: NextRequest) {
  const q = parseQuery(request.nextUrl, querySchema);
  if (!q.ok) return q.response;
  try {
    return Response.json(await brightNeighbors(q.data.ra, q.data.dec, q.data.radius, q.data.maxG, q.data.epoch), { headers: NO_STORE });
  } catch (error) {
    return errorResponse(error);
  }
}
