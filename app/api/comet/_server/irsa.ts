import "server-only";

import { api } from "@/lib/ky";
import { headerNumber, headerString } from "@/app/_lib/comet/fits";
import { OutsideDetectorError, readRemoteCutout, type RangeFetcher } from "@/app/_lib/comet/remote-fits";
import { parseVoTable, toRecords } from "@/app/_lib/comet/votable";
import type { FramePayload, GeometryResult, ObservationEntry, ObservationIndex, PeriodId } from "@/app/_lib/comet/types";

/**
 * On-demand access to IRSA / AWS Open Data / JPL. Nothing here is written to disk or kept between
 * requests: every call fetches, transforms, and returns.
 */

export const OBSERVATION_LIST_URL = "https://irsa.ipac.caltech.edu/data/SPHEREx/docs/comet3iatlas/obscore_3I_Atlas.vot";
const DATALINK_URL = "https://irsa.ipac.caltech.edu/datalink/links/spherex";
const HORIZONS_URL = "https://ssd.jpl.nasa.gov/api/horizons.api";
/** Release used for pixels. The comet list names QR2, whose DataLink now answers with no files. */
export const PIXEL_RELEASE = "spherex_dr1";

const MJD_EPOCH_MS = Date.UTC(1858, 10, 17);
export const mjdToIso = (mjd: number) => new Date(MJD_EPOCH_MS + mjd * 86_400_000).toISOString();

export class NotFoundError extends Error {}

function periodOf(iso: string): PeriodId | null {
  if (iso.startsWith("2025-08")) return "2025-08";
  if (iso.startsWith("2025-12")) return "2025-12";
  return null;
}

export async function fetchObservationIndex(): Promise<ObservationIndex> {
  const xml = await api.get(OBSERVATION_LIST_URL, { timeout: 30_000 }).text();
  const records = toRecords(parseVoTable(xml));
  const seen = new Set<string>();
  const entries: ObservationEntry[] = [];
  for (const r of records) {
    const key = `${r.obs_id}:${r.spherex_detector}`;
    if (seen.has(key)) continue; // duplicate rows collapse to one
    seen.add(key);
    const tMin = Number(r.t_min);
    const tMax = Number(r.t_max);
    const utcStart = mjdToIso(tMin);
    entries.push({
      key,
      obsId: r.obs_id,
      detector: r.spherex_detector,
      utcStart,
      utcEnd: mjdToIso(tMax),
      mjdMid: (tMin + tMax) / 2,
      exptimeS: Number(r.t_exptime),
      cometRa: Number(r.comet_ra),
      cometDec: Number(r.comet_dec),
      imageRa: Number(r.s_ra),
      imageDec: Number(r.s_dec),
      emMinUm: Number(r.em_min) * 1e6,
      emMaxUm: Number(r.em_max) * 1e6,
      accessUrl: r.access_url,
      accessFormat: r.access_format,
      listCollection: r.obs_collection,
      period: periodOf(utcStart),
    });
  }
  entries.sort((a, b) => a.mjdMid - b.mjdMid || a.detector.localeCompare(b.detector));
  return { source: OBSERVATION_LIST_URL, fetchedAt: new Date().toISOString(), entries };
}

interface ResolvedFile {
  release: string;
  datalinkUrl: string;
  /** IRSA HTTPS URL of the full L2b file. */
  fileUrl: string;
  /** Public AWS Open Data copy named by DataLink's cloud_access, when present. */
  cloudUrl: string | null;
}

/**
 * Asks IRSA DataLink for the same exposure/detector in the current release. The answer must list
 * a `#this` science image, so a missing file is reported rather than guessed.
 */
/** DataLink answers already received (file locations only), so several analyses of one point ask once. */
const resolved = new Map<string, Promise<ResolvedFile>>();

export function resolvePixelFile(obsId: string, detector: string): Promise<ResolvedFile> {
  const key = `${obsId}/${detector}`;
  let p = resolved.get(key);
  if (!p) {
    if (resolved.size >= 1000) resolved.delete(resolved.keys().next().value!);
    p = resolvePixelFileUncached(obsId, detector);
    p.catch(() => resolved.delete(key));
    resolved.set(key, p);
  }
  return p;
}

async function resolvePixelFileUncached(obsId: string, detector: string): Promise<ResolvedFile> {
  const datalinkUrl = `${DATALINK_URL}?ID=${encodeURIComponent(`ivo://irsa.ipac/${PIXEL_RELEASE}?${obsId}/${detector}`)}`;
  const rows = toRecords(parseVoTable(await api.get(datalinkUrl, { timeout: 30_000 }).text()));
  const self = rows.find((r) => r.semantics === "#this" && r.access_url);
  if (!self) throw new NotFoundError(`${obsId} ${detector}: ${PIXEL_RELEASE}에 대응 파일이 없습니다`);
  let cloudUrl: string | null = null;
  try {
    const aws = JSON.parse(self.cloud_access || "{}").aws as { bucket_name?: string; key?: string; region?: string } | undefined;
    if (aws?.bucket_name && aws.key) {
      cloudUrl = `https://${aws.bucket_name}.s3.${aws.region ?? "us-east-1"}.amazonaws.com/${aws.key}`;
    }
  } catch {
    cloudUrl = null;
  }
  return { release: PIXEL_RELEASE, datalinkUrl, fileUrl: self.access_url, cloudUrl };
}

