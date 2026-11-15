import type { NextRequest } from "next/server";
import { z } from "zod";
import { cachedJson, keyCoordinate } from "@/app/api/_server/response-cache";
import { fetchFrame } from "../../comet/_server/irsa";
import { errorResponse, NO_STORE, parseQuery } from "../../comet/_server/respond";

export const maxDuration = 60;

const querySchema = z
  .object({
    obsId: z.string().regex(/^\d{4}W\d{2}_\w{2}_\d{4}_\d+$/),
    detector: z.enum(["D1", "D2", "D3", "D4", "D5", "D6"]),
    ra: z.coerce.number().min(0).max(360),
    dec: z.coerce.number().min(-90).max(90),
    size: z.coerce.number().int().min(32).max(96).default(64),
  })
  .strict();

/**
 * GET /api/fpl/frame — native-pixel IMAGE / FLAGS / VARIANCE / ZODI cutout of one SPHEREx exposure,
 * read by byte range from the archive, with WCS, wavelength lookup and the FLAGS bit definitions.
 */
export async function GET(request: NextRequest) {
  const q = parseQuery(request.nextUrl, querySchema);
  if (!q.ok) return q.response;
  try {
    return await cachedJson("fpl/frame", { ...q.data, ra: keyCoordinate(q.data.ra), dec: keyCoordinate(q.data.dec) }, () => fetchFrame(q.data), NO_STORE);
  } catch (error) {
    return errorResponse(error);
  }
}
