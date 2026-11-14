import "server-only";

import { api } from "@/lib/ky";
import { headerNumber, readTableRow } from "@/app/_lib/comet/fits";
import { readRemoteHeaders } from "@/app/_lib/comet/remote-fits";
import { wavelengthAt } from "@/app/_lib/comet/wcs";
import type { WaveLookup } from "@/app/_lib/comet/types";
import type { BlinkPlan, DetectorSummary, PlannedExposure, PlannedVisit } from "@/app/_lib/blink/types";
import { rangeFetcher, resolvePixelFile } from "../../comet/_server/irsa";
import { parseCsv } from "../../sky/_server/archive";

export const BLINK_VERSION = "blink-plan-1";
const D2R = Math.PI / 180;
/** Exposures more than this many days apart start a new visit (visits are ~6 months apart). */
const VISIT_GAP_DAYS = 20;
/** Frames combined per visit (closest in wavelength first). */
const MAX_PER_VISIT = 3;
/** Wavelength tolerance: half the bandwidth at the reference wavelength (team value still open, PLAN.md ch. 4). */
const TOLERANCE_FRACTION = 0.5;

interface Row {
  obsId: string;
  detector: string;
  tStart: number;
  tEnd: number;
  emMin: number;
  emMax: number;
  fileUrl: string;
  corners: [number, number][];
}

/** Target position in detector pixels (0-based) from the footprint corners, which map to (0,0),(W,0),(W,H),(0,H). */
function pixelFromCorners(ra: number, dec: number, corners: [number, number][], W: number, H: number) {
  // Gnomonic (TAN) projection about the target: valid at the poles and across RA = 0.
  const a0 = ra * D2R;
  const d0 = dec * D2R;
  const proj = ([a, d]: [number, number]) => {
    const ar = a * D2R;
    const dr = d * D2R;
    const c = Math.sin(d0) * Math.sin(dr) + Math.cos(d0) * Math.cos(dr) * Math.cos(ar - a0);
    return [(Math.cos(dr) * Math.sin(ar - a0)) / c, (Math.cos(d0) * Math.sin(dr) - Math.sin(d0) * Math.cos(dr) * Math.cos(ar - a0)) / c];
  };
  const [p0, p1, p2, p3] = corners.map(proj);
  // Solve P(u,v) = 0 for the bilinear patch by Newton iteration.
  let u = 0.5, v = 0.5;
  for (let it = 0; it < 30; it++) {
    const P = [0, 1].map((k) => (1 - u) * (1 - v) * p0[k] + u * (1 - v) * p1[k] + u * v * p2[k] + (1 - u) * v * p3[k]);
    const Pu = [0, 1].map((k) => -(1 - v) * p0[k] + (1 - v) * p1[k] + v * p2[k] - v * p3[k]);
    const Pv = [0, 1].map((k) => -(1 - u) * p0[k] - u * p1[k] + u * p2[k] + (1 - u) * p3[k]);
    const det = Pu[0] * Pv[1] - Pu[1] * Pv[0];
    if (!det) break;
    const du = (P[0] * Pv[1] - P[1] * Pv[0]) / det;
    const dv = (Pu[0] * P[1] - Pu[1] * P[0]) / det;
    u -= du;
    v -= dv;
    if (Math.abs(du) + Math.abs(dv) < 1e-9) break;
  }
  return { x: u * (W - 1), y: v * (H - 1) };
}

async function readWaveTable(obsId: string, detector: string): Promise<{ lut: WaveLookup; W: number; H: number }> {
  const resolved = await resolvePixelFile(obsId, detector);
  const fetchRange = rangeFetcher(resolved.cloudUrl ?? resolved.fileUrl);
  const hdus = await readRemoteHeaders(fetchRange, ["IMAGE", "WCS-WAVE"]);
  const image = hdus.get("IMAGE");
  const wave = hdus.get("WCS-WAVE");
  if (!image || !wave) throw new Error("WCS-WAVE not found");
  const buf = await fetchRange(wave.dataOffset, wave.dataOffset + wave.dataLength - 1);
  const row = readTableRow(buf, { ...wave, dataOffset: 0 });
  const n = (k: string, d: number) => headerNumber(image, k) ?? d;
  return {
    lut: {
      x: row.X as number[],
      y: row.Y as number[],
      values: row.VALUES as number[],
      crpix: [n("CRPIX1W", 1), n("CRPIX2W", 1)],
      crval: [n("CRVAL1W", 1), n("CRVAL2W", 1)],
      cdelt: [n("CDELT1W", 1), n("CDELT2W", 1)],
    },
    W: n("NAXIS1", 2040),
    H: n("NAXIS2", 2040),
  };
}

function groupVisits<T extends { tStart: number }>(items: T[]): T[][] {
  const out: T[][] = [];
  for (const it of [...items].sort((a, b) => a.tStart - b.tStart)) {
    const last = out[out.length - 1];
    if (last && it.tStart - last[last.length - 1].tStart <= VISIT_GAP_DAYS) last.push(it);
    else out.push([it]);
  }
  return out;
}

