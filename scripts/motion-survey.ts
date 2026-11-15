/**
 * Feature A pipeline: SPHEREx × 2MASS movement survey (PLAN.md chapter 7, decision #41).
 *
 * A star that moved over ~25 years sits at one place in 2MASS (≈2000) and another in SPHEREx (2025–26). SPHEREx
 * visits alone are only ~6 months apart, where position noise (~9″) hides even the fastest stars, so the long
 * baseline does the work. Per point:
 *   1. SPHEREx DR1 exposures from IRSA SIA2 (retried; the search is the only IRSA web service used). Pixels are
 *      range-read from the public AWS copy, so DataLink is skipped (same path as `access_url`).
 *   2. Detector nearest 2MASS Ks (D3, then D2, D4), exposures within ±0.5 × bandwidth of one reference wavelength
 *      (absolute principle 3), IMAGE − ZODI with unusable bits masked, reprojected onto a fixed sky grid centred on
 *      the point (absolute principle 2), median per visit. Sources ≥ 5σ; kept when found in every usable visit.
 *   3. 2MASS PSC (ESA Gaia Archive copy `gaiadr1.tmass_original_valid`, with each source's own epoch) registers
 *      the SPHEREx positions and sets this field's noise; separations below max(8″, 2.5 × p90 offset) are not
 *      counted as motion.
 *   4. Pairs: a SPHEREx source (S/N ≥ 20) with no 2MASS source in place × a 2MASS source (Ks ≤ 14.5, quality A/B)
 *      bright enough for SPHEREx but with no SPHEREx detection there in any visit, minSep–90″ apart, fluxes within ×3.
 *   5. Gaia DR3 moved to both epochs: KNOWN_MOVER (explains both ends), GAIA_STATIC (only the SPHEREx end: a
 *      chance pair), UNIDENTIFIED (a candidate to check, never a detection, absolute principle 1).
 * Nothing but metadata is kept: cutouts stay in memory (absolute principle 7).
 *
 * Usage (from the repo root; `react-server` lets the server-only modules load outside Next):
 *   npx tsx --conditions=react-server --env-file=.env scripts/motion-survey.ts survey <random|control> <n> <out.jsonl>
 *   npx tsx --conditions=react-server --env-file=.env scripts/motion-survey.ts import <out.jsonl> <surveyId>
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { decodeBits } from "@/app/_lib/fpl/flags";
import { readRemoteCutout, type RangeFetcher } from "@/app/_lib/comet/remote-fits";
import { skyToPixel as tanSipSkyToPixel, wavelengthAt } from "@/app/_lib/comet/wcs";
import { medianStack, reproject } from "@/app/_lib/sky/reproject";
import { gridToSky, separationArcsec } from "@/app/_lib/sky/wcs";
import type { SkyGrid } from "@/app/_lib/sky/types";
import { ang2pixNest, RATING_HPX_ORDER } from "@/app/api/ratings/_server/healpix";
import type { CandidateInput, PointInput } from "@/data/motion-candidates";

export const PIPELINE_VERSION = "sx2mass-3";
const RELEASE = "spherex_dr1";
const P = {
  gridFovArcmin: 8,
  gridN: 256,
  cutoutPx: 96,
  detectSigma: 5,
  pairSnr: 20,
  minSepFloorArcsec: 8,
  noiseFactor: 2.5,
  maxSepArcsec: 90,
  fluxRatioMax: 3,
  /** 2MASS sources used for pairs: Ks quality A/B and not fainter than this (fainter ones are mostly chance pairs). */
  tmassMaxKs: 14.5,
  tmassVisibleSigma: 10,
  gaiaEndArcsec: 2,
  maxPerVisit: 3,
  visitGapDays: 20,
  detectorOrder: ["D3", "D2", "D4", "D1", "D5", "D6"],
  masked: ["NONFUNC", "MISSING_DATA", "HOT", "COLD", "SUR_ERROR", "TRANSIENT", "SNOWBALL"],
  tmassTable: "gaiadr1.tmass_original_valid (ESA Gaia Archive)",
  gaiaTable: "gaiadr3.gaia_source (ESA Gaia Archive)",
};
const S3 = "https://nasa-irsa-spherex.s3.us-east-1.amazonaws.com/";
const IBE = "https://irsa.ipac.caltech.edu/ibe/data/spherex/";
const ESA_TAP = "https://gea.esac.esa.int/tap-server/tap/sync";
const GRID_PIX_SR = ((P.gridFovArcmin * 60) / P.gridN / 206264.806) ** 2;
const KS_ZERO_JY = 666.7;
const EDGE = 6;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const mjdYear = (mjd: number) => 2000 + (mjd - 51544.5) / 365.25;

