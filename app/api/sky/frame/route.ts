import { z } from "zod";
import { cachedJson, keyCoordinate } from "@/app/api/_server/response-cache";
import { errorResponse, NO_STORE } from "../../comet/_server/respond";
import { buildEpochFrame, IBE_PREFIX, UpstreamNotFound } from "../_server/archive";

export const maxDuration = 60;

const exposureSchema = z
  .object({
    id: z.string().max(200),
    collection: z.string().max(40),
    band: z.string().max(8),
    tStart: z.number(),
    tEnd: z.number(),
    source: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("ibe"), url: z.string().regex(IBE_PREFIX) }).strict(),
      z
        .object({
          kind: z.literal("spherex"),
          obsId: z.string().regex(/^\d{4}W\d{2}_\w{2}_\d{4}_\d+$/),
          detector: z.enum(["D1", "D2", "D3", "D4", "D5", "D6"]),
        })
        .strict(),
    ]),
    pixelScaleArcsec: z.number(),
    center: z.tuple([z.number(), z.number()]).nullable(),
  })
  .strict();

const bodySchema = z
  .object({
    epoch: z
      .object({
        id: z.string().max(200),
        mission: z.enum(["2mass", "wise", "neowise", "spherex"]),
        product: z.string().max(200),
        collections: z.array(z.string().max(40)).max(4),
        band: z.string().max(8),
        wavelengthLabel: z.string().max(60),
        timeStart: z.number(),
        timeEnd: z.number(),
        exposures: z.array(exposureSchema).min(1).max(6),
        totalExposures: z.number().int(),
      })
      .strict(),
    grid: z
      .object({
        ra: z.number().min(0).max(360),
        dec: z.number().min(-90).max(90),
        fovArcmin: z.number().min(1).max(15),
        n: z.number().int().min(64).max(320),
      })
      .strict(),
  })
  .strict();

/**
 * POST /api/sky/frame — downloads the epoch's exposures (small cutouts / byte ranges), resamples them onto
 * the common grid and median-combines them. Returns the grid image. Precomputed answers are read from R2
 * (response-cache.ts); nothing else is stored.
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: z.prettifyError(parsed.error) }, { status: 400 });
  try {
    return await cachedJson(
      "sky/frame",
      { ...parsed.data, grid: { ...parsed.data.grid, ra: keyCoordinate(parsed.data.grid.ra), dec: keyCoordinate(parsed.data.grid.dec) } },
      () => buildEpochFrame(parsed.data.epoch, parsed.data.grid),
      NO_STORE,
    );
  } catch (error) {
    if (error instanceof UpstreamNotFound) return Response.json({ message: error.message }, { status: 404 });
    return errorResponse(error);
  }
}
