"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/ky";
import type { FramePayload } from "@/app/_lib/comet/types";
import type { NativeFrame } from "@/app/_lib/fpl/checks";
import type { BrightNeighbor, FplExposure, FplSearchResult } from "@/app/_lib/fpl/types";

/** In memory for this page session only. */
const SESSION = { staleTime: Infinity, gcTime: 30 * 60_000 } as const;
export const CUTOUT_PX = 64;

export function useSpherexSearch(ra: number, dec: number) {
  return useQuery({
    queryKey: ["fpl", "search", ra.toFixed(5), dec.toFixed(5)],
    queryFn: () => api.get("/api/fpl/search", { searchParams: { ra, dec }, timeout: 65_000 }).json<FplSearchResult>(),
    ...SESSION,
  });
}

export function useFrames(exposures: FplExposure[], ra: number, dec: number) {
  return useQueries({
    queries: exposures.map((e) => ({
      queryKey: ["fpl", "frame", e.key, ra.toFixed(5), dec.toFixed(5), CUTOUT_PX],
      queryFn: () =>
        api
          .get("/api/fpl/frame", { searchParams: { obsId: e.obsId, detector: e.detector, ra, dec, size: CUTOUT_PX }, timeout: 65_000 })
          .json<FramePayload>(),
      retry: false,
      ...SESSION,
    })),
  });
}

export function useNeighbours(candidate: { ra: number; dec: number } | null, epochYear: number, enabled: boolean) {
  return useQuery({
    queryKey: ["fpl", "neighbours", candidate?.ra.toFixed(5), candidate?.dec.toFixed(5), epochYear.toFixed(2)],
    queryFn: () =>
      api
        .get("/api/fpl/neighbors", { searchParams: { ra: candidate!.ra, dec: candidate!.dec, radius: 120, maxG: 12, epoch: epochYear }, timeout: 65_000 })
        .json<{ stars: BrightNeighbor[]; query: string; service: string; epochYear: number }>(),
    enabled: enabled && candidate !== null,
    ...SESSION,
  });
}

function b64<T extends Float32Array | Int32Array>(s: string, C: new (b: ArrayBuffer) => T): T {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new C(bytes.buffer);
}

const cache = new WeakMap<FramePayload, NativeFrame>();
export function toNative(p: FramePayload): NativeFrame {
  let f = cache.get(p);
  if (!f) {
    f = { payload: p, image: b64(p.image, Float32Array), variance: b64(p.variance, Float32Array), flags: b64(p.flags, Int32Array), zodi: b64(p.zodi, Float32Array) };
    cache.set(p, f);
  }
  return f;
}

/** One display range for every shown visit (PLAN 4: same stretch for all visits of a position), on IMAGE − ZODI. */
export function sharedDisplayRange(frames: NativeFrame[]): { lo: number; hi: number } {
  const v: number[] = [];
  for (const f of frames) for (let k = 0; k < f.image.length; k++) {
    const x = f.image[k] - f.zodi[k];
    if (Number.isFinite(x)) v.push(x);
  }
  if (!v.length) return { lo: 0, hi: 1 };
  v.sort((a, b) => a - b);
  const lo = v[Math.floor(v.length * 0.01)];
  const hi = v[Math.floor(v.length * 0.995)];
  return { lo, hi: hi > lo ? hi : lo + 1 };
}
