import { aperturePhotometry } from "@/app/_lib/comet/photometry";
import type { FramePayload, PhotometryResult } from "@/app/_lib/comet/types";
import { skyToPixel, wavelengthAt } from "@/app/_lib/comet/wcs";
import { decodeBits, FLAG_CATEGORIES, MEASUREMENT_EXCLUDE, namesIn, UNKNOWN_CATEGORY, type DecodedBit } from "./flags";
import type { BrightNeighbor, CheckItem, Verdict } from "./types";

/**
 * Deterministic candidate checks on NATIVE SPHEREx pixels (never on the resampled display grid).
 * Each check reports evidence; nothing here declares an object real or fake.
 */

export const CHECK_PARAMS = {
  apertureRadiusPx: 2,
  neighbourhoodRadiusPx: 6,
  annulusPx: [6, 12] as [number, number],
  detectorEdgeWarnPx: 10,
  snrDetect: 3,
  snrShape: 10,
  sizeRatioWarn: 1.6,
  elongationWarn: 1.6,
  brightStarRadiusArcsec: 120,
  brightStarG: 10,
  version: "fpl-checks-1",
} as const;

export interface NativeFrame {
  payload: FramePayload;
  image: Float32Array;
  variance: Float32Array;
  flags: Int32Array;
  /** Zodiacal-light model (MJy/sr); subtracted for display only. */
  zodi: Float32Array;
}

export interface FrameMeasurement {
  key: string;
  x: number;
  y: number;
  inside: boolean;
  wavelengthUm: number | null;
  bandwidthUm: number | null;
  photometry: PhotometryResult | null;
  /** Flag names present per pixel inside the aperture / neighbourhood (counted). */
  apertureFlags: Record<string, number>;
  neighbourhoodFlags: Record<string, number>;
  aperturePixels: number;
  unusablePixels: number;
  distanceToCutoutEdgePx: number;
  distanceToDetectorEdgePx: number;
  shape: { fwhmArcsec: number; elongation: number } | null;
  psfFwhmArcsec: number | null;
  pixelScaleArcsec: number;
  /** Raw FLAGS value at the nearest pixel, for the record. */
  centerFlagValue: number;
}

function pixelScale(p: FramePayload) {
  const [[a, b], [c, d]] = p.wcs.cd;
  return Math.sqrt(Math.abs(a * d - b * c)) * 3600;
}

