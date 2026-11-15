import { APERTURE_BAD_FLAGS, ARCSEC2_TO_SR, maskFor, sigmaClip } from "@/app/_lib/comet/photometry";
import { skyToPixel, wavelengthAt } from "@/app/_lib/comet/wcs";
import type { NativeFrame } from "./checks";

/**
 * Brightness of one position in every exposure, so that visits can be compared at the same wavelength and the
 * exposures of one visit can be read as a spectrum. Native pixels only. Nothing here decides that a source varies:
 * it reports ratios with their scatter.
 *
 * Two measurements per exposure, both above the same far background ring:
 * - core: every usable pixel within `coreRadiusPx`. Right for sources that do not saturate.
 * - ring: the light in a ring outside a saturated core (`rings`, the innermost usable one is chosen). It holds only
 *   the wings of the point-spread function, so it is a RELATIVE brightness: comparable between exposures at the
 *   same wavelength on the same detector, not a total flux.
 */
export const BRIGHTNESS_PARAMS = {
  coreRadiusPx: 2,
  /** Rings tried from the inside out (pixels). Brighter stars saturate further out and need a wider one. */
  rings: [[3, 6], [6, 10], [10, 15]] as [number, number][],
  backgroundPx: [20, 28] as [number, number],
  /** A ring is offered when at least this share of the exposures can be measured with it. */
  minRingExposures: 0.8,
  /** A 1-px-wide sub-ring needs this share of usable pixels, or the ring is not measured. */
  minSubRingCoverage: 0.5,
  /** Exposures of two visits are paired when their wavelengths differ by less than this share of the bandwidth. */
  matchBandwidthFraction: 0.5,
  /** Visits are separated by a gap longer than this (days), as everywhere else in the app. */
  visitGapDays: 20,
  /** Below this the difference is within what the absolute calibration alone could produce. */
  minChangeMag: 0.05,
  minPairs: 3,
  sigma: 3,
  version: "fpl-brightness-1",
} as const;

export interface BrightnessValue {
  fluxMjy: number;
  errorMjy: number;
  /** Share of the nominal area that was usable (0–1). */
  coverage: number;
}

export interface BrightnessPoint {
  key: string;
  detector: string;
  mjd: number;
  wavelengthUm: number;
  bandwidthUm: number;
  core: BrightnessValue | null;
  /** Pixels within 1 px of the position left out of the core sum (saturated, non-linear…): core is a lower limit. */
  coreExcludedPixels: number;
  /** One value per entry of `BRIGHTNESS_PARAMS.rings`; null where too many pixels of the ring are unusable. */
  rings: (BrightnessValue | null)[];
  /** Unusable pixels within the outermost ring, and how far out the farthest one sits. */
  excludedPixels: number;
  excludedRadiusPx: number;
}

/** "core", or the index of a ring in `BRIGHTNESS_PARAMS.rings`. */
export type BrightnessMethod = "core" | number;

