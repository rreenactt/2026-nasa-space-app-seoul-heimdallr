import type { ApertureParams, FlagBit, PhotometryResult, QualityReason } from "./types";

/** 1 arcsec² in steradians. */
export const ARCSEC2_TO_SR = (Math.PI / (180 * 3600)) ** 2;

/**
 * Flag planes that make a pixel unusable inside the comet aperture (by name; bit numbers come from the file header).
 * OUTLIER is deliberately absent: the pipeline flags the comet's own bright core as an outlier because a moving
 * coma is not in the reference sky, so masking it would discard the comet itself.
 */
export const APERTURE_BAD_FLAGS = [
  "TRANSIENT",
  "OVERFLOW",
  "SUR_ERROR",
  "NONFUNC",
  "MISSING_DATA",
  "HOT",
  "COLD",
  "NONLINEAR",
  "PERSIST",
  "SNOWBALL",
  "STREAK",
] as const;

/** The background annulus also drops OUTLIER pixels (cosmic rays, residual stars). */
export const ANNULUS_BAD_FLAGS = [...APERTURE_BAD_FLAGS, "OUTLIER"] as const;

export function maskFor(flagBits: FlagBit[], names: readonly string[]): number {
  let mask = 0;
  for (const f of flagBits) if (names.includes(f.name)) mask |= 1 << f.bit;
  return mask >>> 0;
}

/** Fraction of pixel (px, py) inside a circle, by 5×5 sub-sampling. Pixel centers sit on integer coordinates. */
function circleWeight(px: number, py: number, cx: number, cy: number, r: number): number {
  const d = Math.hypot(px - cx, py - cy);
  if (d > r + 0.75) return 0;
  if (d < r - 0.75) return 1;
  let inside = 0;
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 5; j++) {
      const sx = px - 0.4 + i * 0.2;
      const sy = py - 0.4 + j * 0.2;
      if ((sx - cx) ** 2 + (sy - cy) ** 2 <= r * r) inside++;
    }
  }
  return inside / 25;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** 3σ-clipped median and standard deviation (rejects field stars left in the annulus). */
export function sigmaClip(values: number[], nsigma = 3, iterations = 5): { median: number; sigma: number; n: number } {
  let kept = values.filter(Number.isFinite);
  for (let it = 0; it < iterations && kept.length > 2; it++) {
    const med = median(kept);
    const sd = Math.sqrt(kept.reduce((s, v) => s + (v - med) ** 2, 0) / (kept.length - 1));
    const next = kept.filter((v) => Math.abs(v - med) <= nsigma * sd);
    if (next.length === kept.length) break;
    kept = next;
  }
  if (kept.length === 0) return { median: NaN, sigma: NaN, n: 0 };
  const med = median(kept);
  const sd = kept.length > 1 ? Math.sqrt(kept.reduce((s, v) => s + (v - med) ** 2, 0) / (kept.length - 1)) : NaN;
  return { median: med, sigma: sd, n: kept.length };
}

export interface PhotometryInput {
  width: number;
  height: number;
  image: Float32Array; // MJy/sr
  variance: Float32Array; // (MJy/sr)²
  flags: Int32Array;
  flagBits: FlagBit[];
  /** Comet position, 0-based pixel. */
  x: number;
  y: number;
  /** Pixel solid angle in arcsec² (OMEGA_MEDIAN from the header). */
  omegaArcsec2: number;
  params: ApertureParams;
  wave: { wavelength: number; bandwidth: number } | null;
  dqaPassed: boolean;
}

/**
 * Circular-aperture photometry with a local sigma-clipped annulus background.
 * Flux density = Σ w·(I − B) · Ω, converted MJy/sr·sr → mJy.
 * Error = sqrt(Σ w²·VAR + A²·σ_B²/N_ann) · Ω  (pixel noise + background-mean uncertainty).
 * Field stars are NOT model-subtracted (the paper subtracted simulated star fields); this is a first-pass measurement.
 */