export function rangeFetcher(url: string): RangeFetcher {
  return Object.assign(async (start: number, end: number) => {
    const response = await api.get(url, { headers: { Range: `bytes=${start}-${end}` }, timeout: 30_000 });
    // A server that ignores Range would send the whole 60+ MB file; refuse instead of downloading it.
    if (response.status !== 206) throw new Error(`Range request not honoured (${response.status})`);
    return response.arrayBuffer();
  }, { url });
}

function toBase64(array: Float32Array | Int32Array): string {
  return Buffer.from(array.buffer, array.byteOffset, array.byteLength).toString("base64");
}

export async function fetchFrame(params: { obsId: string; detector: string; ra: number; dec: number; size: number }): Promise<FramePayload> {
  const resolved = await resolvePixelFile(params.obsId, params.detector);
  const source = resolved.cloudUrl ?? resolved.fileUrl;
  let cut;
  try {
    cut = await readRemoteCutout(rangeFetcher(source), params.ra, params.dec, params.size);
  } catch (e) {
    if (e instanceof OutsideDetectorError) throw new NotFoundError(e.message);
    throw e;
  }
  const h = cut.imageHeader;
  return {
    key: `${params.obsId}:${params.detector}`,
    obsId: params.obsId,
    detector: params.detector,
    release: resolved.release,
    fileUrl: resolved.fileUrl,
    pixelSource: `${source} — HTTP range: 행 ${cut.y0}–${cut.y0 + cut.height - 1}, 열 ${cut.x0}–${cut.x0 + cut.width - 1} (0-based)`,
    datalinkUrl: resolved.datalinkUrl,
    origin: [cut.x0, cut.y0],
    fullSize: [cut.fullWidth, cut.fullHeight],
    centerRa: params.ra,
    centerDec: params.dec,
    width: cut.width,
    height: cut.height,
    image: toBase64(cut.image),
    variance: toBase64(cut.variance),
    zodi: toBase64(cut.zodi),
    flags: toBase64(cut.flags),
    flagBits: cut.flagBits,
    wcs: cut.wcs,
    wave: cut.wave,
    header: {
      bunit: headerString(h, "BUNIT") ?? "",
      dateObs: headerString(h, "DATE-OBS") ?? "",
      dateAvg: headerString(h, "DATE-AVG") ?? "",
      mjdAvg: headerNumber(h, "MJD-AVG") ?? NaN,
      xposureS: headerNumber(h, "XPOSURE") ?? NaN,
      psfFwhmArcsec: headerNumber(h, "PSF_FWHM"),
      omegaMedianArcsec2: headerNumber(h, "OMEGA_MEDIAN"),
      l1Dqa: headerString(h, "L1DQAFLG"),
      l2Dqa: headerString(h, "L2DQAFLG"),
    },
  };
}

/**
 * Heliocentric and observer distance from JPL Horizons. Geocentric (500@399): SPHEREx is in low Earth orbit,
 * so Δ differs by < 10⁴ km — fine for distances, never used for pixel positions.
 */
export async function fetchGeometry(mjd: number): Promise<GeometryResult> {
  const search = new URLSearchParams({
    format: "json",
    COMMAND: "'C/2025 N1'",
    OBJ_DATA: "NO",
    MAKE_EPHEM: "YES",
    EPHEM_TYPE: "OBSERVER",
    CENTER: "'500@399'",
    TLIST: `'${mjd}'`,
    TLIST_TYPE: "MJD",
    QUANTITIES: "'19,20'",
    CSV_FORMAT: "YES",
  });
  const json = await api.get(`${HORIZONS_URL}?${search}`, { timeout: 30_000 }).json<{ result?: string; error?: string }>();
  if (json.error || !json.result) throw new Error(json.error ?? "Horizons returned no result");
  const block = /\$\$SOE([\s\S]*?)\$\$EOE/.exec(json.result)?.[1]?.trim();
  if (!block) throw new Error("Horizons ephemeris block not found");
  // Columns: date, (solar presence), (lunar presence), r, rdot, delta, deldot
  const cols = block.split("\n")[0].split(",").map((s) => s.trim());
  const numbers = cols.map(Number).filter((n, i) => i > 0 && cols[i] !== "" && Number.isFinite(n));
  const [rHelAu, , deltaAu] = numbers;
  if (!Number.isFinite(rHelAu) || !Number.isFinite(deltaAu)) throw new Error("Unexpected Horizons columns");
  return { mjd, center: "Geocentric (500@399)", rHelAu, deltaAu, source: "JPL Horizons API, target 'C/2025 N1'" };
}