export function measureAt(frame: NativeFrame, ra: number, dec: number): FrameMeasurement {
  const p = frame.payload;
  const bits = decodeBits(p.flagBits);
  const pos = skyToPixel(p.wcs, ra, dec);
  const x = pos?.x ?? NaN;
  const y = pos?.y ?? NaN;
  const inside = Number.isFinite(x) && x >= 0 && y >= 0 && x <= p.width - 1 && y <= p.height - 1;
  const wave = inside && p.wave ? wavelengthAt(p.wave, x, y) : null;
  const scale = pixelScale(p);

  const apertureFlags: Record<string, number> = {};
  const neighbourhoodFlags: Record<string, number> = {};
  let aperturePixels = 0;
  let unusable = 0;
  const unusableMask = bits.filter((b) => b.category.id === "unusable").reduce((m, b) => m | b.mask, 0) >>> 0;
  const R = CHECK_PARAMS.neighbourhoodRadiusPx;
  if (inside) {
    for (let j = Math.floor(y - R); j <= Math.ceil(y + R); j++) {
      for (let i = Math.floor(x - R); i <= Math.ceil(x + R); i++) {
        if (i < 0 || j < 0 || i >= p.width || j >= p.height) continue;
        const d = Math.hypot(i - x, j - y);
        if (d > R) continue;
        const k = j * p.width + i;
        const names = namesIn(frame.flags[k], bits);
        for (const n of names) neighbourhoodFlags[n] = (neighbourhoodFlags[n] ?? 0) + 1;
        if (d <= CHECK_PARAMS.apertureRadiusPx + 0.5) {
          aperturePixels++;
          for (const n of names) apertureFlags[n] = (apertureFlags[n] ?? 0) + 1;
          if ((frame.flags[k] >>> 0) & unusableMask || !Number.isFinite(frame.image[k])) unusable++;
        }
      }
    }
  }

  const photometry = inside
    ? aperturePhotometry({
        width: p.width,
        height: p.height,
        image: frame.image,
        variance: frame.variance,
        flags: frame.flags,
        flagBits: p.flagBits,
        x,
        y,
        omegaArcsec2: p.header.omegaMedianArcsec2 ?? scale * scale,
        params: { rAp: CHECK_PARAMS.apertureRadiusPx, rIn: CHECK_PARAMS.annulusPx[0], rOut: CHECK_PARAMS.annulusPx[1], maskSourcesInAnnulus: false },
        wave,
        dqaPassed: p.header.l2Dqa === "Pass",
      })
    : null;

  // Second moments of background-subtracted flux within 3 px (usable pixels only).
  let shape: FrameMeasurement["shape"] = null;
  if (inside && photometry && Number.isFinite(photometry.backgroundMjySr)) {
    const excl = bits.filter((b) => MEASUREMENT_EXCLUDE.includes(b.name)).reduce((m, b) => m | b.mask, 0) >>> 0;
    let sw = 0, sx = 0, sy = 0;
    const px: [number, number, number][] = [];
    for (let j = Math.floor(y - 3); j <= Math.ceil(y + 3); j++) {
      for (let i = Math.floor(x - 3); i <= Math.ceil(x + 3); i++) {
        if (i < 0 || j < 0 || i >= p.width || j >= p.height || Math.hypot(i - x, j - y) > 3) continue;
        const k = j * p.width + i;
        if ((frame.flags[k] >>> 0) & excl) continue;
        // Only pixels clearly above the noise: low-S/N noise inflates second moments.
        const w = frame.image[k] - photometry.backgroundMjySr;
        if (!(w > 2 * Math.sqrt(Math.max(0, frame.variance[k])))) continue;
        px.push([i, j, w]);
        sw += w;
        sx += w * i;
        sy += w * j;
      }
    }
    if (sw > 0 && px.length >= 4) {
      const cx = sx / sw;
      const cy = sy / sw;
      let ixx = 0, iyy = 0, ixy = 0;
      for (const [i, j, w] of px) {
        ixx += w * (i - cx) ** 2;
        iyy += w * (j - cy) ** 2;
        ixy += w * (i - cx) * (j - cy);
      }
      ixx /= sw;
      iyy /= sw;
      ixy /= sw;
      const tr = ixx + iyy;
      const disc = Math.sqrt(Math.max(0, ((ixx - iyy) / 2) ** 2 + ixy * ixy));
      const l1 = tr / 2 + disc;
      const l2 = Math.max(1e-6, tr / 2 - disc);
      // Remove the pixelisation term (1/12 px² per axis): SPHEREx pixels are close to the PSF width.
      const sigma2 = Math.max(1e-6, tr / 2 - 1 / 12);
      shape = { fwhmArcsec: 2.355 * Math.sqrt(sigma2) * scale, elongation: Math.sqrt(l1 / l2) };
    }
  }

  const [W, H] = p.fullSize;
  const dx = p.origin[0] + x;
  const dy = p.origin[1] + y;
  const nearest = inside ? frame.flags[Math.round(y) * p.width + Math.round(x)] >>> 0 : 0;
  return {
    key: p.key,
    x,
    y,
    inside,
    wavelengthUm: wave?.wavelength ?? null,
    bandwidthUm: wave?.bandwidth ?? null,
    photometry,
    apertureFlags,
    neighbourhoodFlags,
    aperturePixels,
    unusablePixels: unusable,
    distanceToCutoutEdgePx: inside ? Math.min(x, y, p.width - 1 - x, p.height - 1 - y) : -1,
    distanceToDetectorEdgePx: inside ? Math.min(dx, dy, W - 1 - dx, H - 1 - dy) : -1,
    shape,
    psfFwhmArcsec: p.header.psfFwhmArcsec,
    pixelScaleArcsec: scale,
    centerFlagValue: nearest,
  };
}

