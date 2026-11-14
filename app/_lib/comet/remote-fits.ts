import { dataLengthOf, headerNumber, paddedLength, parseHeader, readTableRow, type FitsHdu } from "./fits";
import { riceDecompress32 } from "./rice";
import { skyToPixel } from "./wcs";
import type { FlagBit, TanSipWcs, WaveLookup } from "./types";

/**
 * Reads a pixel cutout straight out of a remote SPHEREx L2b FITS file with HTTP range requests:
 * the HDU headers, then only the rows around the target for IMAGE / VARIANCE / ZODI / FLAGS
 * (FLAGS is RICE_1 tile-compressed, one row per tile), then the WCS-WAVE row. EPSF is skipped.
 * Nothing is written anywhere; about 2–3 MB is transferred per cutout.
 */

export type RangeFetcher = (start: number, endInclusive: number) => Promise<ArrayBuffer>;

export class OutsideDetectorError extends Error {}

async function readHeaderAt(fetchRange: RangeFetcher, offset: number, index: number): Promise<FitsHdu> {
  let size = 2880 * 12;
  for (;;) {
    const bytes = new Uint8Array(await fetchRange(offset, offset + size - 1));
    const parsed = parseHeader(bytes);
    if (parsed) {
      return {
        index,
        header: parsed.header,
        cards: parsed.cards,
        dataOffset: offset + parsed.length,
        dataLength: dataLengthOf(parsed.header),
      };
    }
    if (bytes.length < size || size > 2880 * 200) throw new Error("FITS header END not found");
    size *= 4;
  }
}

const extname = (h: FitsHdu) => String(h.header.get("EXTNAME") ?? "").trim();

/** Walks the HDU chain reading headers only, until all `wanted` extensions are found. */
export async function readRemoteHeaders(fetchRange: RangeFetcher, wanted: string[]): Promise<Map<string, FitsHdu>> {
  const found = new Map<string, FitsHdu>();
  let offset = 0;
  for (let index = 0; index < 16 && wanted.some((w) => !found.has(w)); index++) {
    let hdu: FitsHdu;
    try {
      hdu = await readHeaderAt(fetchRange, offset, index);
    } catch (e) {
      if (index > 0) break; // past the last HDU
      throw e;
    }
    found.set(extname(hdu) || `HDU${index}`, hdu);
    offset = hdu.dataOffset + paddedLength(hdu.dataLength);
  }
  return found;
}

export function readWcs(hdu: FitsHdu): TanSipWcs {
  const num = (k: string, d = 0) => headerNumber(hdu, k) ?? d;
  const cdelt1 = num("CDELT1", 1);
  const cdelt2 = num("CDELT2", 1);
  const cd: TanSipWcs["cd"] = hdu.header.has("CD1_1")
    ? [[num("CD1_1"), num("CD1_2")], [num("CD2_1"), num("CD2_2")]]
    : [[cdelt1 * num("PC1_1", 1), cdelt1 * num("PC1_2")], [cdelt2 * num("PC2_1"), cdelt2 * num("PC2_2", 1)]];
  const poly = (prefix: "AP" | "BP") => {
    const out: Record<string, number> = {};
    for (const [k, v] of hdu.header) {
      const m = new RegExp(`^${prefix}_(\\d+)_(\\d+)$`).exec(k);
      if (m && typeof v === "number") out[`${m[1]}_${m[2]}`] = v;
    }
    return out;
  };
  return { crpix: [num("CRPIX1"), num("CRPIX2")], crval: [num("CRVAL1"), num("CRVAL2")], cd, ap: poly("AP"), bp: poly("BP") };
}

export function readFlagBits(hdu: FitsHdu): FlagBit[] {
  const bits: FlagBit[] = [];
  for (const [k, v] of hdu.header) {
    const m = /^MSKN(\d{4})$/.exec(k);
    if (!m) continue;
    bits.push({ bit: Number(m[1]), name: String(v).trim(), description: String(hdu.header.get(`MSKD${m[1]}`) ?? "").trim() });
  }
  return bits.sort((a, b) => a.bit - b.bit);
}

export interface RemoteCutout {
  width: number;
  height: number;
  /** Cutout origin in the full detector image (0-based). */
  x0: number;
  y0: number;
  image: Float32Array;
  variance: Float32Array;
  zodi: Float32Array;
  flags: Int32Array;
  flagBits: FlagBit[];
  /** WCS with CRPIX shifted to the cutout. */
  wcs: TanSipWcs;
  wave: WaveLookup | null;
  imageHeader: FitsHdu;
}

async function readFloatRows(fetchRange: RangeFetcher, hdu: FitsHdu, fullWidth: number, x0: number, y0: number, w: number, h: number) {
  const bitpix = Number(hdu.header.get("BITPIX"));
  if (bitpix !== -32) throw new Error(`${extname(hdu)}: expected BITPIX -32, got ${bitpix}`);
  const rowBytes = fullWidth * 4;
  const start = hdu.dataOffset + y0 * rowBytes;
  const view = new DataView(await fetchRange(start, start + h * rowBytes - 1));
  const out = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) out[j * w + i] = view.getFloat32(j * rowBytes + (x0 + i) * 4, false);
  return out;
}

