import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, NO_STORE, parseQuery } from "../../comet/_server/respond";
import { fetchGaia } from "../_server/archive";

export const maxDuration = 60;

const querySchema = z
  .object({
    ra: z.coerce.number().min(0).max(360),
    dec: z.coerce.number().min(-90).max(90),
    radius: z.coerce.number().min(0.001).max(0.2),
    minPm: z.coerce.number().min(10).max(5000).default(50),
  })
  .strict();

/** GET /api/sky/gaia — Gaia DR3 stars with proper motion in the field (IRSA TAP), for predicted paths. */
export async function GET(request: NextRequest) {
  const q = parseQuery(request.nextUrl, querySchema);
  if (!q.ok) return q.response;
  try {
    return Response.json(await fetchGaia(q.data.ra, q.data.dec, q.data.radius, q.data.minPm), { headers: NO_STORE });
  } catch (error) {
    return errorResponse(error);
  }
}
