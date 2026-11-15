import { fetchObservationIndex } from "../_server/irsa";
import { cachedJson } from "@/app/api/_server/response-cache";
import { errorResponse, NO_STORE } from "../_server/respond";

export const maxDuration = 30;

/** GET /api/comet/observations — the IRSA 3I/ATLAS observation list, parsed on each request. */
export async function GET() {
  try {
    return await cachedJson("comet/observations", {}, fetchObservationIndex, NO_STORE);
  } catch (error) {
    return errorResponse(error);
  }
}
