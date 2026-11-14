import type { NextRequest } from "next/server";
import { mostRatedCells } from "@/data/ratings";
import { MOST_RATED_LIMIT, type MostRatedPlace } from "@/app/_lib/ratings/types";
import { pix2angNest, RATING_HPX_ORDER } from "../_server/healpix";
import { NO_STORE, RATING_RELEASE, readVoter, statesFor } from "../_server/ratings";

/** GET /api/ratings/top — the most rated sky cells with their rating counts ("Most rated places" board). */
export async function GET(request: NextRequest) {
  const cells = await mostRatedCells(RATING_RELEASE, MOST_RATED_LIMIT);
  const centers = cells.map((cell) => pix2angNest(RATING_HPX_ORDER, cell.hpxIndex));
  const states = await statesFor(centers, readVoter(request));
  const places: MostRatedPlace[] = cells.map((cell, i) => ({ ...centers[i], total: cell.total, state: states[i] }));
  return Response.json(places, { headers: NO_STORE });
}
