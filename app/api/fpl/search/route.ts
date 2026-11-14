import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, NO_STORE, parseQuery } from "../../comet/_server/respond";
import { searchSpherex } from "../_server/search";

export const maxDuration = 60;

const querySchema = z.object({ ra: z.coerce.number().min(0).max(360), dec: z.coerce.number().min(-90).max(90) }).strict();

/** GET /api/fpl/search — SPHEREx DR1 exposures covering a position. */
export async function GET(request: NextRequest) {
  const q = parseQuery(request.nextUrl, querySchema);
  if (!q.ok) return q.response;
  try {
    return Response.json(await searchSpherex(q.data.ra, q.data.dec), { headers: NO_STORE });
  } catch (error) {
    return errorResponse(error);
  }
}
