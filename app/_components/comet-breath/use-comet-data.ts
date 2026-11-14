"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/ky";
import { aperturePhotometry } from "@/app/_lib/comet/photometry";
import { skyToPixel, wavelengthAt } from "@/app/_lib/comet/wcs";
import type {
  ApertureParams,
  FramePayload,
  GeometryResult,
  ObservationEntry,
  ObservationIndex,
  PhotometryResult,
} from "@/app/_lib/comet/types";

/** Cutout size in pixels (≈ 7′ at ~6.15″/px) — large enough for the paper's 1′–3′ background annulus. */
export const CUTOUT_SIZE = 72;

/** Data is kept only in memory for the open session (no persistence). */
const SESSION_MEMORY = { staleTime: Infinity, gcTime: 30 * 60_000 } as const;

/**
 * GET with a timeout matched to the route's `maxDuration` (+5 s). ky's default 10 s is shorter than
 * reading one frame from the archive, which takes 5–20 s depending on network distance to S3.
 */
function getJson<T>(url: string, searchParams: Record<string, string | number> | undefined, timeoutMs: number): Promise<T> {
  return api.get(url, { searchParams, timeout: timeoutMs }).json<T>();
}

export const observationsQuery = () => ({
  queryKey: ["comet", "observations"] as const,
  queryFn: () => getJson<ObservationIndex>("/api/comet/observations", undefined, 35_000),
  ...SESSION_MEMORY,
});

export function useObservationIndex() {
  return useQuery(observationsQuery());
}

export const SESSION_CACHE = SESSION_MEMORY;

export interface FrameCenter {
  ra: number;
  dec: number;
}

export function frameQueryKey(entry: ObservationEntry, center: FrameCenter) {
  return ["comet", "frame", entry.key, center.ra.toFixed(5), center.dec.toFixed(5), CUTOUT_SIZE] as const;
}

export function fetchFrame(entry: ObservationEntry, center: FrameCenter) {
  return getJson<FramePayload>(
    "/api/comet/frame",
    { obsId: entry.obsId, detector: entry.detector, ra: center.ra, dec: center.dec, size: CUTOUT_SIZE },
    65_000,
  );
}

export function useFrame(entry: ObservationEntry | undefined, center: FrameCenter | undefined) {
  return useQuery({
    queryKey: entry && center ? frameQueryKey(entry, center) : ["comet", "frame", "none"],
    queryFn: () => fetchFrame(entry!, center!),
    enabled: Boolean(entry && center),
    ...SESSION_MEMORY,
  });
}

export function useGeometry(mjd: number | undefined) {
  return useQuery({
    queryKey: ["comet", "geometry", mjd?.toFixed(4)],
    queryFn: () => getJson<GeometryResult>("/api/comet/geometry", { mjd: mjd! }, 35_000),
    enabled: mjd !== undefined,
    ...SESSION_MEMORY,
  });
}

function decode<T extends Float32Array | Int32Array>(b64: string, Ctor: new (buffer: ArrayBuffer) => T): T {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Ctor(bytes.buffer);
}

export interface DecodedFrame {
  payload: FramePayload;
  image: Float32Array;
  variance: Float32Array;
  zodi: Float32Array;
  flags: Int32Array;
}

const decodedCache = new WeakMap<FramePayload, DecodedFrame>();

export function decodeFrame(payload: FramePayload): DecodedFrame {
  const hit = decodedCache.get(payload);
  if (hit) return hit;
  const decoded: DecodedFrame = {
    payload,
    image: decode(payload.image, Float32Array),
    variance: decode(payload.variance, Float32Array),
    zodi: decode(payload.zodi, Float32Array),
    flags: decode(payload.flags, Int32Array),
  };
  decodedCache.set(payload, decoded);
  return decoded;
}

/** Comet pixel in this frame, from the list's predicted comet coordinates for that exposure. */
export function cometPixel(frame: FramePayload, entry: ObservationEntry) {
  return skyToPixel(frame.wcs, entry.cometRa, entry.cometDec);
}

export function measure(frame: DecodedFrame, entry: ObservationEntry, params: ApertureParams): PhotometryResult | null {
  const p = cometPixel(frame.payload, entry);
  if (!p) return null;
  const wave = frame.payload.wave ? wavelengthAt(frame.payload.wave, p.x, p.y) : null;
  return aperturePhotometry({
    width: frame.payload.width,
    height: frame.payload.height,
    image: frame.image,
    variance: frame.variance,
    flags: frame.flags,
    flagBits: frame.payload.flagBits,
    x: p.x,
    y: p.y,
    omegaArcsec2: frame.payload.header.omegaMedianArcsec2 ?? 37.8,
    params,
    wave,
    dqaPassed: frame.payload.header.l2Dqa === "Pass",
  });
}

export type BatchItem =
  | { entry: ObservationEntry; state: "pending" | "loading" }
  | { entry: ObservationEntry; state: "done"; frame: FramePayload }
  | { entry: ObservationEntry; state: "error"; message: string };

/**
 * Fetches many cutouts with a small concurrency limit (polite to IRSA), filling the shared query cache
 * so the image tab reuses them. Results live in memory only.
 */
export function useFrameBatch(concurrency = 8) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<BatchItem[]>([]);
  const [running, setRunning] = useState(false);
  const runId = useRef(0);

  const cancel = useCallback(() => {
    runId.current++;
    setRunning(false);
    setItems((prev) => prev.map((it) => (it.state === "loading" || it.state === "pending" ? { entry: it.entry, state: "error", message: "취소됨" } : it)));
  }, []);

  const run = useCallback(
    async (entries: ObservationEntry[]) => {
      const id = ++runId.current;
      setRunning(true);
      setItems(entries.map((entry) => ({ entry, state: "pending" })));
      let next = 0;
      const update = (i: number, item: BatchItem) =>
        setItems((prev) => (runId.current === id ? prev.map((p, k) => (k === i ? item : p)) : prev));
      const worker = async () => {
        while (runId.current === id && next < entries.length) {
          const i = next++;
          const entry = entries[i];
          const center = { ra: entry.cometRa, dec: entry.cometDec };
          update(i, { entry, state: "loading" });
          try {
            const frame = await queryClient.fetchQuery({
              queryKey: frameQueryKey(entry, center),
              queryFn: () => fetchFrame(entry, center),
              ...SESSION_MEMORY,
            });
            update(i, { entry, state: "done", frame });
          } catch (e) {
            update(i, { entry, state: "error", message: e instanceof Error ? e.message : "실패" });
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(concurrency, entries.length) }, worker));
      if (runId.current === id) setRunning(false);
    },
    [concurrency, queryClient],
  );

  useEffect(() => () => void runId.current++, []);

  return { items, running, run, cancel };
}