/** GET/POST with retries on gateway errors and timeouts (IRSA answered 502 to most requests on 2026-11-15). */
async function fetchText(url: string, init: RequestInit = {}, tries = 12): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(url, { ...init, signal: AbortSignal.timeout(60_000) });
      if (r.ok) return await r.text();
      if (![429, 500, 502, 503, 504].includes(r.status) || attempt >= tries) throw new Error(`HTTP ${r.status} from ${new URL(url).host}`);
    } catch (e) {
      if (attempt >= tries || (e instanceof Error && e.message.startsWith("HTTP "))) throw e;
    }
    await sleep(1500 + attempt * 1000 + Math.random() * 1000);
  }
}

function adql(query: string) {
  return fetchText(ESA_TAP, { method: "POST", body: new URLSearchParams({ REQUEST: "doQuery", LANG: "ADQL", FORMAT: "csv", QUERY: query }) }, 6);
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

/** SIA2 VOTable (CSV breaks on the unquoted JSON in `cloud_access`). */
function parseVoTable(xml: string): Record<string, string>[] {
  const names = [...xml.matchAll(/<FIELD\b[^>]*\bname="([^"]+)"/g)].map((m) => m[1]);
  const decode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  return [...xml.matchAll(/<TR>([\s\S]*?)<\/TR>/g)].map((tr) => {
    const cells = [...tr[1].matchAll(/<TD>([\s\S]*?)<\/TD>|<TD\s*\/>/g)].map((m) => decode(m[1] ?? ""));
    return Object.fromEntries(names.map((n, i) => [n, cells[i] ?? ""]));
  });
}

function s3Fetcher(url: string): RangeFetcher {
  return Object.assign(
    async (start: number, end: number) => {
      for (let attempt = 0; ; attempt++) {
        try {
          const r = await fetch(url, { headers: { Range: `bytes=${start}-${end}` }, signal: AbortSignal.timeout(90_000) });
          if (r.status === 206) return await r.arrayBuffer();
          throw new Error(`S3 ${r.status}`);
        } catch (e) {
          if (attempt >= 3) throw e;
          await sleep(1000 * (attempt + 1));
        }
      }
    },
    { url },
  );
}

interface Exposure { obsId: string; detector: string; mjd: number; url: string }
interface Src { ra: number; dec: number; flux: number; snr: number; i: number; r: number }
interface Persistent { ra: number; dec: number; flux: number; snr: number; visits: number; scatter: number | null }
interface TwoMass { designation: string; ra: number; dec: number; ks: number | null; mjd: number; qual: string }
interface Gaia { id: string; ra: number; dec: number; pmra: number; pmdec: number; g: number }

async function spherexExposures(ra: number, dec: number): Promise<Exposure[]> {
  const xml = await fetchText(`https://irsa.ipac.caltech.edu/SIA?COLLECTION=${RELEASE}&POS=${encodeURIComponent(`CIRCLE ${ra} ${dec} 0.0005`)}&RESPONSEFORMAT=VOTABLE`);
  const seen = new Set<string>();
  const out: Exposure[] = [];
  for (const r of parseVoTable(xml)) {
    if (r.dataproduct_subtype !== "science" || !r.access_url.startsWith(IBE)) continue;
    const detector = r.energy_bandpassname.replace("SPHEREx-", "");
    const key = `${r.obs_id}:${detector}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ obsId: r.obs_id, detector, mjd: (Number(r.t_min) + Number(r.t_max)) / 2, url: S3 + r.access_url.slice(IBE.length) });
  }
  return out;
}

function groupVisits<T extends { mjd: number }>(items: T[]): T[][] {
  const out: T[][] = [];
  for (const it of [...items].sort((a, b) => a.mjd - b.mjd)) {
    const last = out[out.length - 1];
    if (last && it.mjd - last[last.length - 1].mjd <= P.visitGapDays) last.push(it);
    else out.push([it]);
  }
  return out;
}

function robust(img: Float32Array) {
  const v = Array.from(img).filter(Number.isFinite).sort((a, b) => a - b);
  if (v.length < 200) return { med: NaN, sigma: NaN };
  const med = v[v.length >> 1];
  const dev = v.map((x) => Math.abs(x - med)).sort((a, b) => a - b);
  return { med, sigma: 1.4826 * dev[dev.length >> 1] };
}

/** Grid pixels at least EDGE away from missing data in every image. */
function goodArea(imgs: Float32Array[], n: number) {
  const bad = new Uint8Array(n * n);
  for (const img of imgs) for (let k = 0; k < n * n; k++) if (!Number.isFinite(img[k])) bad[k] = 1;
  const good = new Uint8Array(n * n);
  for (let r = EDGE; r < n - EDGE; r++)
    for (let i = EDGE; i < n - EDGE; i++) {
      let ok = 1;
      for (let dr = -EDGE; dr <= EDGE && ok; dr += 2) for (let di = -EDGE; di <= EDGE; di += 2) if (bad[(r + dr) * n + i + di]) { ok = 0; break; }
      good[r * n + i] = ok;
    }
  return good;
}

function detect(img: Float32Array, grid: SkyGrid, good: Uint8Array) {
  const n = grid.n;
  const { med, sigma } = robust(img);
  const srcs: Src[] = [];
  if (!(sigma > 0)) return { srcs, sigma, med };
  for (let r = 2; r < n - 2; r++)
    for (let i = 2; i < n - 2; i++) {
      const k = r * n + i;
      if (!good[k] || !(img[k] - med >= P.detectSigma * sigma)) continue;
      let peak = true;
      for (let dr = -2; dr <= 2 && peak; dr++) for (let di = -2; di <= 2; di++) if ((dr || di) && img[k + dr * n + di] > img[k]) { peak = false; break; }
      if (!peak) continue;
      let sw = 0, si = 0, sr = 0, npx = 0;
      for (let dr = -2; dr <= 2; dr++)
        for (let di = -2; di <= 2; di++) {
          const w = img[k + dr * n + di] - med;
          if (!Number.isFinite(w)) continue;
          npx++;
          if (w > 0) { sw += w; si += w * (i + di); sr += w * (r + dr); }
        }
      const p = gridToSky(grid, si / sw, sr / sw);
      // Box sum (MJy/sr × sr) → mJy.
      srcs.push({ ra: p.ra, dec: p.dec, flux: sw * GRID_PIX_SR * 1e9, snr: sw / (sigma * Math.sqrt(npx)), i: si / sw, r: sr / sw });
    }
  return { srcs, sigma, med };
}

const tmassPredictedMjy = (ks: number) => KS_ZERO_JY * 10 ** (-0.4 * ks) * 1e3 * 0.6; // ≈60 % of a point source in the 9.4″ box

async function tmassCone(ra: number, dec: number, radiusDeg: number): Promise<TwoMass[]> {
  const csv = await adql(`SELECT designation, ra, dec, ks_m, ph_qual, j_date FROM gaiadr1.tmass_original_valid WHERE 1=CONTAINS(POINT('ICRS',ra,dec),CIRCLE('ICRS',${ra},${dec},${radiusDeg}))`);
  return parseCsv(csv).map((r) => ({ designation: r.designation, ra: Number(r.ra), dec: Number(r.dec), ks: r.ks_m ? Number(r.ks_m) : null, mjd: Number(r.j_date) - 2400000.5, qual: r.ph_qual }));
}

async function gaiaCone(ra: number, dec: number, radiusDeg: number): Promise<Gaia[]> {
  const csv = await adql(`SELECT TOP 30000 source_id, ra, dec, pmra, pmdec, phot_g_mean_mag FROM gaiadr3.gaia_source WHERE 1=CONTAINS(POINT('ICRS',ra,dec),CIRCLE('ICRS',${ra},${dec},${radiusDeg}))`);
  return parseCsv(csv).map((r) => ({ id: r.source_id, ra: Number(r.ra), dec: Number(r.dec), pmra: Number(r.pmra) || 0, pmdec: Number(r.pmdec) || 0, g: Number(r.phot_g_mean_mag) }));
}

/** Gaia DR3 position (epoch 2016.0) moved linearly to an MJD; parallax ignored (< 1″ for all but a few stars). */
function gaiaAt(s: Gaia, mjd: number) {
  const dt = mjdYear(mjd) - 2016.0;
  return { ra: s.ra + (s.pmra * dt) / 3.6e6 / Math.cos((s.dec * Math.PI) / 180), dec: s.dec + (s.pmdec * dt) / 3.6e6 };
}

export async function surveyPoint(pt: { kind: string; label: string; ra: number; dec: number }): Promise<{ point: PointInput; candidates: CandidateInput[]; extra: Record<string, unknown> }> {
  const t0 = Date.now();
  const base: PointInput = { kind: pt.kind, label: pt.label, raDeg: pt.ra, decDeg: pt.dec, status: "failed" };
  const done = (p: Partial<PointInput>, candidates: CandidateInput[] = [], extra: Record<string, unknown> = {}) => ({ point: { ...base, ...p, seconds: (Date.now() - t0) / 1000 }, candidates, extra });
  try {
    const all = await spherexExposures(pt.ra, pt.dec);
    if (!all.length) return done({ status: "no-observations" });
    const detector = P.detectorOrder.find((d) => groupVisits(all.filter((e) => e.detector === d)).length >= 2) ?? P.detectorOrder.find((d) => all.some((e) => e.detector === d))!;
    const visitsAll = groupVisits(all.filter((e) => e.detector === detector));
    const grid: SkyGrid = { ra: pt.ra, dec: pt.dec, fovArcmin: P.gridFovArcmin, n: P.gridN };

    // Read up to 3 exposures per visit (spread over the visit), then keep one wavelength (principle 3).
    type Frame = { e: Exposure; visit: number; lam: number; bw: number; img: Float32Array };
    const frames: Frame[] = [];
    await Promise.all(
      visitsAll.map(async (v, vi) => {
        const pick = v.length <= 3 ? v : [0, 1, 2].map((k) => v[Math.round((k * (v.length - 1)) / 2)]);
        await Promise.all(
          pick.map(async (e) => {
            try {
              const cut = await readRemoteCutout(s3Fetcher(e.url), pt.ra, pt.dec, P.cutoutPx, { variance: false });
              const p = tanSipSkyToPixel(cut.wcs, pt.ra, pt.dec);
              if (!p || !cut.wave) return;
              const w = wavelengthAt(cut.wave, p.x, p.y);
              const mask = decodeBits(cut.flagBits).filter((b) => P.masked.includes(b.name)).reduce((m, b) => m | b.mask, 0) >>> 0;
              const src = new Float32Array(cut.image.length);
              for (let k = 0; k < src.length; k++) src[k] = (cut.flags[k] >>> 0) & mask ? NaN : cut.image[k] - cut.zodi[k];
              frames.push({ e, visit: vi, lam: w.wavelength, bw: w.bandwidth, img: reproject({ width: cut.width, height: cut.height, data: src, wcs: { projection: "TAN", ...cut.wcs, a: {}, b: {} } }, grid) });
            } catch {
              /* outside the detector or unreadable: the visit uses the rest */
            }
          }),
        );
      }),
    );
    if (!frames.length) return done({ status: "too-few-visits", detector, error: "no readable frame" });
    // Reference wavelength: the candidate that keeps the most visits, then the most frames.
    let best = { lam: frames[0].lam, tol: 0.5 * frames[0].bw, visits: 0, n: 0 };
    for (const f of frames) {
      const tol = 0.5 * f.bw;
      const ok = frames.filter((g) => Math.abs(g.lam - f.lam) <= tol);
      const nv = new Set(ok.map((g) => g.visit)).size;
      if (nv > best.visits || (nv === best.visits && ok.length > best.n)) best = { lam: f.lam, tol, visits: nv, n: ok.length };
    }
    const visits: { mjd: number; img: Float32Array; obsIds: string[] }[] = [];
    for (let vi = 0; vi < visitsAll.length; vi++) {
      const fs = frames.filter((f) => f.visit === vi && Math.abs(f.lam - best.lam) <= best.tol).sort((a, b) => Math.abs(a.lam - best.lam) - Math.abs(b.lam - best.lam)).slice(0, P.maxPerVisit);
      if (fs.length) visits.push({ mjd: fs.reduce((s, f) => s + f.e.mjd, 0) / fs.length, img: medianStack(fs.map((f) => f.img)), obsIds: fs.map((f) => f.e.obsId) });
    }
    visits.sort((a, b) => a.mjd - b.mjd);
    const common = { detector, wavelengthUm: +best.lam.toFixed(4), spherexVisits: visits.length };
    if (!visits.length) return done({ status: "too-few-visits", ...common });

    // Sources per visit inside the area every visit covers; keep those found in every visit (or the only one).
    const good = goodArea(visits.map((v) => v.img), P.gridN);
    const goodFrac = good.reduce((s, x) => s + x, 0) / good.length;
    const per = visits.map((v) => detect(v.img, grid, good));
    const spherexMjd = visits.reduce((s, v) => s + v.mjd, 0) / visits.length;
    const persistent: Persistent[] = [];
    for (const s of per[0].srcs) {
      const hits = [s];
      for (let k = 1; k < per.length; k++) {
        let m: Src | null = null, d = Infinity;
        for (const o of per[k].srcs) { const e = separationArcsec(s.ra, s.dec, o.ra, o.dec); if (e < d) { d = e; m = o; } }
        if (m && d <= 6) hits.push(m);
      }
      if (hits.length < per.length) continue;
      const ra = hits.reduce((a, h) => a + h.ra, 0) / hits.length, dec = hits.reduce((a, h) => a + h.dec, 0) / hits.length;
      const scatter = hits.length > 1 ? Math.max(...hits.map((h) => separationArcsec(h.ra, h.dec, ra, dec))) : null;
      persistent.push({ ra, dec, flux: hits.reduce((a, h) => a + h.flux, 0) / hits.length, snr: Math.sqrt(hits.reduce((a, h) => a + h.snr * h.snr, 0)), visits: hits.length, scatter });
    }

    // 2MASS and Gaia over the grid.
    const radius = ((P.gridFovArcmin / 60) * Math.SQRT2) / 2 + P.maxSepArcsec / 3600;
    const tm = await tmassCone(pt.ra, pt.dec, radius);
    // Gaia is queried only when a pair needs checking (most fields have none), to keep load on the ESA archive low.
    let gaiaCache: Gaia[] | null = null;
    const gaiaFor = async () => (gaiaCache ??= await gaiaCone(pt.ra, pt.dec, radius));
    const inGood = (ra: number, dec: number) => {
      const s = (P.gridFovArcmin * 60) / P.gridN, c = (P.gridN - 1) / 2;
      const i = Math.round(c - ((((ra - pt.ra + 540) % 360) - 180) * Math.cos((pt.dec * Math.PI) / 180) * 3600) / s);
      const r = Math.round(c - ((dec - pt.dec) * 3600) / s);
      return i >= 0 && r >= 0 && i < P.gridN && r < P.gridN && good[r * P.gridN + i] === 1;
    };
    const tmIn = tm.filter((t) => inGood(t.ra, t.dec));

    // Register SPHEREx on 2MASS with bright matched sources, then measure the scatter.
    const nearestTm = (ra: number, dec: number) => { let b: TwoMass | null = null, d = Infinity; for (const t of tm) { const e = separationArcsec(ra, dec, t.ra, t.dec); if (e < d) { d = e; b = t; } } return { t: b, d }; };
    const bright = persistent.filter((s) => s.snr >= 15).map((s) => ({ s, ...nearestTm(s.ra, s.dec) })).filter((m) => m.d <= 6);
    const cosd = Math.cos((pt.dec * Math.PI) / 180);
    const med = (a: number[]) => { const v = [...a].sort((x, y) => x - y); return v.length ? v[v.length >> 1] : 0; };
    const dra = med(bright.map((m) => (m.s.ra - m.t!.ra) * cosd * 3600)), ddec = med(bright.map((m) => (m.s.dec - m.t!.dec) * 3600));
    for (const s of persistent) { s.ra -= dra / 3600 / cosd; s.dec -= ddec / 3600; }
    const offs = bright.map((m) => separationArcsec(m.s.ra, m.s.dec, m.t!.ra, m.t!.dec)).sort((a, b) => a - b);
    const p90 = offs.length >= 5 ? offs[Math.floor(offs.length * 0.9)] : null;
    const minSep = Math.max(P.minSepFloorArcsec, p90 != null ? P.noiseFactor * p90 : 0);
    const matchR = Math.max(5, p90 != null ? 2 * p90 : 5);

    // SPHEREx sources with no 2MASS source in place; 2MASS sources SPHEREx should see but finds nothing at.
    const boxSigmaMjy = med(per.map((d) => d.sigma)) * 5 * GRID_PIX_SR * 1e9;
    const sxOnly = persistent.filter((s) => s.snr >= P.pairSnr && nearestTm(s.ra, s.dec).d > matchR);
    const anyDetection = per.flatMap((d) => d.srcs).map((x) => ({ ra: x.ra - dra / 3600 / cosd, dec: x.dec - ddec / 3600 }));
    const ksQual = (t: TwoMass) => t.qual[2] === "A" || t.qual[2] === "B";
    const tmOnly = tmIn.filter((t) => t.ks != null && t.ks <= P.tmassMaxKs && ksQual(t) && tmassPredictedMjy(t.ks) >= P.tmassVisibleSigma * boxSigmaMjy && !anyDetection.some((s) => separationArcsec(s.ra, s.dec, t.ra, t.dec) <= matchR));
    const goodAreaArcsec2 = goodFrac * (P.gridFovArcmin * 60) ** 2;
    const expectedChancePairs = goodAreaArcsec2 > 0 ? (sxOnly.length * tmOnly.length * Math.PI * (P.maxSepArcsec ** 2 - minSep ** 2)) / goodAreaArcsec2 : 0;

    const candidates: CandidateInput[] = [];
    const used = new Set<TwoMass>();
    for (const s of [...sxOnly].sort((a, b) => b.snr - a.snr)) {
      let b: TwoMass | null = null, bd = Infinity;
      for (const t of tmOnly) {
        if (used.has(t)) continue;
        const d = separationArcsec(s.ra, s.dec, t.ra, t.dec);
        const ratio = s.flux / tmassPredictedMjy(t.ks!);
        if (d >= minSep && d <= P.maxSepArcsec && ratio >= 1 / P.fluxRatioMax && ratio <= P.fluxRatioMax && d < bd) { b = t; bd = d; }
      }
      if (!b) continue;
      used.add(b);
      const years = (spherexMjd - b.mjd) / 365.25;
      const pmRa = ((((s.ra - b.ra + 540) % 360) - 180) * Math.cos((s.dec * Math.PI) / 180) * 3.6e6) / years;
      const pmDec = ((s.dec - b.dec) * 3.6e6) / years;
      // Gaia: a star moved to the SPHEREx epoch at s, and to the 2MASS epoch at the 2MASS source.
      const endR = Math.max(3, p90 != null ? 1.5 * p90 : 3);
      let match: CandidateInput["match"] = "UNIDENTIFIED";
      let g: { id: string; pm: number; sep: number } | null = null;
      for (const star of await gaiaFor()) {
        const a = gaiaAt(star, spherexMjd);
        const sepS = separationArcsec(a.ra, a.dec, s.ra, s.dec);
        if (sepS > endR) continue;
        const t2 = gaiaAt(star, b.mjd);
        const sepT = separationArcsec(t2.ra, t2.dec, b.ra, b.dec);
        const pm = Math.hypot(star.pmra, star.pmdec);
        if (sepT <= P.gaiaEndArcsec + 1) { match = "KNOWN_MOVER"; g = { id: star.id, pm, sep: sepS }; break; }
        if (match === "UNIDENTIFIED") { match = "GAIA_STATIC"; g = { id: star.id, pm, sep: sepS }; }
      }
      candidates.push({
        release: RELEASE,
        hpxIndex: ang2pixNest(RATING_HPX_ORDER, s.ra, s.dec),
        match,
        raDeg: s.ra,
        decDeg: s.dec,
        epochMjd: spherexMjd,
        tmassRaDeg: b.ra,
        tmassDecDeg: b.dec,
        tmassMjd: b.mjd,
        tmassDesignation: `2MASS J${b.designation}`,
        tmassKsMag: b.ks ?? undefined,
        separationArcsec: +bd.toFixed(2),
        baselineYears: +years.toFixed(3),
        pmRaMasYr: +pmRa.toFixed(1),
        pmDecMasYr: +pmDec.toFixed(1),
        pmTotalMasYr: +Math.hypot(pmRa, pmDec).toFixed(1),
        snr: +s.snr.toFixed(1),
        fluxMjy: +s.flux.toFixed(3),
        detector,
        wavelengthUm: +best.lam.toFixed(4),
        spherexVisits: s.visits,
        positionScatterArcsec: s.scatter != null ? +s.scatter.toFixed(2) : undefined,
        obsIds: visits.flatMap((v) => v.obsIds),
        gaiaSourceId: g?.id,
        gaiaPmMasYr: g ? +g.pm.toFixed(1) : undefined,
        gaiaSepArcsec: g ? +g.sep.toFixed(2) : undefined,
      });
    }
    return done(
      {
        status: "searched",
        ...common,
        spherexMjd,
        spherexSources: persistent.length,
        tmassSources: tmIn.length,
        matchedSources: offs.length,
        scatterArcsec: p90 != null ? +p90.toFixed(2) : undefined,
        minSeparationArcsec: +minSep.toFixed(2),
        expectedChancePairs: +expectedChancePairs.toFixed(3),
      },
      candidates,
      { coveredFraction: +goodFrac.toFixed(2), registrationArcsec: [+dra.toFixed(2), +ddec.toFixed(2)], sxOnly: sxOnly.length, tmOnly: tmOnly.length },
    );
  } catch (e) {
    return done({ status: "failed", error: e instanceof Error ? e.message.slice(0, 300) : String(e) });
  }
}

function randomPoints(n: number) {
  return Array.from({ length: n }, () => {
    const ra = Math.random() * 360, dec = (Math.asin(2 * Math.random() - 1) * 180) / Math.PI;
    return { kind: "random", label: `random ${ra.toFixed(4)} ${dec.toFixed(4)}`, ra, dec };
  });
}

/** Known moving stars SPHEREx can measure: G 11–15 (not saturated), 0.5–3″/yr (12–75″ over 25 years). */
async function controlPoints(n: number) {
  const rows = parseCsv(await adql(`SELECT TOP ${n} source_id, ra, dec, pmra, pmdec, pm, phot_g_mean_mag FROM gaiadr3.gaia_source WHERE pm BETWEEN 500 AND 3000 AND phot_g_mean_mag BETWEEN 11 AND 15 ORDER BY random_index`));
  return rows.map((r) => {
    const p = gaiaAt({ id: r.source_id, ra: Number(r.ra), dec: Number(r.dec), pmra: Number(r.pmra), pmdec: Number(r.pmdec), g: 0 }, 61000);
    return { kind: "control", label: `Gaia DR3 ${r.source_id} (pm ${(Number(r.pm) / 1000).toFixed(2)}″/yr, G ${Number(r.phot_g_mean_mag).toFixed(1)})`, ra: p.ra, dec: p.dec };
  });
}

async function main() {
  const [cmd, a, b, c] = process.argv.slice(2);
  if (cmd === "survey") {
    const out = c ?? "motion-survey.jsonl";
    const points = a === "control" ? await controlPoints(Number(b)) : randomPoints(Number(b));
    if (!existsSync(out)) appendFileSync(out, JSON.stringify({ header: { pipelineVersion: PIPELINE_VERSION, release: RELEASE, params: P, pointsPlanned: points.length, startedAt: new Date().toISOString() } }) + "\n");
    let next = 0, n = 0;
    const par = Number(process.env.PAR ?? 2);
    await Promise.all(
      Array.from({ length: par }, async () => {
        while (next < points.length) {
          const pt = points[next++];
          const r = await surveyPoint(pt);
          appendFileSync(out, JSON.stringify(r) + "\n");
          const kinds = r.candidates.map((x) => x.match[0]).join("");
          console.log(`${String(++n).padStart(3)}/${points.length} ${r.point.status.padEnd(16)} ${String(r.point.detector ?? "-").padEnd(3)} v=${r.point.spherexVisits ?? "-"} sx=${r.point.spherexSources ?? "-"} 2m=${r.point.tmassSources ?? "-"} p90=${r.point.scatterArcsec ?? "-"} min=${r.point.minSeparationArcsec ?? "-"} chance=${r.point.expectedChancePairs ?? "-"} cand=${r.candidates.length}${kinds ? `[${kinds}]` : ""} ${r.point.seconds?.toFixed(0)}s ${pt.label}${r.point.error ? " ! " + r.point.error.slice(0, 80) : ""}`);
        }
      }),
    );
    return;
  }
  if (cmd === "import") {
    const { createSurvey, savePoint } = await import("@/data/motion-candidates");
    const lines = readFileSync(a, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    const header = lines.find((l) => l.header)?.header;
    const rows = lines.filter((l) => l.point);
    await createSurvey({ id: b, method: "spherex-vs-2mass", release: RELEASE, pipelineVersion: header?.pipelineVersion ?? PIPELINE_VERSION, params: header?.params ?? P, pointsPlanned: rows.length });
    for (const r of rows) await savePoint(b, r.point, r.candidates);
    console.log(`imported ${rows.length} points, ${rows.reduce((s, r) => s + r.candidates.length, 0)} candidates into survey ${b}`);
    return;
  }
  console.log("usage: survey <random|control> <n> <out.jsonl> | import <file.jsonl> <surveyId>");
}

void main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
