import type { NativeFrame } from "@/app/_lib/fpl/checks";
import { measureAt } from "@/app/_lib/fpl/checks";
import { decodeBits, MEASUREMENT_EXCLUDE } from "@/app/_lib/fpl/flags";
import { skyToPixel } from "@/app/_lib/comet/wcs";
import type { TanSipWcs } from "@/app/_lib/comet/types";

/** Pixel (0-based) → sky by Newton iteration on the sky→pixel transform (TAN-SIP). */
export function pixelToSky(wcs: TanSipWcs, x: number, y: number, guess: { ra: number; dec: number }) {
  let { ra, dec } = guess;
  for (let it = 0; it < 8; it++) {
    const p = skyToPixel(wcs, ra, dec);
    const h = 1e-4;
    const pa = skyToPixel(wcs, ra + h, dec);
    const pd = skyToPixel(wcs, ra, dec + h);
    if (!p || !pa || !pd) return null;
    const j11 = (pa.x - p.x) / h, j21 = (pa.y - p.y) / h, j12 = (pd.x - p.x) / h, j22 = (pd.y - p.y) / h;
    const ex = x - p.x, ey = y - p.y;
    const det = j11 * j22 - j12 * j21;
    ra += (j22 * ex - j12 * ey) / det;
    dec += (-j21 * ex + j11 * ey) / det;
    if (Math.hypot(ex, ey) < 1e-6) break;
  }
  return { ra, dec };
}

export interface ModelVsImage {
  snr: number | null;
  /** Flux-weighted centroid of pixels > background + 2σ within 3 px of the model position. */
  measured: { ra: number; dec: number; x: number; y: number } | null;
  offsetArcsec: number | null;
  pixelScaleArcsec: number;
  wavelengthUm: number | null;
  usablePixels: number;
}

/**
 * Compares the model position with the image on native pixels. Reports the signal and a centroid near
 * the model position — never a "detection" verdict.
 */
export function compareModelWithImage(frame: NativeFrame, ra: number, dec: number): ModelVsImage {
  const m = measureAt(frame, ra, dec);
  const p = frame.payload;
  const bits = decodeBits(p.flagBits);
  const excl = bits.filter((b) => MEASUREMENT_EXCLUDE.includes(b.name)).reduce((a, b) => a | b.mask, 0) >>> 0;
  const bg = m.photometry?.backgroundMjySr;
  let sw = 0, sx = 0, sy = 0, used = 0;
  if (m.inside && bg != null && Number.isFinite(bg)) {
    for (let j = Math.floor(m.y - 3); j <= Math.ceil(m.y + 3); j++) {
      for (let i = Math.floor(m.x - 3); i <= Math.ceil(m.x + 3); i++) {
        if (i < 0 || j < 0 || i >= p.width || j >= p.height || Math.hypot(i - m.x, j - m.y) > 3) continue;
        const k = j * p.width + i;
        if ((frame.flags[k] >>> 0) & excl) continue;
        const w = frame.image[k] - bg;
        if (!(w > 2 * Math.sqrt(Math.max(0, frame.variance[k])))) continue;
        used++;
        sw += w;
        sx += w * i;
        sy += w * j;
      }
    }
  }
  let measured: ModelVsImage["measured"] = null;
  let offset: number | null = null;
  if (sw > 0 && used >= 3) {
    const x = sx / sw;
    const y = sy / sw;
    const sky = pixelToSky(p.wcs, x, y, { ra, dec });
    if (sky) {
      measured = { ...sky, x, y };
      const dRa = (sky.ra - ra) * Math.cos((dec * Math.PI) / 180);
      offset = Math.hypot(dRa, sky.dec - dec) * 3600;
    }
  }
  const ph = m.photometry && m.photometry.apertureArea > 0 && Number.isFinite(m.photometry.snr) ? m.photometry : null;
  return { snr: ph?.snr ?? null, measured, offsetArcsec: offset, pixelScaleArcsec: m.pixelScaleArcsec, wavelengthUm: m.wavelengthUm, usablePixels: used };
}