export function measureBrightness(frame: NativeFrame, ra: number, dec: number): BrightnessPoint | null {
  const p = frame.payload;
  const P = BRIGHTNESS_PARAMS;
  const pos = skyToPixel(p.wcs, ra, dec);
  if (!pos || !p.wave) return null;
  const { x, y } = pos;
  const reach = P.backgroundPx[1];
  if (!(x >= reach && y >= reach && x <= p.width - 1 - reach && y <= p.height - 1 - reach)) return null;
  const wave = wavelengthAt(p.wave, x, y);
  if (!Number.isFinite(wave.wavelength) || !Number.isFinite(p.header.mjdAvg)) return null;

  const bad = maskFor(p.flagBits, APERTURE_BAD_FLAGS);
  const usable = (k: number) => !((frame.flags[k] >>> 0) & bad) && Number.isFinite(frame.image[k]) && Number.isFinite(frame.variance[k]);

  const sky: number[] = [];
  const ringStart = P.rings[0][0];
  const ringEnd = P.rings[P.rings.length - 1][1];
  // 1-px-wide sub-rings from the first ring's inner edge to the last ring's outer edge.
  const subRings = Array.from({ length: ringEnd - ringStart }, () => ({ sum: 0, varSum: 0, used: 0, total: 0 }));
  let coreSum = 0, coreVar = 0, coreUsed = 0, coreTotal = 0, coreExcluded = 0, excluded = 0, excludedRadius = 0;
  for (let j = Math.floor(y - reach); j <= Math.ceil(y + reach); j++) {
    for (let i = Math.floor(x - reach); i <= Math.ceil(x + reach); i++) {
      const d = Math.hypot(i - x, j - y);
      if (d > reach) continue;
      const k = j * p.width + i;
      const ok = usable(k);
      if (d >= P.backgroundPx[0]) {
        if (ok) sky.push(frame.image[k]);
        continue;
      }
      if (d > ringEnd) continue;
      if (!ok) {
        excluded++;
        excludedRadius = Math.max(excludedRadius, d);
        if (d <= 1) coreExcluded++;
      }
      if (d <= P.coreRadiusPx) {
        coreTotal++;
        if (ok) {
          coreUsed++;
          coreSum += frame.image[k];
          coreVar += frame.variance[k];
        }
      }
      if (d >= ringStart) {
        const s = subRings[Math.min(subRings.length - 1, Math.floor(d - ringStart))];
        s.total++;
        if (ok) {
          s.used++;
          s.sum += frame.image[k];
          s.varSum += frame.variance[k];
        }
      }
    }
  }
  const bg = sigmaClip(sky);
  if (!(bg.n >= 20)) return null;
  const toMjy = (p.header.omegaMedianArcsec2 ?? pixelArea(p.wcs.cd)) * ARCSEC2_TO_SR * 1e9;
  const bgVarOfMean = (bg.sigma * bg.sigma) / bg.n;

  const core: BrightnessValue | null =
    coreUsed > 0
      ? {
          fluxMjy: (coreSum - coreUsed * bg.median) * toMjy,
          errorMjy: Math.sqrt(coreVar + coreUsed * coreUsed * bgVarOfMean) * toMjy,
          coverage: coreUsed / coreTotal,
        }
      : null;

  // Each 1-px sub-ring contributes its mean surface brightness times its full pixel count, so a few unusable
  // pixels do not shift the sum toward the fainter outer part.
  const rings = P.rings.map(([rIn, rOut]): BrightnessValue | null => {
    const parts = subRings.slice(rIn - ringStart, rOut - ringStart);
    if (!parts.every((s) => s.total > 0 && s.used / s.total >= P.minSubRingCoverage)) return null;
    let flux = 0, variance = 0, used = 0, total = 0;
    for (const s of parts) {
      const scale = s.total / s.used;
      flux += (s.sum - s.used * bg.median) * scale;
      variance += s.varSum * scale * scale;
      used += s.used;
      total += s.total;
    }
    return { fluxMjy: flux * toMjy, errorMjy: Math.sqrt(variance + total * total * bgVarOfMean) * toMjy, coverage: used / total };
  });

  return {
    key: p.key,
    detector: p.detector,
    mjd: p.header.mjdAvg,
    wavelengthUm: wave.wavelength,
    bandwidthUm: wave.bandwidth,
    core,
    coreExcludedPixels: coreExcluded,
    rings,
    excludedPixels: excluded,
    excludedRadiusPx: excludedRadius,
  };
}

function pixelArea(cd: [[number, number], [number, number]]) {
  return Math.abs(cd[0][0] * cd[1][1] - cd[0][1] * cd[1][0]) * 3600 * 3600;
}

/** Rings that enough of the exposures can be measured with. */
export function usableRings(points: BrightnessPoint[]): number[] {
  return BRIGHTNESS_PARAMS.rings.map((_, i) => i).filter((i) => points.filter((p) => p.rings[i]).length >= BRIGHTNESS_PARAMS.minRingExposures * points.length);
}

/**
 * A core missing its centre pixels is a lower limit, so once that happens in any exposure the innermost usable
 * ring is used instead. Null when the source saturates beyond every ring.
 */
export function chooseMethod(points: BrightnessPoint[]): BrightnessMethod | null {
  if (!points.some((p) => p.coreExcludedPixels > 0 || !p.core)) return "core";
  return usableRings(points)[0] ?? null;
}

export const valueOf = (p: BrightnessPoint, method: BrightnessMethod) => (method === "core" ? p.core : p.rings[method]);

