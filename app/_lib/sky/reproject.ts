import { gridToSky, skyToPixel } from "./wcs";
import type { CelestialWcs, SkyGrid } from "./types";

export interface SourceImage {
  width: number;
  height: number;
  /** Row 0 = FITS row 1 (bottom). NaN marks unusable pixels. */
  data: Float32Array;
  wcs: CelestialWcs;
}

/**
 * Resamples a source image onto the common grid (bilinear; a pixel with any missing neighbour falls back to
 * the nearest valid one). Grid pixels outside the source stay NaN, so "no data" is never shown as dark sky.
 * Note: a finer grid does not add resolution — it only interpolates the original pixels.
 */
export function reproject(src: SourceImage, grid: SkyGrid): Float32Array {
  const out = new Float32Array(grid.n * grid.n).fill(NaN);
  const { width: w, height: h, data } = src;
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < w && y < h ? data[y * w + x] : NaN);
  for (let r = 0; r < grid.n; r++) {
    for (let i = 0; i < grid.n; i++) {
      const sky = gridToSky(grid, i, r);
      const p = skyToPixel(src.wcs, sky.ra, sky.dec);
      if (!p || p.x < -0.5 || p.y < -0.5 || p.x > w - 0.5 || p.y > h - 0.5) continue;
      const x0 = Math.floor(p.x);
      const y0 = Math.floor(p.y);
      const tx = p.x - x0;
      const ty = p.y - y0;
      const v00 = at(x0, y0);
      const v10 = at(x0 + 1, y0);
      const v01 = at(x0, y0 + 1);
      const v11 = at(x0 + 1, y0 + 1);
      let v: number;
      if (Number.isFinite(v00) && Number.isFinite(v10) && Number.isFinite(v01) && Number.isFinite(v11)) {
        v = v00 * (1 - tx) * (1 - ty) + v10 * tx * (1 - ty) + v01 * (1 - tx) * ty + v11 * tx * ty;
      } else {
        v = at(Math.round(p.x), Math.round(p.y));
      }
      out[r * grid.n + i] = v;
    }
  }
  return out;
}

function medianOf(values: number[]): number {
  values.sort((a, b) => a - b);
  const m = values.length >> 1;
  return values.length % 2 ? values[m] : (values[m - 1] + values[m]) / 2;
}

export function finiteMedian(data: Float32Array): number {
  const v: number[] = [];
  for (const x of data) if (Number.isFinite(x)) v.push(x);
  return v.length ? medianOf(v) : NaN;
}

/** Per-pixel median of several resampled frames, ignoring NaN (cosmic rays and moving artefacts drop out). */
export function medianStack(frames: Float32Array[]): Float32Array {
  if (frames.length === 1) return frames[0];
  const n = frames[0].length;
  const out = new Float32Array(n).fill(NaN);
  const buf: number[] = [];
  for (let k = 0; k < n; k++) {
    buf.length = 0;
    for (const f of frames) if (Number.isFinite(f[k])) buf.push(f[k]);
    if (buf.length) out[k] = medianOf(buf);
  }
  return out;
}

export function coverageOf(data: Float32Array): number {
  let c = 0;
  for (const x of data) if (Number.isFinite(x)) c++;
  return c / data.length;
}

/**
 * Nearest-neighbour map from grid pixels to source pixel indices (-1 = outside the source).
 * Used to display integer bit masks without mixing bits, and to trace every displayed pixel
 * back to the original pixel it came from.
 */
export function nearestIndexMap(width: number, height: number, wcs: CelestialWcs, grid: SkyGrid): Int32Array {
  const out = new Int32Array(grid.n * grid.n).fill(-1);
  for (let r = 0; r < grid.n; r++) {
    for (let i = 0; i < grid.n; i++) {
      const sky = gridToSky(grid, i, r);
      const p = skyToPixel(wcs, sky.ra, sky.dec);
      if (!p) continue;
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      out[r * grid.n + i] = y * width + x;
    }
  }
  return out;
}