export function aperturePhotometry(input: PhotometryInput): PhotometryResult {
  const { width, height, image, variance, flags, x, y, params } = input;
  const bad = maskFor(input.flagBits, APERTURE_BAD_FLAGS);
  const source = maskFor(input.flagBits, ["SOURCE"]);
  const annulusMask = (maskFor(input.flagBits, ANNULUS_BAD_FLAGS) | (params.maskSourcesInAnnulus ? source : 0)) >>> 0;
  const reasons: QualityReason[] = [];

  // Background annulus.
  const annulusValues: number[] = [];
  const x0 = Math.max(0, Math.floor(x - params.rOut - 1));
  const x1 = Math.min(width - 1, Math.ceil(x + params.rOut + 1));
  const y0 = Math.max(0, Math.floor(y - params.rOut - 1));
  const y1 = Math.min(height - 1, Math.ceil(y + params.rOut + 1));
  if (x - params.rOut < -0.5 || y - params.rOut < -0.5 || x + params.rOut > width - 0.5 || y + params.rOut > height - 0.5) {
    reasons.push("edge");
  }
  for (let j = y0; j <= y1; j++) {
    for (let i = x0; i <= x1; i++) {
      const d = Math.hypot(i - x, j - y);
      if (d < params.rIn || d > params.rOut) continue;
      const k = j * width + i;
      if ((flags[k] >>> 0) & annulusMask) continue;
      if (!Number.isFinite(image[k])) continue;
      annulusValues.push(image[k]);
    }
  }
  const bg = sigmaClip(annulusValues);

  // Aperture sum.
  let sum = 0;
  let varSum = 0;
  let totalWeight = 0;
  let usedWeight = 0;
  const ax0 = Math.max(0, Math.floor(x - params.rAp - 1));
  const ax1 = Math.min(width - 1, Math.ceil(x + params.rAp + 1));
  const ay0 = Math.max(0, Math.floor(y - params.rAp - 1));
  const ay1 = Math.min(height - 1, Math.ceil(y + params.rAp + 1));
  for (let j = ay0; j <= ay1; j++) {
    for (let i = ax0; i <= ax1; i++) {
      const w = circleWeight(i, j, x, y, params.rAp);
      if (w === 0) continue;
      totalWeight += w;
      const k = j * width + i;
      if ((flags[k] >>> 0) & bad || !Number.isFinite(image[k]) || !Number.isFinite(variance[k])) continue;
      usedWeight += w;
      sum += w * (image[k] - bg.median);
      varSum += w * w * variance[k];
    }
  }
  const expectedArea = Math.PI * params.rAp * params.rAp;
  const coverage = expectedArea > 0 ? usedWeight / expectedArea : 0;
  if (coverage < 0.9 || totalWeight < expectedArea * 0.9) reasons.push("masked");

  const omegaSr = input.omegaArcsec2 * ARCSEC2_TO_SR;
  const toMjy = 1e6 * omegaSr * 1e3; // MJy/sr × sr → Jy → mJy
  const bgErr2 = bg.n > 0 ? (usedWeight * usedWeight * bg.sigma * bg.sigma) / bg.n : NaN;
  const fluxMjy = sum * toMjy;
  const errorMjy = Math.sqrt(varSum + bgErr2) * toMjy;
  const snr = errorMjy > 0 ? fluxMjy / errorMjy : 0;
  if (!(snr >= 3)) reasons.push("low-snr");
  if (!input.dqaPassed) reasons.push("dqa-fail");
  if (!input.wave) reasons.push("no-wave");

  return {
    x,
    y,
    wavelengthUm: input.wave?.wavelength ?? null,
    bandwidthUm: input.wave?.bandwidth ?? null,
    fluxMjy,
    errorMjy,
    snr,
    backgroundMjySr: bg.median,
    backgroundSigma: bg.sigma,
    apertureArea: usedWeight,
    apertureCoverage: coverage,
    annulusPixels: bg.n,
    omegaSr,
    quality: reasons.length > 0 ? "flagged" : "ok",
    reasons,
  };
}
