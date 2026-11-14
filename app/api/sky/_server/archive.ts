import "server-only";

import { gunzipSync } from "node:zlib";
import { HTTPError, TimeoutError } from "ky";
import { api } from "@/lib/ky";
import { readHdus, readImage, headerNumber } from "@/app/_lib/comet/fits";
import { APERTURE_BAD_FLAGS, maskFor } from "@/app/_lib/comet/photometry";
import { readRemoteCutout } from "@/app/_lib/comet/remote-fits";
import { skyToPixel as tanSipSkyToPixel, wavelengthAt } from "@/app/_lib/comet/wcs";
import { MISSIONS, PROCESSING_VERSION } from "@/app/_lib/sky/missions";
import { coverageOf, finiteMedian, medianStack, reproject } from "@/app/_lib/sky/reproject";
import { gridToSky, parseCelestialWcs, separationArcsec } from "@/app/_lib/sky/wcs";
import type { Epoch, EpochFrame, Exposure, GaiaStar, MissionId, MissionSearchResult, SkyGrid } from "@/app/_lib/sky/types";
import { rangeFetcher, resolvePixelFile } from "../../comet/_server/irsa";

/**
 * On-demand archive access for Sky Time Machine. Every request searches / downloads / resamples and
 * returns; nothing is written to disk or kept between requests.
 */

const SIA_URL = "https://irsa.ipac.caltech.edu/SIA";
const TAP_URL = "https://irsa.ipac.caltech.edu/TAP/sync";
/** Only IRSA's image backend may be fetched by URL (the URL comes from our own SIA2 answer, echoed by the client). */
export const IBE_PREFIX = /^https:\/\/irsa\.ipac\.caltech\.edu\/ibe\/data\/(wise|twomass)\/[\w./-]+\.fits(\.gz)?$/;

export class UpstreamNotFound extends Error {}

/** CSV with quoted fields (SIA2 titles and regions may contain commas). */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [head, ...body] = rows;
  if (!head) return [];
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

function siaUrl(collection: string, ra: number, dec: number, radiusDeg: number) {
  return `${SIA_URL}?COLLECTION=${collection}&POS=${encodeURIComponent(`CIRCLE ${ra} ${dec} ${radiusDeg}`)}&RESPONSEFORMAT=CSV`;
}

function bandOf(mission: MissionId, row: Record<string, string>): string {
  const b = row.energy_bandpassname;
  if (mission === "spherex") return b.replace("SPHEREx-", "");
  return b;
}

function toExposure(mission: MissionId, row: Record<string, string>): Exposure | null {
  if (row.dataproduct_subtype !== "science") return null;
  const band = bandOf(mission, row);
  const tStart = Number(row.t_min);
  const tEnd = Number(row.t_max) || tStart;
  if (!Number.isFinite(tStart)) return null;
  let source: Exposure["source"];
  if (mission === "spherex") {
    source = { kind: "spherex", obsId: row.obs_id, detector: band };
  } else {
    if (!IBE_PREFIX.test(row.access_url)) return null;
    source = { kind: "ibe", url: row.access_url };
  }
  return {
    id: `${row.obs_collection}:${row.obs_id}:${band}`,
    collection: row.obs_collection,
    band,
    tStart,
    tEnd,
    source,
    pixelScaleArcsec: Number(row.s_pixel_scale) || NaN,
    center: Number.isFinite(Number(row.s_ra)) && row.s_ra !== "" ? [Number(row.s_ra), Number(row.s_dec)] : null,
  };
}

/** Picks `k` exposures spread evenly over the window (keeps first and last). */
function spread<T>(items: T[], k: number): T[] {
  if (items.length <= k) return items;
  if (k === 1) return [items[Math.floor(items.length / 2)]];
  return Array.from({ length: k }, (_, i) => items[Math.round((i * (items.length - 1)) / (k - 1))]);
}

function groupIntoEpochs(mission: MissionId, exposures: Exposure[], ra: number, dec: number): Epoch[] {
  const cfg = MISSIONS[mission];
  const epochs: Epoch[] = [];
  const distance = (e: Exposure) => (e.center ? separationArcsec(ra, dec, e.center[0], e.center[1]) : Infinity);
  const byBand = new Map<string, Exposure[]>();
  for (const e of exposures) byBand.set(e.band, [...(byBand.get(e.band) ?? []), e]);
  for (const [band, list] of byBand) {
    const bandCfg = cfg.bands.find((b) => b.id === band);
    if (!bandCfg) continue; // e.g. W3/W4 — not used on the timeline
    list.sort((a, b) => a.tStart - b.tStart);
    let window: Exposure[] = [];
    const flush = () => {
      if (!window.length) return;
      const first = window[0];
      epochs.push({
        id: `${mission}:${band}:${first.tStart.toFixed(4)}`,
        mission,
        product: cfg.product,
        collections: [...new Set(window.map((w) => w.collection))],
        band,
        wavelengthLabel: `${bandCfg.label} ${bandCfg.wavelength}`,
        timeStart: first.tStart,
        timeEnd: Math.max(...window.map((w) => w.tEnd)),
        // 2MASS: one night's overlapping tiles — keep the ones centred closest to the field.
        // WISE/NEOWISE/SPHEREx: exposures spread over the window.
        exposures:
          mission === "2mass"
            ? [...window].sort((p, q) => distance(p) - distance(q)).slice(0, cfg.maxStack)
            : spread(window, cfg.maxStack),
        totalExposures: window.length,
      });
      window = [];
    };
    for (const e of list) {
      if (window.length && e.tStart - window[window.length - 1].tStart > cfg.windowGapDays) flush();
      window.push(e);
    }
    flush();
  }
  return epochs.sort((a, b) => a.timeStart - b.timeStart);
}

