import "server-only";

import { api } from "@/lib/ky";
import type { BrightNeighbor, FplExposure, FplSearchResult } from "@/app/_lib/fpl/types";
import { propagate, separationArcsec } from "@/app/_lib/sky/wcs";
import { parseCsv } from "../../sky/_server/archive";
import { gaiaQuery } from "../../sky/_server/gaia";

/** All SPHEREx DR1 exposures whose footprint contains the position (IRSA SIA2). Nothing is cached. */
export async function searchSpherex(ra: number, dec: number): Promise<FplSearchResult> {
  const queryUrl = `https://irsa.ipac.caltech.edu/SIA?COLLECTION=spherex_dr1&POS=${encodeURIComponent(`CIRCLE ${ra} ${dec} 0.0005`)}&RESPONSEFORMAT=CSV`;
  const rows = parseCsv(await api.get(queryUrl, { timeout: 50_000 }).text());
  const seen = new Set<string>();
  const exposures: FplExposure[] = [];
  for (const r of rows) {
    if (r.dataproduct_subtype !== "science") continue;
    const detector = r.energy_bandpassname.replace("SPHEREx-", "");
    const key = `${r.obs_id}:${detector}`;
    // One file per exposure+detector: a reprocessed copy is not an independent observation.
    if (seen.has(key)) continue;
    seen.add(key);
    exposures.push({
      key,
      obsId: r.obs_id,
      detector,
      tStart: Number(r.t_min),
      tEnd: Number(r.t_max),
      emMinUm: Number(r.em_min) * 1e6,
      emMaxUm: Number(r.em_max) * 1e6,
      fileUrl: r.access_url,
      collection: r.obs_collection,
    });
  }
  exposures.sort((a, b) => a.tStart - b.tStart);
  return { ra, dec, queryUrl, searchedAt: new Date().toISOString(), exposures };
}

/**
 * Bright Gaia DR3 stars near the candidate (saturation / ghost / bloom sources), moved from Gaia's 2016.0
 * positions to the observation epoch with their proper motion (parallax ignored). The cone is widened by
 * 150″ so fast movers such as Barnard's Star are not missed, then cut back to `radiusArcsec`.
 */
export async function brightNeighbors(
  ra: number,
  dec: number,
  radiusArcsec: number,
  maxG: number,
  epochYear: number,
): Promise<{ stars: BrightNeighbor[]; query: string; service: string; epochYear: number }> {
  const template =
    `SELECT TOP 50 source_id, ra, dec, pmra, pmdec, phot_g_mean_mag FROM {table} ` +
    `WHERE 1=CONTAINS(POINT('ICRS',ra,dec), CIRCLE('ICRS',${ra},${dec},${(radiusArcsec + 150) / 3600})) ` +
    `AND phot_g_mean_mag < ${maxG} ORDER BY phot_g_mean_mag`;
  const { csv, service, query } = await gaiaQuery(template);
  const stars = parseCsv(csv)
    .map((r) => {
      const p = propagate(Number(r.ra), Number(r.dec), Number(r.pmra) || 0, Number(r.pmdec) || 0, 2016, epochYear);
      return {
        sourceId: r.source_id,
        ra: p.ra,
        dec: p.dec,
        gmag: Number(r.phot_g_mean_mag),
        separationArcsec: separationArcsec(ra, dec, p.ra, p.dec),
      };
    })
    .filter((s) => s.separationArcsec <= radiusArcsec)
    .sort((a, b) => a.separationArcsec - b.separationArcsec);
  return { stars, query, service, epochYear };
}
