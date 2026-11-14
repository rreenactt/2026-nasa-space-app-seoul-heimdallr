import type { HeaderValue } from "@/app/_lib/comet/fits";
import type { CelestialWcs, SkyGrid } from "./types";

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

function poly(coeffs: Record<string, number>, u: number, v: number): number {
  let s = 0;
  for (const k in coeffs) {
    const i = k.indexOf("_");
    s += coeffs[k] * u ** Number(k.slice(0, i)) * v ** Number(k.slice(i + 1));
  }
  return s;
}

/** Reads TAN/SIN (±SIP) WCS from a FITS header: CD, PC+CDELT, or CDELT+CROTA2. */
export function parseCelestialWcs(header: Map<string, HeaderValue>): CelestialWcs {
  const num = (k: string, d = 0) => {
    const v = header.get(k);
    return typeof v === "number" ? v : d;
  };
  const ctype = String(header.get("CTYPE1") ?? "");
  const projection = ctype.includes("-SIN") ? "SIN" : ctype.includes("-TAN") ? "TAN" : null;
  if (!projection) throw new Error(`Unsupported projection ${ctype}`);

  let cd: CelestialWcs["cd"];
  if (header.has("CD1_1")) {
    cd = [[num("CD1_1"), num("CD1_2")], [num("CD2_1"), num("CD2_2")]];
  } else {
    const c1 = num("CDELT1", 1);
    const c2 = num("CDELT2", 1);
    if (header.has("PC1_1")) {
      cd = [[c1 * num("PC1_1", 1), c1 * num("PC1_2")], [c2 * num("PC2_1"), c2 * num("PC2_2", 1)]];
    } else {
      const rho = num("CROTA2") * D2R;
      cd = [[c1 * Math.cos(rho), -c2 * Math.sin(rho)], [c1 * Math.sin(rho), c2 * Math.cos(rho)]];
    }
  }
  const coeffs = (prefix: string) => {
    const out: Record<string, number> = {};
    const re = new RegExp(`^${prefix}_(\\d+)_(\\d+)$`);
    for (const [k, v] of header) {
      const m = re.exec(k);
      if (m && typeof v === "number") out[`${m[1]}_${m[2]}`] = v;
    }
    return out;
  };
  return {
    projection,
    crpix: [num("CRPIX1"), num("CRPIX2")],
    crval: [num("CRVAL1"), num("CRVAL2")],
    cd,
    a: coeffs("A"),
    b: coeffs("B"),
    ap: coeffs("AP"),
    bp: coeffs("BP"),
  };
}

/** Sky (deg) → 0-based pixel (x right, y up as stored). Null on the far side of the projection. */
export function skyToPixel(w: CelestialWcs, ra: number, dec: number): { x: number; y: number } | null {
  const a0 = w.crval[0] * D2R;
  const d0 = w.crval[1] * D2R;
  const a = ra * D2R;
  const d = dec * D2R;
  const cosc = Math.sin(d0) * Math.sin(d) + Math.cos(d0) * Math.cos(d) * Math.cos(a - a0);
  if (cosc <= 0) return null;
  let xi = Math.cos(d) * Math.sin(a - a0);
  let eta = Math.cos(d0) * Math.sin(d) - Math.sin(d0) * Math.cos(d) * Math.cos(a - a0);
  if (w.projection === "TAN") {
    xi /= cosc;
    eta /= cosc;
  }
  xi *= R2D;
  eta *= R2D;

  const [[c11, c12], [c21, c22]] = w.cd;
  const det = c11 * c22 - c12 * c21;
  const U = (c22 * xi - c12 * eta) / det;
  const V = (-c21 * xi + c11 * eta) / det;

  let u = U;
  let v = V;
  if (Object.keys(w.ap).length || Object.keys(w.bp).length) {
    u = U + poly(w.ap, U, V);
    v = V + poly(w.bp, U, V);
  } else if (Object.keys(w.a).length || Object.keys(w.b).length) {
    // Only forward SIP: solve u + A(u,v) = U by fixed-point iteration.
    for (let i = 0; i < 8; i++) {
      u = U - poly(w.a, u, v);
      v = V - poly(w.b, u, v);
    }
  }
  return { x: u + w.crpix[0] - 1, y: v + w.crpix[1] - 1 };
}

export const gridScaleDeg = (g: SkyGrid) => g.fovArcmin / 60 / g.n;

/** Grid pixel (column i, row r from the top; pixel centers on integers) → sky (deg). TAN, north up, east left. */
export function gridToSky(g: SkyGrid, i: number, r: number): { ra: number; dec: number } {
  const s = gridScaleDeg(g) * D2R;
  const c = (g.n - 1) / 2;
  const x = (c - i) * s; // east (increasing RA) to the left
  const y = (c - r) * s; // north up
  const rho = Math.hypot(x, y);
  const d0 = g.dec * D2R;
  if (rho === 0) return { ra: g.ra, dec: g.dec };
  const cc = Math.atan(rho);
  const dec = Math.asin(Math.cos(cc) * Math.sin(d0) + (y * Math.sin(cc) * Math.cos(d0)) / rho);
  const ra = g.ra * D2R + Math.atan2(x * Math.sin(cc), rho * Math.cos(d0) * Math.cos(cc) - y * Math.sin(d0) * Math.sin(cc));
  return { ra: ((ra * R2D) % 360 + 360) % 360, dec: dec * R2D };
}

/** Sky → grid (column, row from top). */
export function skyToGrid(g: SkyGrid, ra: number, dec: number): { i: number; r: number } | null {
  const a0 = g.ra * D2R;
  const d0 = g.dec * D2R;
  const a = ra * D2R;
  const d = dec * D2R;
  const cosc = Math.sin(d0) * Math.sin(d) + Math.cos(d0) * Math.cos(d) * Math.cos(a - a0);
  if (cosc <= 0) return null;
  const xi = (Math.cos(d) * Math.sin(a - a0)) / cosc;
  const eta = (Math.cos(d0) * Math.sin(d) - Math.sin(d0) * Math.cos(d) * Math.cos(a - a0)) / cosc;
  const s = gridScaleDeg(g) * D2R;
  const c = (g.n - 1) / 2;
  return { i: c - xi / s, r: c - eta / s };
}

/** Great-circle separation in arcseconds. */
export function separationArcsec(ra1: number, dec1: number, ra2: number, dec2: number): number {
  const h =
    Math.sin(((dec2 - dec1) * D2R) / 2) ** 2 +
    Math.cos(dec1 * D2R) * Math.cos(dec2 * D2R) * Math.sin(((ra2 - ra1) * D2R) / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(h))) * R2D * 3600;
}

/** Linear proper-motion propagation from a reference epoch (years). Ignores parallax and radial velocity. */
export function propagate(ra: number, dec: number, pmraMasYr: number, pmdecMasYr: number, fromYear: number, toYear: number) {
  const dt = toYear - fromYear;
  const dDec = (pmdecMasYr * dt) / 3.6e6;
  const dRa = (pmraMasYr * dt) / 3.6e6 / Math.cos(dec * D2R);
  return { ra: ra + dRa, dec: dec + dDec };
}

const MJD_EPOCH_MS = Date.UTC(1858, 10, 17);
export const mjdToDate = (mjd: number) => new Date(MJD_EPOCH_MS + mjd * 86_400_000);
/** Decimal Julian year (close enough to decimal year for proper-motion offsets). */
export const mjdToYear = (mjd: number) => 2000 + (mjd - 51544.5) / 365.25;
