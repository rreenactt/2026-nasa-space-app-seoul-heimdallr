/**
 * Star guide: finds the stars in the sky picture on screen and measures how big and how bright each one LOOKS there.
 *
 * This measures the displayed picture (a color-stretched HiPS rendering), not the sky: values depend on the zoom, the
 * background survey and its color mapping. They are relative to this one screen, never magnitudes or fluxes, and they
 * say nothing about whether a star moves. Everything runs in the browser on the pixels Aladin Lite drew.
 */

export const DETECT_PARAMS = {
  /** Background and noise are estimated in square cells of this size (CSS pixels). */
  cellPx: 32,
  /** A peak must stand this many noise sigmas above the local background… */
  peakSigma: 5,
  /** …and at least this many brightness levels (0–255), so flat, noiseless areas do not produce peaks. */
  minPeakAboveBackground: 18,
  /** A pixel is a local maximum if nothing within this radius is brighter. */
  peakRadiusPx: 2,
  /** Largest radius a star may grow to; larger blobs are galaxies, nebulae or the Milky Way's glow. */
  maxRadiusPx: 16,
  /** Pixels at or above this level are clipped white on screen. */
  saturatedLevel: 250,
  /** Second-moment axis ratio above which a blob is a line (coordinate grid) or an artifact, not a star. */
  maxElongation: 2.2,
  /** Share of a star's brightness in its central 3×3 pixels below which it is diffuse glow (galaxy, nebula), not a star. */
  minCoreShare: 0.15,
  /** Peaks this close to the picture edge are skipped (cut off by the edge). */
  edgePx: 6,
  /** At most this many stars are returned, brightest first. */
  maxStars: 40,
  /** Only the highest peaks are measured, so a crowded Milky Way screen stays fast; the rest are only counted. */
  maxMeasured: 300,
} as const;

export type ScreenColor = "reddish" | "white" | "bluish";

export type DetectedStar = {
  /** Centroid in CSS pixels of the picture. */
  x: number;
  y: number;
  /** Background-subtracted brightness summed over the star, in screen brightness units (relative only). */
  brightness: number;
  /** Brightest pixel above the background, 0–255. */
  peak: number;
  /** Full width at half maximum of the blob on screen, CSS pixels. */
  fwhmPx: number;
  /** Radius the measurement used, CSS pixels. */
  radiusPx: number;
  /** Some pixels are clipped white: the true brightness is higher than the screen can show. */
  saturated: boolean;
  /** Color of the star in this picture, from its red/blue balance. */
  color: ScreenColor;
};

export type Detection = {
  stars: DetectedStar[];
  /** All stars found before the cut to `maxStars` (an estimate when `approximate`). */
  found: number;
  /** More peaks than `maxMeasured`: the unmeasured ones are counted as stars without checking their shape. */
  approximate: boolean;
  width: number;
  height: number;
};

/** Perceived brightness of each pixel (Rec. 709 luma), 0–255. */
function luminance(rgba: Uint8ClampedArray, n: number) {
  const out = new Float32Array(n);
  for (let k = 0, p = 0; k < n; k++, p += 4) out[k] = 0.2126 * rgba[p] + 0.7152 * rgba[p + 1] + 0.0722 * rgba[p + 2];
  return out;
}

function median(values: number[]) {
  values.sort((a, b) => a - b);
  const m = values.length >> 1;
  return values.length % 2 ? values[m] : (values[m - 1] + values[m]) / 2;
}

/** Median background and robust noise (1.4826 × MAD) per cell, from every second pixel. */
function backgroundGrid(lum: Float32Array, width: number, height: number, cell: number) {
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const level = new Float32Array(cols * rows);
  const sigma = new Float32Array(cols * rows);
  const sample: number[] = [];
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      sample.length = 0;
      for (let y = cy * cell; y < Math.min((cy + 1) * cell, height); y += 2) {
        for (let x = cx * cell; x < Math.min((cx + 1) * cell, width); x += 2) sample.push(lum[y * width + x]);
      }
      const med = median(sample);
      const deviations = sample.map((v) => Math.abs(v - med));
      level[cy * cols + cx] = med;
      sigma[cy * cols + cx] = Math.max(1.4826 * median(deviations), 1);
    }
  }
  return { cols, level, sigma };
}

