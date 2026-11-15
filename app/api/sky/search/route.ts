import type { NextRequest } from "next/server";
import { z } from "zod";
import { cachedJson, keyCoordinate } from "@/app/api/_server/response-cache";
import { errorResponse, NO_STORE, parseQuery } from "../../comet/_server/respond";
import { searchMission } from "../_server/archive";

export const maxDuration = 60;

const querySchema = z
  .object({
    mission: z.enum(["2mass", "wise", "neowise", "spherex"]),
    ra: z.coerce.number().min(0).max(360),
    dec: z.coerce.number().min(-90).max(90),
    /** Search radius in degrees: frames overlapping this circle are listed. */
    radius: z.coerce.number().min(0.0005).max(0.2),
  })
  .strict();

/** GET /api/sky/search — one mission's real observing windows at a position (IRSA SIA2, nothing cached). */
export async function GET(request: NextRequest) {
  const q = parseQuery(request.nextUrl, querySchema);
  if (!q.ok) return q.response;
  try {
    return await cachedJson("sky/search", { ...q.data, ra: keyCoordinate(q.data.ra), dec: keyCoordinate(q.data.dec) }, () => searchMission(q.data.mission, q.data.ra, q.data.dec, q.data.radius), NO_STORE);
  } catch (error) {
    return errorResponse(error);
  }
}
