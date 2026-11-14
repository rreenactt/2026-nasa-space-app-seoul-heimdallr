import type { NextRequest } from "next/server";
import { z } from "zod";
import { MAX_SUMMARY_POINTS } from "@/app/_lib/ratings/types";
import { decSchema, NO_STORE, raSchema, readVoter, statesFor } from "../_server/ratings";

const querySchema = z.object({ points: z.string() }).strict();
const pointsSchema = z
  .array(z.object({ ra: raSchema, dec: decSchema }).strict())
  .min(1)
  .max(MAX_SUMMARY_POINTS);

/** GET /api/ratings/summary?points=ra,dec;ra,dec — rating states of several points in order ("Places to analyze"). */
export async function GET(request: NextRequest) {
  const query = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  const points = pointsSchema.safeParse(
    query.success ? query.data.points.split(";").map((pair) => ({ ra: pair.split(",")[0], dec: pair.split(",")[1] })) : null,
  );
  if (!points.success) {
    return Response.json({ message: z.prettifyError(query.success ? points.error : query.error) }, { status: 400 });
  }
  return Response.json(await statesFor(points.data, readVoter(request)), { headers: NO_STORE });
}
