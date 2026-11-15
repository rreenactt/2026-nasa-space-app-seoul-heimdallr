"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/ky";
import type { MessageKey } from "@/app/_i18n/message-keys";
import { skyToPixel, wavelengthAt } from "@/app/_lib/comet/wcs";
import type { BlinkPlan, PlannedExposure, PlannedVisit } from "@/app/_lib/blink/types";
import type { BrightNeighbor } from "@/app/_lib/fpl/types";
import type { NativeFrame } from "@/app/_lib/fpl/checks";
import { decodeBits } from "@/app/_lib/fpl/flags";
import { medianStack, reproject } from "@/app/_lib/sky/reproject";
import type { SkyGrid } from "@/app/_lib/sky/types";
import { toNative, useFrames } from "../fake-planet-lab/use-fpl-data";
import type { SkySelection } from "../sky/sky-selection";

/** Default field (PLAN.md ch. 4: 3′ × 3′, team value still open). */
export const BLINK_FOV_ARCMIN = 3;
export const BLINK_GRID_N = 96;
/** Native cutout: covers the 3′ grid at any rotation (6.15″ pixels). */
const CUTOUT_PX = 48;
/** Pixels never used: unusable, or single-exposure hits (cosmic rays). OUTLIER is kept — moving objects get it. */
const MASKED = ["NONFUNC", "MISSING_DATA", "HOT", "COLD", "SUR_ERROR", "TRANSIENT", "SNOWBALL"];

/** Text to translate at render: a key and its placeholder values. */
export interface KeyText {
  key: MessageKey;
  values?: Record<string, string | number>;
}

export interface FrameResult {
  exposure: PlannedExposure;
  visit: number;
  frame: NativeFrame | null;
  error: string | null;
  loading: boolean;
  /** Wavelength at the target read from the file (verifies the estimate). */
  wavelengthUm: number | null;
  bandwidthUm: number | null;
  /** Reason the loaded frame is dropped after verification. */
  dropped: KeyText | null;
  flagsAtTarget: string[];
  grid: Float32Array | null;
}

export interface VisitFrame {
  visit: PlannedVisit;
  frames: FrameResult[];
  data: Float32Array | null;
  mid: number | null; // MJD
}

interface BlinkState {
  selection: SkySelection;
  grid: SkyGrid;
  detector: string | undefined;
  setDetector: (d: string) => void;
  plan: ReturnType<typeof usePlan>;
  frames: FrameResult[];
  visits: VisitFrame[];
  /** Visits with a usable frame, in time order. */
  usable: VisitFrame[];
  loadingFrames: boolean;
  /** Gaia DR3 stars (G < 16) moved to each visit's date, by visit index. */
  gaia: Map<number, BrightNeighbor[]>;
  /** Blocking downloads only: plan and images. Gaia loads independently. */
  progress: { done: number; total: number; step: KeyText };
  ready: boolean;
}

function usePlan(ra: number, dec: number, detector: string | undefined) {
  return useQuery({
    queryKey: ["blink", "plan", ra.toFixed(5), dec.toFixed(5), detector ?? "auto"],
    queryFn: () => api.get("/api/blink/plan", { searchParams: { ra, dec, ...(detector ? { detector } : {}) }, timeout: 65_000 }).json<BlinkPlan>(),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: false,
  });
}

const Ctx = createContext<BlinkState | null>(null);

