/**
 * Minimal FITS reader for SPHEREx L2b cutouts: primary + IMAGE extensions (BITPIX 8/16/32/-32/-64)
 * and BINTABLE extensions (raw rows; column decoding is left to the caller).
 * Pure TS, no I/O — the caller passes the downloaded bytes.
 */

export type HeaderValue = string | number | boolean | null;

export interface FitsHdu {
  index: number;
  header: Map<string, HeaderValue>;
  /** Raw header cards (80-char), kept for keywords such as HIERARCH that we don't index. */
  cards: string[];
  dataOffset: number;
  dataLength: number;
}

const BLOCK = 2880;
const CARD = 80;

function parseValue(raw: string): HeaderValue {
  const s = raw.trim();
  if (s.startsWith("'")) {
    // String: up to the closing quote ('' is an escaped quote).
    let out = "";
    for (let i = 1; i < s.length; i++) {
      if (s[i] === "'") {
        if (s[i + 1] === "'") {
          out += "'";
          i++;
          continue;
        }
        break;
      }
      out += s[i];
    }
    return out.trimEnd();
  }
  const valuePart = s.split("/")[0].trim();
  if (valuePart === "T") return true;
  if (valuePart === "F") return false;
  if (valuePart === "") return null;
  const n = Number(valuePart.replace(/D/i, "E"));
  return Number.isFinite(n) ? n : valuePart;
}

function parseCard(card: string): [string, HeaderValue] | null {
  if (card.startsWith("HIERARCH ")) {
    const eq = card.indexOf("=");
    if (eq < 0) return null;
    return [card.slice(9, eq).trim(), parseValue(card.slice(eq + 1))];
  }
  if (card.slice(8, 10) !== "= ") return null;
  return [card.slice(0, 8).trim(), parseValue(card.slice(10))];
}

/**
 * Parses one header starting at `bytes[0]`. Returns null when END is not within the bytes
 * (the caller then fetches more). `length` is the header size rounded up to whole blocks.
 */
export function parseHeader(bytes: Uint8Array): { header: Map<string, HeaderValue>; cards: string[]; length: number } | null {
  const decoder = new TextDecoder("ascii");
  const header = new Map<string, HeaderValue>();
  const cards: string[] = [];
  for (let offset = 0; offset + BLOCK <= bytes.length; offset += BLOCK) {
    const block = decoder.decode(bytes.subarray(offset, offset + BLOCK));
    for (let i = 0; i < BLOCK; i += CARD) {
      const card = block.slice(i, i + CARD);
      if (card.startsWith("END") && card.slice(3).trim() === "") return { header, cards, length: offset + BLOCK };
      cards.push(card);
      const kv = parseCard(card);
      if (kv && !header.has(kv[0])) header.set(kv[0], kv[1]);
    }
  }
  return null;
}

/** Size in bytes of the data unit described by a header (without block padding). */
export function dataLengthOf(header: Map<string, HeaderValue>): number {
  const naxis = Number(header.get("NAXIS") ?? 0);
  if (naxis === 0) return 0;
  const bitpix = Number(header.get("BITPIX") ?? 8);
  let count = 1;
  for (let a = 1; a <= naxis; a++) count *= Number(header.get(`NAXIS${a}`) ?? 0);
  const pcount = Number(header.get("PCOUNT") ?? 0);
  const gcount = Number(header.get("GCOUNT") ?? 1);
  return (Math.abs(bitpix) / 8) * gcount * (pcount + count);
}

export const paddedLength = (n: number) => Math.ceil(n / BLOCK) * BLOCK;

export function readHdus(buffer: ArrayBuffer): FitsHdu[] {
  const bytes = new Uint8Array(buffer);
  const hdus: FitsHdu[] = [];
  let offset = 0;
  while (offset + BLOCK <= bytes.length) {
    const parsed = parseHeader(bytes.subarray(offset));
    if (!parsed) break;
    offset += parsed.length;
    const dataLength = dataLengthOf(parsed.header);
    hdus.push({ index: hdus.length, header: parsed.header, cards: parsed.cards, dataOffset: offset, dataLength });
    offset += paddedLength(dataLength);
  }
  return hdus;
}

