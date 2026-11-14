"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/ky";
import type { Epoch, EpochFrame, GaiaStar, MissionId, MissionSearchResult, SkyGrid } from "@/app/_lib/sky/types";

/** Everything lives in memory for this page session only. */
const SESSION = { staleTime: Infinity, gcTime: 30 * 60_000 } as const;

/** One mission's search; frames overlapping the field (radius = half the field diagonal). */
export function searchQuery(mission: MissionId, grid: SkyGrid) {
  const radius = Math.min(0.2, ((grid.fovArcmin / 60) * Math.SQRT2) / 2);
  return {
    queryKey: ["sky", "search", mission, grid.ra.toFixed(5), grid.dec.toFixed(5), radius.toFixed(4)] as const,
    queryFn: () =>
      api.get("/api/sky/search", { searchParams: { mission, ra: grid.ra, dec: grid.dec, radius }, timeout: 65_000 }).json<MissionSearchResult>(),
    ...SESSION,
  };
}

export const SKY_SESSION = SESSION;

export function useMissionSearches(missions: MissionId[], grid: SkyGrid | null) {
  return useQueries({
    queries: missions.map((mission) => (grid ? searchQuery(mission, grid) : { queryKey: ["sky", "search", mission, "none"], queryFn: () => null, enabled: false })),
  });
}

export function frameKey(epochId: string, grid: SkyGrid) {
  return ["sky", "frame", epochId, grid.ra.toFixed(5), grid.dec.toFixed(5), grid.fovArcmin, grid.n] as const;
}

export function fetchEpochFrame(epoch: Epoch, grid: SkyGrid) {
  return api.post("/api/sky/frame", { json: { epoch, grid }, timeout: 65_000 }).json<EpochFrame>();
}

export function useEpochFrame(epoch: Epoch | undefined, grid: SkyGrid | null) {
  return useQuery({
    queryKey: epoch && grid ? frameKey(epoch.id, grid) : ["sky", "frame", "none"],
    queryFn: () => fetchEpochFrame(epoch!, grid!),
    enabled: Boolean(epoch && grid),
    retry: false,
    ...SESSION,
  });
}

/** Which epochs already have a frame in memory (observes the cache without fetching). */
export function useLoadedFrames(epochs: Epoch[], grid: SkyGrid) {
  const results = useQueries({
    queries: epochs.map((e) => ({
      queryKey: frameKey(e.id, grid),
      queryFn: () => fetchEpochFrame(e, grid),
      enabled: false,
      ...SESSION,
    })),
  });
  return new Map(epochs.map((e, i) => [e.id, results[i]?.data]));
}

/** Prefetches the given epochs eight at a time (the server reads WISE from S3 and queues IBE itself). */
export function usePrefetchFrames(grid: SkyGrid | null) {
  const qc = useQueryClient();
  const [state, setState] = useState({ total: 0, done: 0, running: false });
  const run = useRef(0);
  const start = useCallback(
    async (epochs: Epoch[]) => {
      if (!grid) return;
      const id = ++run.current;
      setState({ total: epochs.length, done: 0, running: true });
      let next = 0;
      const worker = async () => {
        while (run.current === id && next < epochs.length) {
          const e = epochs[next++];
          await qc.prefetchQuery({ queryKey: frameKey(e.id, grid), queryFn: () => fetchEpochFrame(e, grid), retry: false, ...SESSION });
          if (run.current === id) setState((s) => ({ ...s, done: s.done + 1 }));
        }
      };
      await Promise.all(Array.from({ length: 8 }, worker));
      if (run.current === id) setState((s) => ({ ...s, running: false }));
    },
    [grid, qc],
  );
  const stop = useCallback(() => {
    run.current++;
    setState((s) => ({ ...s, running: false }));
  }, []);
  useEffect(() => () => void run.current++, []);
  return { ...state, start, stop };
}

export function useGaia(grid: SkyGrid | null, enabled: boolean) {
  return useQuery({
    queryKey: ["sky", "gaia", grid?.ra.toFixed(5), grid?.dec.toFixed(5), grid?.fovArcmin],
    queryFn: () =>
      api
        .get("/api/sky/gaia", {
          searchParams: { ra: grid!.ra, dec: grid!.dec, radius: ((grid!.fovArcmin / 60) * Math.SQRT2) / 2, minPm: 50 },
          timeout: 65_000,
        })
        .json<{ stars: GaiaStar[]; query: string }>(),
    enabled: enabled && grid !== null,
    ...SESSION,
  });
}

const decoded = new WeakMap<EpochFrame, Float32Array>();
export function frameData(frame: EpochFrame): Float32Array {
  let d = decoded.get(frame);
  if (!d) {
    const bin = atob(frame.data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    d = new Float32Array(bytes.buffer);
    decoded.set(frame, d);
  }
  return d;
}