export async function searchMission(mission: MissionId, ra: number, dec: number, radiusDeg: number): Promise<MissionSearchResult> {
  const cfg = MISSIONS[mission];
  const queryUrls = cfg.collections.map((c) => siaUrl(c, ra, dec, radiusDeg));
  const texts = await Promise.all(queryUrls.map((u) => api.get(u, { timeout: 50_000 }).text()));
  const exposures = texts.flatMap((t) => parseCsv(t).map((r) => toExposure(mission, r)).filter((e): e is Exposure => e !== null));
  const unique = [...new Map(exposures.map((e) => [e.id, e])).values()];
  return {
    mission,
    collections: cfg.collections,
    queryUrls,
    searchedAt: new Date().toISOString(),
    epochs: groupIntoEpochs(mission, unique, ra, dec),
    exposureCount: unique.length,
  };
}

/** Cutout from IRSA IBE (gzip-aware) → resampled onto the grid, background-subtracted, zero-point normalised. */
async function ibeFrame(url: string, grid: SkyGrid, deadline: number): Promise<{ data: Float32Array; mjd: number | null }> {
  const center = gridToSky(grid, (grid.n - 1) / 2, (grid.n - 1) / 2);
  const sizeArcmin = Math.min(30, grid.fovArcmin * 1.45);
  const cutoutUrl = `${url}?center=${center.ra},${center.dec}&size=${sizeArcmin.toFixed(3)}arcmin`;
  let bytes = new Uint8Array(await getBytesWithRetry(cutoutUrl, deadline));
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = new Uint8Array(gunzipSync(bytes));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const hdus = readHdus(buffer);
  const hdu = hdus.find((h) => Number(h.header.get("NAXIS")) === 2);
  if (!hdu) throw new UpstreamNotFound("cutout has no image (outside the frame?)");
  const img = readImage(buffer, hdu);
  const data = img.data instanceof Float32Array ? img.data : Float32Array.from(img.data);
  const wcs = parseCelestialWcs(hdu.header);
  const resampled = reproject({ width: img.width, height: img.height, data, wcs }, grid);
  normalise(resampled, headerNumber(hdu, "MAGZP"));
  return { data: resampled, mjd: headerNumber(hdu, "MJD_OBS") };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET with up to two retries on 502/503/504 (IRSA throttling), backing off 1.5 s then 3 s. */
async function getBytesWithRetry(url: string, deadline: number): Promise<ArrayBuffer> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await api.get(url, { timeout: Math.max(5_000, Math.min(30_000, deadline - Date.now())) }).arrayBuffer();
    } catch (e) {
      const status = e instanceof HTTPError ? e.response.status : 0;
      // Retry throttling only while the request still fits in the route's time budget.
      if (attempt >= 2 || ![502, 503, 504].includes(status) || Date.now() + 1500 * (attempt + 1) > deadline - 8_000) throw e;
      await sleep(1500 * (attempt + 1));
    }
  }
}

function shortReason(err: unknown): string {
  if (err instanceof HTTPError) return `IRSA ${err.response.status}`;
  if (err instanceof TimeoutError) return "시간 초과";
  const msg = err instanceof Error ? err.message : "실패";
  return msg.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
}

/** Subtract the frame's median background, and bring DN to a common zero point (22.5 mag) when MAGZP is known. */
function normalise(data: Float32Array, magzp: number | null) {
  const bg = finiteMedian(data);
  const scale = magzp != null ? 10 ** (-0.4 * (magzp - 22.5)) : 1;
  for (let k = 0; k < data.length; k++) if (Number.isFinite(data[k])) data[k] = (data[k] - bg) * scale;
}