export function BlinkProvider({ selection, children }: { selection: SkySelection; children: React.ReactNode }) {
  const { ra, dec } = selection;
  // A test target may name its own first detector (the plan falls back to its default if that detector has no data).
  const [detectorChoice, setDetector] = useState<string | undefined>(selection.target?.defaultDetector?.detector);
  const plan = usePlan(ra, dec, detectorChoice);
  const grid = useMemo<SkyGrid>(() => ({ ra, dec, fovArcmin: BLINK_FOV_ARCMIN, n: BLINK_GRID_N }), [ra, dec]);

  const used = useMemo(
    () => (plan.data?.visits ?? []).flatMap((v) => v.exposures.filter((e) => !e.excluded).map((e) => ({ e, visit: v.index }))),
    [plan.data],
  );
  const queries = useFrames(
    used.map((u) => ({ key: u.e.key, obsId: u.e.obsId, detector: u.e.detector, tStart: u.e.tStart, tEnd: u.e.tEnd, emMinUm: 0, emMaxUm: 0, fileUrl: u.e.fileUrl, collection: "spherex_dr1" })),
    ra,
    dec,
    CUTOUT_PX,
  );
  const payloadKey = queries.map((q) => (q.data ? q.data.key : q.isError ? "x" : "_")).join("|");

  const frames = useMemo<FrameResult[]>(() => {
    const ref = plan.data?.referenceWavelengthUm ?? null;
    const tol = plan.data?.toleranceUm ?? null;
    return used.map((u, i) => {
      const q = queries[i];
      const frame = q?.data ? toNative(q.data) : null;
      if (!frame) return { exposure: u.e, visit: u.visit, frame: null, error: q?.error?.message ?? null, loading: Boolean(q?.isPending), wavelengthUm: null, bandwidthUm: null, dropped: null, flagsAtTarget: [], grid: null };
      const p = skyToPixel(frame.payload.wcs, ra, dec);
      const w = p && frame.payload.wave ? wavelengthAt(frame.payload.wave, p.x, p.y) : null;
      const dropped: KeyText | null =
        !w
          ? { key: "blink.droppedOutside" }
          : ref != null && tol != null && Math.abs(w.wavelength - ref) > tol
            ? { key: "blink.droppedWavelength", values: { measured: w.wavelength.toFixed(3), ref: ref.toFixed(3), tol: tol.toFixed(3) } }
            : null;
      const bits = decodeBits(frame.payload.flagBits);
      const mask = bits.filter((b) => MASKED.includes(b.name)).reduce((m, b) => m | b.mask, 0) >>> 0;
      const at = p ? frame.flags[Math.round(p.y) * frame.payload.width + Math.round(p.x)] >>> 0 : 0;
      const src = new Float32Array(frame.image.length);
      for (let k = 0; k < src.length; k++) src[k] = (frame.flags[k] >>> 0) & mask ? NaN : frame.image[k] - frame.zodi[k];
      const g = dropped ? null : reproject({ width: frame.payload.width, height: frame.payload.height, data: src, wcs: { projection: "TAN", ...frame.payload.wcs, a: {}, b: {} } }, grid);
      return {
        exposure: u.e,
        visit: u.visit,
        frame,
        error: null,
        loading: false,
        wavelengthUm: w?.wavelength ?? null,
        bandwidthUm: w?.bandwidth ?? null,
        dropped,
        flagsAtTarget: bits.filter((b) => (at & b.mask) !== 0).map((b) => b.name),
        grid: g,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recompute when the set of loaded payloads changes
  }, [payloadKey, plan.data, grid]);

  const visits = useMemo<VisitFrame[]>(
    () =>
      (plan.data?.visits ?? []).map((v) => {
        const fs = frames.filter((f) => f.visit === v.index);
        const ok = fs.filter((f) => f.grid);
        const mids = ok.map((f) => (f.exposure.tStart + f.exposure.tEnd) / 2);
        return { visit: v, frames: fs, data: ok.length ? medianStack(ok.map((f) => f.grid!)) : null, mid: mids.length ? mids.reduce((a, b) => a + b, 0) / mids.length : null };
      }),
    [plan.data, frames],
  );

  // Gaia per visit, at the mean time of the frames planned for that visit (known before the images arrive).
  const visitTimes = useMemo(
    () =>
      (plan.data?.visits ?? [])
        .map((v) => {
          const used = v.exposures.filter((e) => !e.excluded);
          return used.length ? { index: v.index, mjd: used.reduce((s, e) => s + (e.tStart + e.tEnd) / 2, 0) / used.length } : null;
        })
        .filter((v): v is { index: number; mjd: number } => v !== null),
    [plan.data],
  );
  const gaiaQs = useQueries({
    queries: visitTimes.map((v) => ({
      queryKey: ["blink", "gaia", ra.toFixed(5), dec.toFixed(5), v.mjd.toFixed(1)],
      queryFn: () =>
        api
          .get("/api/fpl/neighbors", { searchParams: { ra, dec, radius: 130, maxG: 16, epoch: 2000 + (v.mjd - 51544.5) / 365.25 }, timeout: 65_000 })
          .json<{ stars: BrightNeighbor[] }>(),
      staleTime: Infinity,
      gcTime: 30 * 60_000,
      retry: false,
    })),
  });
  const gaiaKey = gaiaQs.map((q) => (q.isPending ? "_" : "x")).join("");
  const gaia = useMemo(
    () => new Map(visitTimes.map((v, i) => [v.index, gaiaQs[i]?.data?.stars ?? []])),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuild when a Gaia answer arrives
    [visitTimes, gaiaKey],
  );

  const planSettled = !plan.isPending;
  const framesDone = frames.filter((f) => !f.loading).length;
  const total = 1 + frames.length;
  const done = (planSettled ? 1 : 0) + framesDone;
  const step: KeyText = !planSettled
    ? { key: "blink.stepPlan" }
    : framesDone < frames.length
      ? { key: "blink.stepImages", values: { done: framesDone, total: frames.length } }
      : { key: "blink.stepDone" };
  // Gaia overlays arrive independently; a slow or failed catalog query must not hide ready images.
  const ready = planSettled && (plan.isError || plan.data?.status === "no-observations" || framesDone === frames.length);

  const value: BlinkState = {
    selection,
    grid,
    detector: plan.data?.detector ?? detectorChoice,
    setDetector,
    plan,
    frames,
    visits,
    usable: visits.filter((v) => v.data),
    loadingFrames: frames.some((f) => f.loading),
    gaia,
    progress: { done, total, step },
    ready,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBlink() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBlink must be used inside BlinkProvider");
  return v;
}

const MJD_EPOCH_MS = Date.UTC(1858, 10, 17);
export const mjdDate = (mjd: number) => new Date(MJD_EPOCH_MS + mjd * 86_400_000).toISOString().slice(0, 10);
export const mjdMonth = (mjd: number) => mjdDate(mjd).slice(0, 7);
