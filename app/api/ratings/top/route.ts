import type { NextRequest } from "next/server";
import { reviewCandidatesInCells } from "@/data/motion-candidates";
import { mostRatedCells } from "@/data/ratings";
import { toMovementCandidate } from "@/app/_components/sky/candidate-batch";
import { MOST_RATED_LIMIT, type MostRatedPlace } from "@/app/_lib/ratings/types";
import { pix2angNest, RATING_HPX_ORDER } from "../_server/healpix";
import { NO_STORE, RATING_RELEASE, readVoter, statesFor } from "../_server/ratings";

/**
 * The candidate in each cell, by cell. Candidates and ratings share the HEALPix order-11 cells; the survey names its
 * release "spherex_dr1" where ratings say "DR1", so only a DR1 survey is joined. A failed lookup leaves the rows
 * unnamed rather than failing the whole list.
 */
async function candidatesByCell(hpxIndexes: number[]): Promise<Map<number, MostRatedPlace["candidate"]>> {
  const byCell = new Map<number, MostRatedPlace["candidate"]>();
  try {
    const found = await reviewCandidatesInCells(hpxIndexes);
    if (!found || !found.release.toUpperCase().endsWith(RATING_RELEASE)) return byCell;
    for (const row of found.rows) {
      if (byCell.has(row.hpxIndex)) continue; // rows come highest SNR first
      const candidate = toMovementCandidate(row, found.surveyId);
      byCell.set(row.hpxIndex, { id: candidate.id, match: candidate.match, ra: candidate.ra, dec: candidate.dec });
    }
  } catch (error) {
    console.error("Could not name the most rated cells", error instanceof Error ? error.name : "unknown error");
  }
  return byCell;
}

/**
 * GET /api/ratings/top — the most rated sky cells with their rating counts (the Review queue's "Most rated" tab,
 * decision #58), each with the candidate it holds, if any.
 */
export async function GET(request: NextRequest) {
  const cells = await mostRatedCells(RATING_RELEASE, MOST_RATED_LIMIT);
  const centers = cells.map((cell) => pix2angNest(RATING_HPX_ORDER, cell.hpxIndex));
  const [states, byCell] = await Promise.all([
    statesFor(centers, readVoter(request)),
    candidatesByCell(cells.map((cell) => cell.hpxIndex)),
  ]);
  const places: MostRatedPlace[] = cells.map((cell, i) => ({
    ...centers[i],
    total: cell.total,
    state: states[i],
    candidate: byCell.get(cell.hpxIndex) ?? null,
  }));
  return Response.json(places, { headers: NO_STORE });
}