async function spherexFrame(obsId: string, detector: string, grid: SkyGrid) {
  const resolved = await resolvePixelFile(obsId, detector);
  const center = gridToSky(grid, (grid.n - 1) / 2, (grid.n - 1) / 2);
  const sizePx = Math.min(256, Math.ceil((grid.fovArcmin * 1.45 * 60) / 6.15) + 4);
  const cut = await readRemoteCutout(rangeFetcher(resolved.cloudUrl ?? resolved.fileUrl), center.ra, center.dec, sizePx);
  const bad = maskFor(cut.flagBits, APERTURE_BAD_FLAGS); // OUTLIER kept: moving objects are flagged as outliers
  const data = new Float32Array(cut.image.length);
  for (let k = 0; k < data.length; k++) data[k] = (cut.flags[k] >>> 0) & bad ? NaN : cut.image[k];
  const wcs = { projection: "TAN" as const, ...cut.wcs, a: {}, b: {} };
  const resampled = reproject({ width: cut.width, height: cut.height, data, wcs }, grid);
  normalise(resampled, null);
  // Wavelength at the grid center (the LVF makes it position dependent).
  const p = tanSipSkyToPixel(cut.wcs, center.ra, center.dec);
  const wave = p && cut.wave ? wavelengthAt(cut.wave, p.x, p.y).wavelength : null;
  return {
    data: resampled,
    mjd: headerNumber(cut.imageHeader, "MJD-AVG"),
    wavelengthUm: wave,
    url: resolved.fileUrl,
  };
}

export async function buildEpochFrame(epoch: Epoch, grid: SkyGrid): Promise<EpochFrame> {
  const used: EpochFrame["used"] = [];
  const failed: EpochFrame["failed"] = [];
  const frames: Float32Array[] = [];
  let wavelengthUm: number | null = null;
  // Original pixel scale from the archive metadata (SIA2 s_pixel_scale).
  const pixelArcsec = Math.max(...epoch.exposures.map((e) => e.pixelScaleArcsec).filter(Number.isFinite));
  const deadline = Date.now() + 52_000;

  // At most two exposures in flight: IRSA answers 503 when one client opens many cutouts at once.
  let next = 0;
  const worker = async () => {
    while (next < epoch.exposures.length) {
      const e = epoch.exposures[next++];
      try {
        if (e.source.kind === "ibe") {
          if (Date.now() > deadline - 6_000) throw new Error("시간 예산 초과로 생략");
          const f = await ibeFrame(e.source.url, grid, deadline);
          if (coverageOf(f.data) === 0) throw new UpstreamNotFound("격자와 겹치는 영역 없음");
          frames.push(f.data);
          used.push({ id: e.id, url: e.source.url, mjd: f.mjd ?? (e.tStart + e.tEnd) / 2 });
        } else {
          const f = await spherexFrame(e.source.obsId, e.source.detector, grid);
          frames.push(f.data);
          wavelengthUm = f.wavelengthUm;
          used.push({ id: e.id, url: f.url, mjd: f.mjd ?? (e.tStart + e.tEnd) / 2 });
        }
      } catch (err) {
        failed.push({ id: e.id, reason: shortReason(err) });
      }
    }
  };
  await Promise.all([worker(), worker()]);
  if (!frames.length) throw new UpstreamNotFound(`이 시점의 영상을 하나도 읽지 못했습니다: ${failed.map((f) => f.reason).join("; ")}`);

  const stacked = medianStack(frames);
  const mjds = used.map((u) => u.mjd);
  return {
    epochId: epoch.id,
    grid,
    data: Buffer.from(stacked.buffer, stacked.byteOffset, stacked.byteLength).toString("base64"),
    used: used.sort((a, b) => a.mjd - b.mjd),
    failed,
    timeStart: Math.min(...mjds),
    timeEnd: Math.max(...mjds),
    coverage: coverageOf(stacked),
    combine: frames.length > 1 ? `${frames.length}장 중앙값 합성 (통과 내 노출 ${epoch.totalExposures}장 중)` : "단일 영상",
    wavelengthUm,
    sourcePixelArcsec: pixelArcsec,
    processingVersion: PROCESSING_VERSION,
  };
}

/** Gaia DR3 stars with measurable proper motion in the field (epoch 2016.0). */
export async function fetchGaia(ra: number, dec: number, radiusDeg: number, minPm: number): Promise<{ stars: GaiaStar[]; query: string }> {
  const query =
    `SELECT TOP 40 source_id, ra, dec, pmra, pmdec, parallax, phot_g_mean_mag FROM gaia_dr3_source ` +
    `WHERE CONTAINS(POINT('ICRS',ra,dec), CIRCLE('ICRS',${ra},${dec},${radiusDeg}))=1 AND pm > ${minPm} ORDER BY pm DESC`;
  const csv = await api.post(TAP_URL, { body: new URLSearchParams({ QUERY: query, FORMAT: "csv" }), timeout: 55_000 }).text();
  const stars = parseCsv(csv).map((r) => ({
    sourceId: r.source_id,
    ra: Number(r.ra),
    dec: Number(r.dec),
    pmra: Number(r.pmra),
    pmdec: Number(r.pmdec),
    parallax: r.parallax ? Number(r.parallax) : null,
    gmag: r.phot_g_mean_mag ? Number(r.phot_g_mean_mag) : null,
  }));
  return { stars, query };
}