function byCategory(counts: Record<string, number>) {
  const out = new Map<string, { label: string; role: string; names: string[]; pixels: number }>();
  for (const [name, n] of Object.entries(counts)) {
    const c = FLAG_CATEGORIES.find((x) => x.names.includes(name)) ?? UNKNOWN_CATEGORY;
    const e = out.get(c.id) ?? { label: c.label, role: c.role, names: [], pixels: 0 };
    e.names.push(`${name}×${n}`);
    e.pixels = Math.max(e.pixels, n);
    out.set(c.id, e);
  }
  return out;
}

export interface CheckReport {
  primary: FrameMeasurement;
  others: { m: FrameMeasurement; sameObs: boolean; dtDays: number; detectorSame: boolean }[];
  checks: CheckItem[];
  verdict: Verdict;
}

export function runChecks(
  primaryFrame: NativeFrame,
  otherFrames: NativeFrame[],
  ra: number,
  dec: number,
  neighbours: BrightNeighbor[] | null,
): CheckReport {
  const primary = measureAt(primaryFrame, ra, dec);
  const pMjd = primaryFrame.payload.header.mjdAvg;
  const others = otherFrames.map((f) => ({
    m: measureAt(f, ra, dec),
    sameObs: f.payload.obsId === primaryFrame.payload.obsId,
    dtDays: f.payload.header.mjdAvg - pMjd,
    detectorSame: f.payload.detector === primaryFrame.payload.detector,
  }));
  const checks: CheckItem[] = [];
  const P = CHECK_PARAMS;

  // 1. Data validity
  if (!primary.inside) {
    checks.push({ id: "validity", label: "Data validity", status: "issue", summary: "The position is outside this cutout.", details: [] });
  } else {
    const frac = primary.aperturePixels ? primary.unusablePixels / primary.aperturePixels : 1;
    checks.push({
      id: "validity",
      label: "Data validity",
      status: frac >= 0.5 ? "issue" : frac > 0 ? "caution" : "ok",
      summary:
        frac === 0
          ? "All aperture pixels hold valid data."
          : `${primary.unusablePixels} of ${primary.aperturePixels} aperture pixels are unusable (missing, nonfunctional, hot or cold).`,
      details: [`Aperture radius ${P.apertureRadiusPx} px (${(P.apertureRadiusPx * primary.pixelScaleArcsec).toFixed(1)}″).`],
    });
  }

  // 2. Quality flags overlapping the candidate
  const ap = byCategory(primary.apertureFlags);
  const nb = byCategory(primary.neighbourhoodFlags);
  const warnIn = [...ap.values()].filter((c) => c.role === "warning" || c.role === "exclude");
  const warnNear = [...nb.entries()].filter(([id, c]) => (c.role === "warning" || c.role === "exclude") && !ap.has(id)).map(([, c]) => c);
  const outlierIn = ap.get("outlier");
  const details: string[] = [];
  for (const c of warnIn) details.push(`On the candidate: ${c.label} — ${c.names.join(", ")}.`);
  for (const c of warnNear) details.push(`Within ${P.neighbourhoodRadiusPx} px: ${c.label} — ${c.names.join(", ")}.`);
  if (outlierIn) details.push(`OUTLIER on ${outlierIn.pixels} aperture pixel(s): the pipeline saw this differ from the reference sky. Real moving or variable objects are flagged this way too.`);
  const info = ap.get("info");
  if (info) details.push(`Informational on the candidate: ${info.names.join(", ")} (not a defect).`);
  const unknown = ap.get("unknown");
  if (unknown) details.push(`Not interpreted by this tool: ${unknown.names.join(", ")}.`);
  checks.push({
    id: "flags",
    label: "Quality flags",
    status: warnIn.length ? "issue" : warnNear.length || outlierIn || unknown ? "caution" : "ok",
    summary: warnIn.length
      ? `${warnIn.map((c) => c.label).join(", ")} flagged on the candidate. ${warnIn.some((c) => c.label === "Persistence") ? "Check other observations for residual signal." : "The pipeline marked an effect that can mimic or distort a source."}`
      : warnNear.length
        ? `No artifact flag on the candidate, but ${warnNear.map((c) => c.label.toLowerCase()).join(", ")} nearby.`
        : outlierIn
          ? "Only OUTLIER on the candidate — look closer; this is not evidence of an artifact on its own."
          : "No artifact-related flag on or near the candidate.",
    details,
  });

  // 3. Edges
  const edgeDetails = [
    `Distance to cutout edge: ${primary.distanceToCutoutEdgePx.toFixed(1)} px (only limits the background ring).`,
    `Distance to detector edge: ${primary.distanceToDetectorEdgePx.toFixed(1)} px.`,
  ];
  checks.push({
    id: "edge",
    label: "Edges",
    status: !primary.inside
      ? "not-checked"
      : primary.distanceToDetectorEdgePx < P.detectorEdgeWarnPx
        ? "caution"
        : primary.distanceToCutoutEdgePx < P.annulusPx[1]
          ? "info"
          : "ok",
    summary:
      primary.distanceToDetectorEdgePx < P.detectorEdgeWarnPx
        ? "Close to the physical detector edge — edge pixels are less reliable."
        : primary.distanceToCutoutEdgePx < P.annulusPx[1]
          ? "Near the cutout edge; the background ring is partly cut off (not a detector problem)."
          : "Well inside the detector and the cutout.",
    details: edgeDetails,
  });

  // 4. Signal vs noise (VARIANCE)
  const measurable = primary.photometry && primary.photometry.apertureArea > 0 && Number.isFinite(primary.photometry.snr);
  const ph = measurable ? primary.photometry : null;
  checks.push({
    id: "snr",
    label: "Signal vs noise",
    status: !ph ? "not-checked" : ph.snr >= P.snrShape ? "ok" : ph.snr >= P.snrDetect ? "caution" : "info",
    summary: !ph
      ? primary.inside
        ? "Cannot measure: every aperture pixel is excluded (saturated, transient or unusable). The image itself is still shown — switch layers off to look at it."
        : "Not measured."
      : `S/N ${ph.snr.toFixed(1)} — ${ph.fluxMjy.toFixed(3)} ± ${ph.errorMjy.toFixed(3)} mJy above the local background${ph.snr < P.snrDetect ? " (not significant)" : ""}.`,
    details: ph
      ? [
          `Background ${ph.backgroundMjySr.toFixed(4)} MJy/sr from a ${P.annulusPx[0]}–${P.annulusPx[1]} px ring (3σ clipped, N=${ph.annulusPixels}).`,
          `Error = √(Σ VARIANCE + background term) on native pixels. Excluded from the sum: ${MEASUREMENT_EXCLUDE.join(", ")}.`,
          `Usable aperture fraction ${(ph.apertureCoverage * 100).toFixed(0)}%.`,
        ]
      : [],
  });

  // 5. Shape vs PSF
  const sh = primary.shape;
  const psf = primary.psfFwhmArcsec;
  if (!ph || ph.snr < P.snrShape || !sh || !psf) {
    checks.push({
      id: "shape",
      label: "Shape vs PSF",
      status: "not-checked",
      summary: !psf ? "No PSF width in the header." : `Not checked: needs S/N ≥ ${P.snrShape}.`,
      details: [],
    });
  } else {
    const ratio = sh.fwhmArcsec / psf;
    const odd = ratio > P.sizeRatioWarn || sh.elongation > P.elongationWarn;
    checks.push({
      id: "shape",
      label: "Shape vs PSF",
      status: odd ? "caution" : "ok",
      summary: odd
        ? `Size ${sh.fwhmArcsec.toFixed(1)}″ vs PSF ${psf.toFixed(1)}″, elongation ${sh.elongation.toFixed(2)} — differs from a point source. Extended or blended objects look like this too.`
        : `Consistent with a point source (size ${sh.fwhmArcsec.toFixed(1)}″ vs PSF ${psf.toFixed(1)}″, elongation ${sh.elongation.toFixed(2)}).`,
      details: [`Second moments of pixels > 2σ within 3 px; pixel ${primary.pixelScaleArcsec.toFixed(2)}″ is coarse, so this is a rough check.`],
    });
  }

  // 6. Repeatability in other, independent observations
  const independent = others.filter((o) => !o.sameObs && o.m.inside);
  const detected = independent.filter((o) => (o.m.photometry?.snr ?? 0) >= P.snrDetect);
  checks.push({
    id: "repeat",
    label: "Other observations",
    status: independent.length === 0 ? "not-checked" : detected.length > 0 ? "ok" : (ph?.snr ?? 0) >= P.snrDetect ? "caution" : "info",
    summary:
      independent.length === 0
        ? "Not checked: load at least one other observation of this position."
        : `Signal at this exact position in ${detected.length} of ${independent.length} other observation(s).`,
    details: [
      ...independent.map(
        (o) =>
          `${o.m.key} (${o.dtDays >= 0 ? "+" : ""}${o.dtDays.toFixed(1)} d, ${o.m.wavelengthUm?.toFixed(3) ?? "?"} µm): S/N ${o.m.photometry?.snr.toFixed(1) ?? "—"}.`,
      ),
      "A dot seen once is not automatically an artifact: a moving object will not stay at the same position.",
    ],
  });

  // 7. Comparison conditions (wavelength / detector / time)
  if (independent.length === 0 || primary.wavelengthUm == null) {
    checks.push({ id: "conditions", label: "Comparison conditions", status: "not-checked", summary: "No comparison loaded.", details: [] });
  } else {
    const rows = independent.map((o) => {
      const dl = o.m.wavelengthUm != null ? Math.abs(o.m.wavelengthUm - primary.wavelengthUm!) : Infinity;
      const tol = Math.max(o.m.bandwidthUm ?? 0, primary.bandwidthUm ?? 0);
      return { o, dl, tol, ok: o.detectorSame && dl <= tol };
    });
    const bad = rows.filter((r) => !r.ok);
    checks.push({
      id: "conditions",
      label: "Comparison conditions",
      status: bad.length ? "caution" : "ok",
      summary: bad.length
        ? `${bad.length} comparison(s) use a different detector or a wavelength outside the bandwidth — appearance may differ for that reason alone.`
        : "Comparisons use the same detector and a wavelength within the bandwidth.",
      details: rows.map(
        (r) =>
          `${r.o.m.key}: ${r.o.detectorSame ? "same detector" : "different detector"}, Δλ ${Number.isFinite(r.dl) ? r.dl.toFixed(3) : "?"} µm (tolerance ${r.tol.toFixed(3)}), Δt ${Math.abs(r.o.dtDays).toFixed(1)} d.`,
      ),
    });
  }

  // 8. Known / bright sources nearby
  const sourceOnCandidate = (primary.apertureFlags["SOURCE"] ?? 0) > 0;
  const bright = neighbours?.filter((s) => s.gmag < P.brightStarG) ?? null;
  checks.push({
    id: "neighbours",
    label: "Known sources nearby",
    status: bright == null ? (sourceOnCandidate ? "info" : "not-checked") : bright.length ? "caution" : "ok",
    summary:
      bright == null
        ? `${sourceOnCandidate ? "SOURCE flag: the candidate pixels map to a known catalog source. " : ""}Bright-star check not run yet.`
        : bright.length
          ? `${bright.length} bright star(s) (G < ${P.brightStarG}) within ${P.brightStarRadiusArcsec}″ — possible cause of ghosts, bloom or saturation.`
          : `No star brighter than G ${P.brightStarG} within ${P.brightStarRadiusArcsec}″.${sourceOnCandidate ? " The candidate pixels map to a known catalog source (SOURCE)." : ""}`,
    details: [
      ...(neighbours ?? []).slice(0, 8).map((s) => `Gaia DR3 ${s.sourceId}: G ${s.gmag.toFixed(1)} at ${s.separationArcsec.toFixed(0)}″.`),
      ...(neighbours ? ["Gaia positions moved from 2016.0 to the observation date with proper motion (parallax ignored)."] : []),
    ],
  });

  const verdict: Verdict = checks.some((c) => c.status === "issue")
    ? "quality-issue"
    : checks.some((c) => c.status === "caution" || (c.status === "not-checked" && ["repeat", "neighbours"].includes(c.id)))
      ? "needs-review"
      : "no-issue-found";

  return { primary, others, checks, verdict };
}

export const VERDICT_TEXT: Record<Verdict, string> = {
  "quality-issue": "Quality issue found",
  "needs-review": "Needs further review",
  "no-issue-found": "No issue found in current checks",
};

export { decodeBits, type DecodedBit };
