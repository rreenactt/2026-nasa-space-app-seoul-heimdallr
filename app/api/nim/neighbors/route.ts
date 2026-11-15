import { EXTRA_GAIA_IDS, GAIA_NAMES, LITERATURE_OBJECTS } from "@/app/_lib/nim/catalog";
import type { NeighborCatalog, NeighborObject } from "@/app/_lib/nim/types";
import { errorResponse, NO_STORE } from "../../comet/_server/respond";
import { parseCsv } from "../../sky/_server/archive";
import { gaiaQuery } from "../../sky/_server/gaia";
import { cachedJson } from "@/app/api/_server/response-cache";

export const maxDuration = 60;

const COLUMNS =
  "source_id, ra, dec, ref_epoch, parallax, parallax_error, pmra, pmra_error, pmdec, pmdec_error, " +
  "radial_velocity, radial_velocity_error, ruwe, phot_g_mean_mag, parallax_pmra_corr, parallax_pmdec_corr, pmra_pmdec_corr";

const num = (s: string) => (s === "" || s == null ? null : Number(s));

/**
 * GET /api/nim/neighbors — Gaia DR3 sources with parallax > 280 mas (≈3.6 pc) plus the ε Indi system, and
 * literature objects missing from Gaia. Queried live (ESA Gaia Archive, IRSA fallback) unless a precomputed answer is in R2 (response-cache.ts).
 */
async function buildCatalog(): Promise<NeighborCatalog> {
  const template = `SELECT ${COLUMNS} FROM {table} WHERE parallax > 280 OR source_id IN (${EXTRA_GAIA_IDS.join(",")}) ORDER BY parallax DESC`;
  const { csv, service, query } = await gaiaQuery(template);
  const objects: NeighborObject[] = parseCsv(csv).map((r) => {
    const named = GAIA_NAMES[r.source_id];
    const rv = num(r.radial_velocity);
    return {
      id: `gaia:${r.source_id}`,
      name: named?.name ?? `Gaia DR3 ${r.source_id}`,
      nameBasis: named ? "Matched by position, parallax and brightness" : "No name assigned",
      kind: named?.kind ?? "Star",
      source: { catalog: "Gaia DR3", sourceId: r.source_id, service },
      epoch: Number(r.ref_epoch),
      ra: Number(r.ra),
      dec: Number(r.dec),
      parallax: { value: Number(r.parallax), error: num(r.parallax_error) },
      pmra: { value: Number(r.pmra), error: num(r.pmra_error) },
      pmdec: { value: Number(r.pmdec), error: num(r.pmdec_error) },
      radialVelocity: rv == null ? null : { value: rv, error: num(r.radial_velocity_error) },
      correlations: {
        parallaxPmra: num(r.parallax_pmra_corr) ?? 0,
        parallaxPmdec: num(r.parallax_pmdec_corr) ?? 0,
        pmraPmdec: num(r.pmra_pmdec_corr) ?? 0,
      },
      ruwe: num(r.ruwe),
      gmag: num(r.phot_g_mean_mag),
      notes: named?.notes ?? [],
    };
  });
  const body: NeighborCatalog = {
    objects: [...objects, ...LITERATURE_OBJECTS].sort((a, b) => b.parallax.value - a.parallax.value),
    queries: [{ service, query }],
    fetchedAt: new Date().toISOString(),
  };
  return body;
}

export async function GET() {
  try {
    return await cachedJson("nim/neighbors", {}, buildCatalog, NO_STORE);
  } catch (error) {
    return errorResponse(error);
  }
}
