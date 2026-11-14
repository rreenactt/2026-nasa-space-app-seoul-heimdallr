import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { saveRating } from "@/data/ratings";
import { RATING_CHOICES } from "@/app/_lib/ratings/types";
import {
  cellOf,
  decSchema,
  NO_STORE,
  RATING_RELEASE,
  raSchema,
  readVoter,
  statesFor,
  TO_DB,
  VOTER_COOKIE,
} from "./_server/ratings";

const querySchema = z.object({ ra: raSchema, dec: decSchema }).strict();
const bodySchema = z
  .object({ ra: raSchema, dec: decSchema, choice: z.enum(RATING_CHOICES), visitCount: z.number().int().min(0).max(1000) })
  .strict();

/** GET /api/ratings?ra=&dec= — this browser's rating of the point's sky cell, and the tally once rated. */
export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return Response.json({ message: z.prettifyError(parsed.error) }, { status: 400 });
  const [state] = await statesFor([parsed.data], readVoter(request));
  return Response.json(state, { headers: NO_STORE });
}

/** PUT /api/ratings — creates or changes this browser's rating. Issues the anonymous voter cookie on first use. */
export async function PUT(request: NextRequest) {
  // The voter cookie rides along on any request to this site, so refuse writes sent from other sites.
  const origin = request.headers.get("origin");
  if (!origin || !URL.canParse(origin) || new URL(origin).host !== request.headers.get("host")) {
    return Response.json({ message: "Cross-site request refused" }, { status: 403 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: z.prettifyError(parsed.error) }, { status: 400 });

  const { ra, dec, choice, visitCount } = parsed.data;
  const existing = readVoter(request);
  const voterId = existing ?? crypto.randomUUID();
  await saveRating({ release: RATING_RELEASE, hpxIndex: cellOf(ra, dec) }, voterId, TO_DB[choice], visitCount);

  const [state] = await statesFor([{ ra, dec }], voterId);
  const response = NextResponse.json(state, { headers: NO_STORE });
  if (!existing) {
    response.cookies.set(VOTER_COOKIE, voterId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/ratings",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}
