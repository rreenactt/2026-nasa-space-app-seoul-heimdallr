import type { NextRequest } from "next/server";
import { z } from "zod";
import { fetchGeometry } from "../_server/irsa";
import { errorResponse, NO_STORE, parseQuery } from "../_server/respond";

export const maxDuration = 30;

const querySchema = z.object({ mjd: z.coerce.number().min(60000).max(70000) }).strict();

/** GET /api/comet/geometry?mjd= — heliocentric / geocentric distance from JPL Horizons. */
export async function GET(request: NextRequest) {
  const q = parseQuery(request.nextUrl, querySchema);
  if (!q.ok) return q.response;
  try {
    return Response.json(await fetchGeometry(q.data.mjd), { headers: NO_STORE });
  } catch (error) {
    return errorResponse(error);
  }
}