export function detectStars(rgba: Uint8ClampedArray, width: number, height: number): Detection {
  const P = DETECT_PARAMS;
  const n = width * height;
  const lum = luminance(rgba, n);
  const bg = backgroundGrid(lum, width, height, P.cellPx);
  const cellOf = (x: number, y: number) => Math.floor(y / P.cellPx) * bg.cols + Math.floor(x / P.cellPx);

  // 1) Peaks: local maxima clearly above the local background.
  const peaks: { x: number; y: number; value: number }[] = [];
  const r = P.peakRadiusPx;
  for (let y = P.edgePx; y < height - P.edgePx; y++) {
    for (let x = P.edgePx; x < width - P.edgePx; x++) {
      const k = y * width + x;
      const v = lum[k];
      const c = cellOf(x, y);
      const above = v - bg.level[c];
      if (above < P.minPeakAboveBackground || above < P.peakSigma * bg.sigma[c]) continue;
      let isPeak = true;
      for (let j = -r; j <= r && isPeak; j++) {
        for (let i = -r; i <= r; i++) {
          if (i === 0 && j === 0) continue;
          const w = lum[k + j * width + i];
          // Ties go to the first pixel in reading order, so a flat-topped (clipped) star gives one peak.
          if (w > v || (w === v && (j < 0 || (j === 0 && i < 0)))) {
            isPeak = false;
            break;
          }
        }
      }
      if (isPeak) peaks.push({ x, y, value: v });
    }
  }
  peaks.sort((a, b) => b.value - a.value);

  // 2) Measure each peak, brightest first; fainter peaks inside an accepted star are part of it.
  const stars: DetectedStar[] = [];
  const measured = peaks.slice(0, P.maxMeasured);
  for (const peak of measured) {
    if (stars.some((s) => Math.hypot(s.x - peak.x, s.y - peak.y) <= s.radiusPx + 1)) continue;
    const c = cellOf(peak.x, peak.y);
    const level = bg.level[c];
    const noise = bg.sigma[c];
    // Grow the radius until the ring falls to the background (within 2σ).
    let radius = 1;
    while (radius < P.maxRadiusPx) {
      let sum = 0;
      let count = 0;
      for (let a = 0; a < 24; a++) {
        const angle = (a / 24) * 2 * Math.PI;
        const x = Math.round(peak.x + (radius + 1) * Math.cos(angle));
        const y = Math.round(peak.y + (radius + 1) * Math.sin(angle));
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        sum += lum[y * width + x];
        count++;
      }
      if (count === 0 || sum / count - level <= 2 * noise) break;
      radius++;
    }
    if (radius >= P.maxRadiusPx) continue; // extended: not a star
    // A blob that would swallow a brighter star already accepted is that star's halo or spike.
    if (stars.some((s) => Math.hypot(s.x - peak.x, s.y - peak.y) <= radius + 1)) continue;

    let flux = 0;
    let sx = 0;
    let sy = 0;
    let red = 0;
    let blue = 0;
    let clipped = 0;
    let core = 0;
    const px: [number, number, number][] = [];
    for (let y = peak.y - radius; y <= peak.y + radius; y++) {
      for (let x = peak.x - radius; x <= peak.x + radius; x++) {
        if (x < 0 || y < 0 || x >= width || y >= height || Math.hypot(x - peak.x, y - peak.y) > radius + 0.5) continue;
        const k = y * width + x;
        const w = lum[k] - level;
        if (lum[k] >= P.saturatedLevel) clipped++;
        if (w <= 0) continue;
        flux += w;
        if (Math.abs(x - peak.x) <= 1 && Math.abs(y - peak.y) <= 1) core += w;
        sx += w * x;
        sy += w * y;
        red += w * rgba[k * 4];
        blue += w * rgba[k * 4 + 2];
        px.push([x, y, w]);
      }
    }
    if (flux <= 0 || px.length < 3) continue;
    const saturated = clipped >= 2;
    if (!saturated && core / flux < P.minCoreShare) continue; // diffuse glow
    const cx = sx / flux;
    const cy = sy / flux;
    let ixx = 0;
    let iyy = 0;
    let ixy = 0;
    for (const [x, y, w] of px) {
      ixx += w * (x - cx) ** 2;
      iyy += w * (y - cy) ** 2;
      ixy += w * (x - cx) * (y - cy);
    }
    ixx /= flux;
    iyy /= flux;
    ixy /= flux;
    const root = Math.sqrt(((ixx - iyy) / 2) ** 2 + ixy * ixy);
    const major = (ixx + iyy) / 2 + root;
    const minor = Math.max((ixx + iyy) / 2 - root, 1e-3);
    if (Math.sqrt(major / minor) > P.maxElongation) continue; // a line or an artifact

    const balance = (red - blue) / Math.max(red + blue, 1);
    stars.push({
      x: cx,
      y: cy,
      brightness: flux,
      peak: peak.value - level,
      fwhmPx: 2.3548 * Math.sqrt((ixx + iyy) / 2),
      radiusPx: radius,
      saturated,
      color: balance > 0.12 ? "reddish" : balance < -0.12 ? "bluish" : "white",
    });
  }

  stars.sort((a, b) => b.brightness - a.brightness);
  const unmeasured = peaks.length - measured.length;
  return { stars: stars.slice(0, P.maxStars), found: stars.length + unmeasured, approximate: unmeasured > 0, width, height };
}