async function readFlagRows(fetchRange: RangeFetcher, hdu: FitsHdu, fullWidth: number, x0: number, y0: number, w: number, h: number) {
  const out = new Int32Array(w * h);
  if (hdu.header.get("ZIMAGE") !== true) {
    // Uncompressed int32 image.
    const rowBytes = fullWidth * 4;
    const start = hdu.dataOffset + y0 * rowBytes;
    const view = new DataView(await fetchRange(start, start + h * rowBytes - 1));
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) out[j * w + i] = view.getInt32(j * rowBytes + (x0 + i) * 4, false);
    return out;
  }
  const cmp = String(hdu.header.get("ZCMPTYPE") ?? "").trim();
  const tileW = Number(hdu.header.get("ZTILE1"));
  const tileH = Number(hdu.header.get("ZTILE2") ?? 1);
  if (cmp !== "RICE_1" || tileW !== fullWidth || tileH !== 1 || Number(hdu.header.get("ZBITPIX")) !== 32) {
    throw new Error(`FLAGS compression ${cmp} ${tileW}×${tileH} is not supported`);
  }
  let blockSize = 32;
  for (let n = 1; n <= 8; n++) if (String(hdu.header.get(`ZNAME${n}`) ?? "").trim() === "BLOCKSIZE") blockSize = Number(hdu.header.get(`ZVAL${n}`));
  const rowLen = Number(hdu.header.get("NAXIS1"));
  const nrows = Number(hdu.header.get("NAXIS2"));
  const heapStart = hdu.dataOffset + Number(hdu.header.get("THEAP") ?? rowLen * nrows);

  // Descriptor (P: int32 count, int32 heap offset) is the first column of each row.
  const desc = new DataView(await fetchRange(hdu.dataOffset + y0 * rowLen, hdu.dataOffset + (y0 + h) * rowLen - 1));
  const tiles = Array.from({ length: h }, (_, j) => ({ count: desc.getInt32(j * rowLen, false), offset: desc.getInt32(j * rowLen + 4, false) }));
  const lo = Math.min(...tiles.map((t) => t.offset));
  const hi = Math.max(...tiles.map((t) => t.offset + t.count));
  const heap = new Uint8Array(await fetchRange(heapStart + lo, heapStart + hi - 1));
  tiles.forEach((t, j) => {
    const row = riceDecompress32(heap.subarray(t.offset - lo, t.offset - lo + t.count), fullWidth, blockSize);
    for (let i = 0; i < w; i++) out[j * w + i] = row[x0 + i];
  });
  return out;
}

export async function readRemoteCutout(fetchRange: RangeFetcher, ra: number, dec: number, size: number): Promise<RemoteCutout> {
  const hdus = await readRemoteHeaders(fetchRange, ["IMAGE", "FLAGS", "VARIANCE", "ZODI", "WCS-WAVE"]);
  const image = hdus.get("IMAGE");
  const flags = hdus.get("FLAGS");
  const variance = hdus.get("VARIANCE");
  const zodi = hdus.get("ZODI");
  if (!image || !flags || !variance || !zodi) throw new Error("L2b file is missing IMAGE/FLAGS/VARIANCE/ZODI");

  const W = Number(image.header.get("NAXIS1"));
  const H = Number(image.header.get("NAXIS2"));
  const fullWcs = readWcs(image);
  const p = skyToPixel(fullWcs, ra, dec);
  if (!p || p.x < -size / 2 || p.y < -size / 2 || p.x > W + size / 2 || p.y > H + size / 2) {
    throw new OutsideDetectorError("요청한 좌표가 이 노출의 검출기 영역 밖입니다");
  }
  const w = Math.min(size, W);
  const h = Math.min(size, H);
  const x0 = Math.min(W - w, Math.max(0, Math.round(p.x) - Math.floor(w / 2)));
  const y0 = Math.min(H - h, Math.max(0, Math.round(p.y) - Math.floor(h / 2)));

  const waveHdu = hdus.get("WCS-WAVE");
  const [img, vari, zod, flg, waveRow] = await Promise.all([
    readFloatRows(fetchRange, image, W, x0, y0, w, h),
    readFloatRows(fetchRange, variance, W, x0, y0, w, h),
    readFloatRows(fetchRange, zodi, W, x0, y0, w, h),
    readFlagRows(fetchRange, flags, W, x0, y0, w, h),
    waveHdu
      ? fetchRange(waveHdu.dataOffset, waveHdu.dataOffset + waveHdu.dataLength - 1).then((buf) =>
          readTableRow(buf, { ...waveHdu, dataOffset: 0 }),
        )
      : Promise.resolve(null),
  ]);

  let wave: WaveLookup | null = null;
  if (waveRow && Array.isArray(waveRow.X) && Array.isArray(waveRow.Y) && Array.isArray(waveRow.VALUES)) {
    const n = (k: string, d: number) => headerNumber(image, k) ?? d;
    wave = {
      x: waveRow.X,
      y: waveRow.Y,
      values: waveRow.VALUES,
      crpix: [n("CRPIX1W", 1) - x0, n("CRPIX2W", 1) - y0],
      crval: [n("CRVAL1W", 1), n("CRVAL2W", 1)],
      cdelt: [n("CDELT1W", 1), n("CDELT2W", 1)],
    };
  }

  return {
    width: w,
    height: h,
    x0,
    y0,
    image: img,
    variance: vari,
    zodi: zod,
    flags: flg,
    flagBits: readFlagBits(flags),
    wcs: { ...fullWcs, crpix: [fullWcs.crpix[0] - x0, fullWcs.crpix[1] - y0] },
    wave,
    imageHeader: image,
  };
}
