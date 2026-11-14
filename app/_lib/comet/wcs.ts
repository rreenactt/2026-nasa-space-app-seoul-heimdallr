import type { TanSipWcs, WaveLookup } from "./types";

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

function sipPoly(coeffs: Record<string, number>, u: number, v: number): number {
  let sum = 0;
  for (const [pq, c] of Object.entries(coeffs)) {
    const [p, q] = pq.split("_").map(Number);
    sum += c * u ** p * v ** q;
  }
  return sum;
}

/**
 * Sky (ICRS deg) → pixel, 0-based (x right, y up as stored in FITS).
 * Gnomonic projection about CRVAL (LONPOLE 180), inverse CD, then the sky→detector SIP terms AP/BP.
 * Returns null when the point is on the far hemisphere.
 */
export function skyToPixel(wcs: TanSipWcs, ra: number, dec: number): { x: number; y: number } | null {
  const [a0, d0] = [wcs.crval[0] * D2R, wcs.crval[1] * D2R];
  const a = ra * D2R;
  const d = dec * D2R;
  const cosc = Math.sin(d0) * Math.sin(d) + Math.cos(d0) * Math.cos(d) * Math.cos(a - a0);
  if (cosc <= 0) return null;
  const xi = (Math.cos(d) * Math.sin(a - a0)) / cosc * R2D;
  const eta = (Math.cos(d0) * Math.sin(d) - Math.sin(d0) * Math.cos(d) * Math.cos(a - a0)) / cosc * R2D;

  const [[c11, c12], [c21, c22]] = wcs.cd;
  const det = c11 * c22 - c12 * c21;
  const U = (c22 * xi - c12 * eta) / det;
  const V = (-c21 * xi + c11 * eta) / det;

  const u = U + sipPoly(wcs.ap, U, V);
  const v = V + sipPoly(wcs.bp, U, V);
  // FITS pixel (1-based) = u + CRPIX → 0-based subtract 1.
  return { x: u + wcs.crpix[0] - 1, y: v + wcs.crpix[1] - 1 };
}

/** Angular distance (deg) between two sky positions. */
export function angularDistanceDeg(ra1: number, dec1: number, ra2: number, dec2: number): number {
  const s =
    Math.sin(((dec2 - dec1) * D2R) / 2) ** 2 +
    Math.cos(dec1 * D2R) * Math.cos(dec2 * D2R) * Math.sin(((ra2 - ra1) * D2R) / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(s))) * R2D;
}

function bracket(points: number[], value: number): [number, number, number] {
  if (value <= points[0]) return [0, 1, 0];
  const last = points.length - 1;
  if (value >= points[last]) return [last - 1, last, 1];
  let i = 0;
  while (points[i + 1] < value) i++;
  return [i, i + 1, (value - points[i]) / (points[i + 1] - points[i])];
}

/**
 * Per-pixel wavelength / bandwidth (µm) from the SPHEREx WAVE-TAB lookup (bilinear).
 * Input pixel is 0-based in the cutout; the table is indexed in raw detector coordinates.
 * This is the approximate per-pixel solution intended for visualization and first-pass spectra.
 */
export function wavelengthAt(lut: WaveLookup, x0: number, y0: number): { wavelength: number; bandwidth: number } {
  const px = x0 + 1;
  const py = y0 + 1;
  const rx = lut.crval[0] + (px - lut.crpix[0]) * lut.cdelt[0];
  const ry = lut.crval[1] + (py - lut.crpix[1]) * lut.cdelt[1];
  const nx = lut.x.length;
  const [ix0, ix1, tx] = bracket(lut.x, rx);
  const [iy0, iy1, ty] = bracket(lut.y, ry);
  const at = (k: number, ix: number, iy: number) => lut.values[k + 2 * (ix + nx * iy)];
  const interp = (k: number) =>
    at(k, ix0, iy0) * (1 - tx) * (1 - ty) +
    at(k, ix1, iy0) * tx * (1 - ty) +
    at(k, ix0, iy1) * (1 - tx) * ty +
    at(k, ix1, iy1) * tx * ty;
  return { wavelength: interp(0), bandwidth: interp(1) };
}
