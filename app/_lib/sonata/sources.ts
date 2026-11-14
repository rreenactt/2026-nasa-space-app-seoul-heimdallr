import { sigmaClip, ARCSEC2_TO_SR } from "@/app/_lib/comet/photometry";
import type { NativeFrame } from "@/app/_lib/fpl/checks";
import { decodeBits } from "@/app/_lib/fpl/flags";
import { pixelToSky } from "@/app/_lib/nim/measure";

/**
 * Point sources found on NATIVE SPHEREx pixels (IMAGE − ZODI − local sky). Brightness is a 3×3-pixel sum
 * in mJy; nothing here depends on display contrast.
 */

export interface SonataSource {
  id: string;
  ra: number;
  dec: number;
  x: number; // native pixel
  y: number;
  /** 3×3 sum above the sky, mJy. null when saturated (brightness unreliable). */
  fluxMjy: number | null;
  snr: number | null;
  quality: "ok" | "saturated";
  flags: string[];
}

export const DETECTION = { snrPeak: 5, snrSum: 5, minSaturatedPixels: 6, version: "sonata-sources-2" } as const;

const UNUSABLE = ["NONFUNC", "MISSING_DATA", "HOT", "COLD"];
const SATURATION = ["OVERFLOW", "NONLINEAR", "BLOOM", "SUR_ERROR"];
/** Single-exposure hits: never used as a source peak. */
const TRANSIENT = ["TRANSIENT", "SNOWBALL"];

export function skyLevel(frame: NativeFrame): { median: number; sigma: number } {
  const v: number[] = [];
  for (let k = 0; k < frame.image.length; k++) {
    const x = frame.image[k] - frame.zodi[k];
    if (Number.isFinite(x)) v.push(x);
  }
  const s = sigmaClip(v);
  return { median: s.median, sigma: s.sigma };
}

export function detectSources(frame: NativeFrame): SonataSource[] {
  const p = frame.payload;
  const W = p.width;
  const H = p.height;
  const bits = decodeBits(p.flagBits);
  const mask = (names: string[]) => bits.filter((b) => names.includes(b.name)).reduce((m, b) => m | b.mask, 0) >>> 0;
  const unusable = mask(UNUSABLE);
  const sat = mask(SATURATION);
  const hit = mask(TRANSIENT);
  const sky = skyLevel(frame);
  const omegaSr = (p.header.omegaMedianArcsec2 ?? 37.8) * ARCSEC2_TO_SR;
  const toMjy = 1e6 * omegaSr * 1e3;
  const val = (k: number) => frame.image[k] - frame.zodi[k] - sky.median;
  const ok = (k: number) => !((frame.flags[k] >>> 0) & unusable) && Number.isFinite(frame.image[k]);

  const out: SonataSource[] = [];

  // 1) Local maxima ≥ 5σ on usable, non-saturated pixels.
  for (let y = 2; y < H - 2; y++) {
    for (let x = 2; x < W - 2; x++) {
      const k = y * W + x;
      if (!ok(k) || (frame.flags[k] >>> 0) & (sat | hit)) continue;
      const v = val(k);
      const sig = Math.sqrt(Math.max(1e-12, frame.variance[k]));
      if (v / sig < DETECTION.snrPeak) continue;
      let isMax = true;
      for (let dy = -2; dy <= 2 && isMax; dy++) for (let dx = -2; dx <= 2; dx++) if ((dx || dy) && ok(k + dy * W + dx) && val(k + dy * W + dx) > v) { isMax = false; break; }
      if (!isMax) continue;
      let sum = 0, vs = 0, sx = 0, sy = 0, satNear = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const kk = k + dy * W + dx;
        if ((frame.flags[kk] >>> 0) & sat) satNear = true;
        if (!ok(kk)) continue;
        const w = val(kk);
        sum += w; vs += Math.max(0, frame.variance[kk]);
        sx += Math.max(0, w) * (x + dx); sy += Math.max(0, w) * (y + dy);
      }
      const wsum = (() => { let s = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const kk = k + dy * W + dx; if (ok(kk)) s += Math.max(0, val(kk)); } return s; })();
      if (!satNear && sum / Math.sqrt(Math.max(1e-12, vs)) < DETECTION.snrSum) continue;
      const px = wsum > 0 ? sx / wsum : x;
      const py = wsum > 0 ? sy / wsum : y;
      const sky2 = pixelToSky(p.wcs, px, py, approxSky(p, px, py));
      if (!sky2) continue;
      out.push({
        id: `s${out.length + 1}`,
        ...sky2,
        x: px,
        y: py,
        fluxMjy: satNear ? null : sum * toMjy,
        snr: satNear ? null : sum / Math.sqrt(Math.max(1e-12, vs)),
        quality: satNear ? "saturated" : "ok",
        flags: [...new Set(bits.filter((b) => (frame.flags[k] >>> 0) & b.mask).map((b) => b.name))],
      });
    }
  }

  // 2) Saturated stars: each connected region of saturation-flagged pixels becomes ONE source.
  const seen = new Uint8Array(W * H);
  for (let k0 = 0; k0 < W * H; k0++) {
    if (seen[k0] || !((frame.flags[k0] >>> 0) & sat)) continue;
    const stack = [k0];
    seen[k0] = 1;
    let n = 0, sx = 0, sy = 0;
    while (stack.length) {
      const k = stack.pop()!;
      const x = k % W, y = (k - x) / W;
      n++; sx += x; sy += y;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const kk = yy * W + xx;
        if (!seen[kk] && (frame.flags[kk] >>> 0) & sat) {
          seen[kk] = 1;
          stack.push(kk);
        }
      }
    }
    if (n < DETECTION.minSaturatedPixels) continue;
    const px = sx / n, py = sy / n;
    // Drop measured peaks that sit inside this saturated region (bloom wings, not separate sources).
    for (let i = out.length - 1; i >= 0; i--) if (out[i].quality === "saturated" && Math.hypot(out[i].x - px, out[i].y - py) < Math.sqrt(n)) out.splice(i, 1);
    const sky2 = pixelToSky(p.wcs, px, py, approxSky(p, px, py));
    if (!sky2) continue;
    out.push({ id: `s${out.length + 1}`, ...sky2, x: px, y: py, fluxMjy: null, snr: null, quality: "saturated", flags: [`saturated region, ${n} px`] });
  }
  return out;
}

/** Rough starting point for the pixel→sky solver: linear from the reference pixel. */
function approxSky(p: NativeFrame["payload"], x: number, y: number) {
  const u = x + 1 - p.wcs.crpix[0];
  const v = y + 1 - p.wcs.crpix[1];
  const [[a, b], [c, d]] = p.wcs.cd;
  const dec = p.wcs.crval[1] + c * u + d * v;
  const ra = p.wcs.crval[0] + (a * u + b * v) / Math.cos((dec * Math.PI) / 180);
  return { ra, dec };
}
