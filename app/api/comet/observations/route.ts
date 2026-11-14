import { fetchObservationIndex } from "../_server/irsa";
import { errorResponse, NO_STORE } from "../_server/respond";

export const maxDuration = 30;

/** GET /api/comet/observations — the IRSA 3I/ATLAS observation list, parsed on each request. */
export async function GET() {
  try {
    return Response.json(await fetchObservationIndex(), { headers: NO_STORE });
  } catch (error) {
    return errorResponse(error);
  }
}