/** Visit index (0-based) of each point, by the same 20-day gap rule as the exposure lists. */
export function visitIndex(points: BrightnessPoint[]): Map<string, number> {
  const out = new Map<string, number>();
  let visit = -1;
  let last = -Infinity;
  for (const p of [...points].sort((a, b) => a.mjd - b.mjd)) {
    if (p.mjd - last > BRIGHTNESS_PARAMS.visitGapDays) visit++;
    last = p.mjd;
    out.set(p.key, visit);
  }
  return out;
}

export interface BrightnessPair {
  detector: string;
  a: BrightnessPoint;
  b: BrightnessPoint;
  /** b / a, and its error from the two measurement errors. */
  ratio: number;
  ratioError: number;
}

/**
 * Pairs exposures of two visits on the same detector whose wavelengths at the position agree within a share of
 * the bandwidth. Each exposure is used once; closest wavelengths are paired first.
 */
export function matchVisits(points: BrightnessPoint[], method: BrightnessMethod, visitA: number, visitB: number): BrightnessPair[] {
  const visits = visitIndex(points);
  const good = points.filter((p) => {
    const v = valueOf(p, method);
    return v !== null && v.fluxMjy > 0 && v.errorMjy > 0;
  });
  const pairs: BrightnessPair[] = [];
  for (const detector of new Set(good.map((p) => p.detector))) {
    const as = good.filter((p) => p.detector === detector && visits.get(p.key) === visitA);
    const bs = good.filter((p) => p.detector === detector && visits.get(p.key) === visitB);
    const options: { a: BrightnessPoint; b: BrightnessPoint; d: number }[] = [];
    for (const a of as) for (const b of bs) {
      const d = Math.abs(a.wavelengthUm - b.wavelengthUm) / Math.min(a.bandwidthUm, b.bandwidthUm);
      if (d <= BRIGHTNESS_PARAMS.matchBandwidthFraction) options.push({ a, b, d });
    }
    const used = new Set<string>();
    for (const o of options.sort((p, q) => p.d - q.d)) {
      if (used.has(o.a.key) || used.has(o.b.key)) continue;
      used.add(o.a.key);
      used.add(o.b.key);
      const va = valueOf(o.a, method)!;
      const vb = valueOf(o.b, method)!;
      const ratio = vb.fluxMjy / va.fluxMjy;
      pairs.push({ detector, a: o.a, b: o.b, ratio, ratioError: ratio * Math.hypot(va.errorMjy / va.fluxMjy, vb.errorMjy / vb.fluxMjy) });
    }
  }
  return pairs.sort((p, q) => p.a.wavelengthUm - q.a.wavelengthUm);
}

export interface ChangeSummary {
  pairs: number;
  /** Median of b / a over the pairs. */
  medianRatio: number;
  /** Change in magnitudes; negative means brighter in the later visit. */
  deltaMag: number;
  /** Uncertainty of deltaMag from the scatter of the pairs themselves (1.4826 × MAD / √N). */
  deltaMagError: number;
  verdict: "changed" | "no-change-found" | "too-few-pairs";
}

/** Summary of a set of pairs. The scatter of the pairs sets the uncertainty, because it includes what the formal errors miss. */
export function summarizeChange(pairs: BrightnessPair[]): ChangeSummary | null {
  if (!pairs.length) return null;
  const mags = pairs.map((p) => -2.5 * Math.log10(p.ratio)).sort((a, b) => a - b);
  const median = (v: number[]) => (v.length % 2 ? v[v.length >> 1] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2);
  const m = median(mags);
  const mad = median(mags.map((v) => Math.abs(v - m)).sort((a, b) => a - b));
  const formal = median(pairs.map((p) => (2.5 / Math.LN10) * (p.ratioError / p.ratio)).sort((a, b) => a - b));
  const error = Math.max(1.4826 * mad, formal) / Math.sqrt(pairs.length);
  const P = BRIGHTNESS_PARAMS;
  const verdict =
    pairs.length < P.minPairs ? "too-few-pairs" : Math.abs(m) >= P.minChangeMag && Math.abs(m) >= P.sigma * error ? "changed" : "no-change-found";
  return { pairs: pairs.length, medianRatio: 10 ** (-0.4 * m), deltaMag: m, deltaMagError: error, verdict };
}