export function findHdu(hdus: FitsHdu[], extname: string): FitsHdu | undefined {
  return hdus.find((h) => String(h.header.get("EXTNAME") ?? "").trim() === extname);
}

/** Reads a 2-D image HDU into a Float64-free Float32Array (or Int32Array for integer flags), applying BSCALE/BZERO. */
export function readImage(buffer: ArrayBuffer, hdu: FitsHdu): { width: number; height: number; data: Float32Array | Int32Array } {
  const width = Number(hdu.header.get("NAXIS1"));
  const height = Number(hdu.header.get("NAXIS2"));
  const bitpix = Number(hdu.header.get("BITPIX"));
  const bscale = Number(hdu.header.get("BSCALE") ?? 1);
  const bzero = Number(hdu.header.get("BZERO") ?? 0);
  const view = new DataView(buffer, hdu.dataOffset, hdu.dataLength);
  const n = width * height;

  if (bitpix === 32 && bscale === 1 && bzero === 0) {
    const out = new Int32Array(n);
    for (let i = 0; i < n; i++) out[i] = view.getInt32(i * 4, false);
    return { width, height, data: out };
  }

  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v: number;
    switch (bitpix) {
      case -32: v = view.getFloat32(i * 4, false); break;
      case -64: v = view.getFloat64(i * 8, false); break;
      case 32: v = view.getInt32(i * 4, false); break;
      case 16: v = view.getInt16(i * 2, false); break;
      case 8: v = view.getUint8(i); break;
      default: throw new Error(`Unsupported BITPIX ${bitpix}`);
    }
    out[i] = v * bscale + bzero;
  }
  return { width, height, data: out };
}

const TFORM_BYTES: Record<string, number> = { L: 1, B: 1, I: 2, J: 4, K: 8, E: 4, D: 8, A: 1 };

/** Decodes the columns of the first row of a BINTABLE (enough for one-row lookup tables). */
export function readTableRow(buffer: ArrayBuffer, hdu: FitsHdu, row = 0): Record<string, number[] | string> {
  const tfields = Number(hdu.header.get("TFIELDS") ?? 0);
  const rowLength = Number(hdu.header.get("NAXIS1"));
  const view = new DataView(buffer, hdu.dataOffset + row * rowLength, rowLength);
  const out: Record<string, number[] | string> = {};
  let pos = 0;
  for (let c = 1; c <= tfields; c++) {
    const name = String(hdu.header.get(`TTYPE${c}`) ?? `COL${c}`).trim();
    const tform = String(hdu.header.get(`TFORM${c}`)).trim();
    const m = /^(\d*)([A-Z])/.exec(tform);
    if (!m) throw new Error(`Bad TFORM ${tform}`);
    const repeat = m[1] === "" ? 1 : Number(m[1]);
    const type = m[2];
    const size = TFORM_BYTES[type];
    if (!size) throw new Error(`Unsupported TFORM ${tform}`);
    if (type === "A") {
      let s = "";
      for (let i = 0; i < repeat; i++) s += String.fromCharCode(view.getUint8(pos + i));
      out[name] = s.trimEnd();
    } else {
      const values: number[] = [];
      for (let i = 0; i < repeat; i++) {
        const p = pos + i * size;
        switch (type) {
          case "B": case "L": values.push(view.getUint8(p)); break;
          case "I": values.push(view.getInt16(p, false)); break;
          case "J": values.push(view.getInt32(p, false)); break;
          case "K": values.push(Number(view.getBigInt64(p, false))); break;
          case "E": values.push(view.getFloat32(p, false)); break;
          case "D": values.push(view.getFloat64(p, false)); break;
        }
      }
      out[name] = values;
    }
    pos += repeat * size;
  }
  return out;
}

export function headerNumber(hdu: FitsHdu, key: string): number | null {
  const v = hdu.header.get(key);
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function headerString(hdu: FitsHdu, key: string): string | null {
  const v = hdu.header.get(key);
  return v === undefined || v === null ? null : String(v).trim();
}
