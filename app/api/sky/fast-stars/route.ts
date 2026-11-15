import type { NextRequest } from "next/server";
import { z } from "zod";
import type { GaiaStar } from "@/app/_lib/sky/types";
import { errorResponse, NO_STORE, parseQuery } from "../../comet/_server/respond";
import { parseCsv } from "../_server/archive";
import { gaiaQuery } from "../_server/gaia";

export const maxDuration = 60;

/** Most stars one answer carries; the fastest come first, so a cut-off answer drops the slowest. */
const MAX_STARS = 300;

const querySchema = z
  .object({
    ra: z.coerce.number().min(0).max(360),
    dec: z.coerce.number().min(-90).max(90),
    radius: z.coerce.number().min(0.01).max(1.5),
    minPm: z.coerce.number().min(20).max(5000),
  })
  .strict();

/**
 * GET /api/sky/fast-stars — Gaia DR3 stars faster than `minPm` (mas/yr) in a cone, for the sky screen's
 * experimental fast-moving-stars layer. Wider than /api/sky/gaia (one zoomed-in sky view, not one cutout).
 */
export async function GET(request: NextRequest) {
  const q = parseQuery(request.nextUrl, querySchema);
  if (!q.ok) return q.response;
  const { ra, dec, radius, minPm } = q.data;
  try {
    const template =
      `SELECT TOP ${MAX_STARS} source_id, ra, dec, pmra, pmdec, parallax, phot_g_mean_mag FROM {table} ` +
      `WHERE 1=CONTAINS(POINT('ICRS',ra,dec), CIRCLE('ICRS',${ra},${dec},${radius})) AND pm > ${minPm} ` +
      `ORDER BY pm DESC`;
    const { csv, service } = await gaiaQuery(template);
    const stars: GaiaStar[] = parseCsv(csv).map((r) => ({
      sourceId: r.source_id,
      ra: Number(r.ra),
      dec: Number(r.dec),
      pmra: Number(r.pmra),
      pmdec: Number(r.pmdec),
      parallax: r.parallax ? Number(r.parallax) : null,
      gmag: r.phot_g_mean_mag ? Number(r.phot_g_mean_mag) : null,
    }));
    return Response.json({ stars, service, truncated: stars.length >= MAX_STARS }, { headers: NO_STORE });
  } catch (error) {
    return errorResponse(error);
  }
}