export async function buildPlan(ra: number, dec: number, requested?: string): Promise<BlinkPlan> {
  const queryUrl = `https://irsa.ipac.caltech.edu/SIA?COLLECTION=spherex_dr1&POS=${encodeURIComponent(`CIRCLE ${ra} ${dec} 0.0005`)}&RESPONSEFORMAT=CSV`;
  const seen = new Set<string>();
  const rows: Row[] = [];
  for (const r of parseCsv(await api.get(queryUrl, { timeout: 50_000 }).text())) {
    if (r.dataproduct_subtype !== "science") continue;
    const detector = r.energy_bandpassname.replace("SPHEREx-", "");
    const key = `${r.obs_id}:${detector}`;
    if (seen.has(key)) continue; // one file per exposure+detector (latest release only)
    seen.add(key);
    const nums = r.s_region.replace(/POLYGON\s+(ICRS\s+)?/i, "").trim().split(/\s+/).map(Number);
    if (nums.length < 8) continue;
    rows.push({
      obsId: r.obs_id,
      detector,
      tStart: Number(r.t_min),
      tEnd: Number(r.t_max),
      emMin: Number(r.em_min) * 1e6,
      emMax: Number(r.em_max) * 1e6,
      fileUrl: r.access_url,
      corners: [0, 1, 2, 3].map((i) => [nums[2 * i], nums[2 * i + 1]] as [number, number]),
    });
  }

  const base = { ra, dec, release: "spherex_dr1", queryUrl, processingVersion: BLINK_VERSION, toleranceRule: `±${TOLERANCE_FRACTION} × bandwidth at the reference wavelength` };
  if (!rows.length) {
    return { ...base, status: "no-observations", detectors: [], detector: null, referenceWavelengthUm: null, toleranceUm: null, visits: [] };
  }

  const allVisits = groupVisits(rows);
  const detectors: DetectorSummary[] = [...new Set(rows.map((r) => r.detector))].sort().map((d) => {
    const rs = rows.filter((r) => r.detector === d);
    return { detector: d, exposures: rs.length, visits: groupVisits(rs).length, emMinUm: Math.min(...rs.map((r) => r.emMin)), emMaxUm: Math.max(...rs.map((r) => r.emMax)) };
  });
  // Default: the detector with the most exposures (PLAN.md ch. 4), then the most visits.
  const detector =
    requested && detectors.some((d) => d.detector === requested)
      ? requested
      : [...detectors].sort((a, b) => b.exposures - a.exposures || b.visits - a.visits)[0].detector;
  const detRows = rows.filter((r) => r.detector === detector);

  const { lut, W, H } = await readWaveTable(detRows[0].obsId, detector);
  const est = detRows.map((r) => {
    const p = pixelFromCorners(ra, dec, r.corners, W, H);
    const inside = p.x >= 0 && p.y >= 0 && p.x <= W - 1 && p.y <= H - 1;
    // The table is indexed in raw (1-based) detector pixels: cutout origin 0 → CRPIX/CRVAL of the full image.
    const w = inside ? wavelengthAt(lut, p.x, p.y) : null;
    return { r, w };
  });

  // Reference wavelength: the candidate that gives the most visits a match, then the most frames.
  const visitsOfRows = allVisits.map((v) => new Set(v.map((r) => `${r.obsId}:${r.detector}`)));
  const visitIndexOf = (r: Row) => visitsOfRows.findIndex((s) => s.has(`${r.obsId}:${r.detector}`));
  let best: { lam: number; tol: number; visits: number; frames: number } | null = null;
  for (const c of est) {
    if (!c.w) continue;
    const tol = TOLERANCE_FRACTION * c.w.bandwidth;
    const matches = est.filter((e) => e.w && Math.abs(e.w.wavelength - c.w!.wavelength) <= tol);
    const nv = new Set(matches.map((m) => visitIndexOf(m.r))).size;
    if (!best || nv > best.visits || (nv === best.visits && matches.length > best.frames)) best = { lam: c.w.wavelength, tol, visits: nv, frames: matches.length };
  }

  const visits: PlannedVisit[] = allVisits.map((v, i) => {
    const mine = est.filter((e) => visitIndexOf(e.r) === i);
    const within = best ? mine.filter((e) => e.w && Math.abs(e.w.wavelength - best!.lam) <= best!.tol).sort((a, b) => Math.abs(a.w!.wavelength - best!.lam) - Math.abs(b.w!.wavelength - best!.lam)) : [];
    const used = new Set(within.slice(0, MAX_PER_VISIT).map((e) => e.r));
    const exposures: PlannedExposure[] = mine.map(({ r, w }) => ({
      key: `${r.obsId}:${r.detector}`,
      obsId: r.obsId,
      detector: r.detector,
      tStart: r.tStart,
      tEnd: r.tEnd,
      estWavelengthUm: w?.wavelength ?? null,
      estBandwidthUm: w?.bandwidth ?? null,
      fileUrl: r.fileUrl,
      excluded: used.has(r)
        ? null
        : !w
          ? "target outside this detector"
          : best && Math.abs(w.wavelength - best.lam) > best.tol
            ? `wavelength ${w.wavelength.toFixed(3)} µm outside ${best.lam.toFixed(3)} ± ${best.tol.toFixed(3)} µm`
            : `more than ${MAX_PER_VISIT} matching frames in this visit`,
    }));
    return { index: i + 1, start: v[0].tStart, end: v[v.length - 1].tEnd, exposures };
  });

  const usableVisits = visits.filter((v) => v.exposures.some((e) => !e.excluded)).length;
  return {
    ...base,
    status: usableVisits >= 2 ? "comparable" : "additional-analysis-needed",
    detectors,
    detector,
    referenceWavelengthUm: best?.lam ?? null,
    toleranceUm: best?.tol ?? null,
    visits,
  };
}
