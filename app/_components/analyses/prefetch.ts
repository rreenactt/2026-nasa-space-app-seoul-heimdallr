"use client";

import type { QueryClient } from "@tanstack/react-query";
import type { MessageKey } from "@/app/_i18n/message-keys";
import { MISSION_ORDER, MISSIONS } from "@/app/_lib/sky/missions";
import type { Epoch, SkyGrid } from "@/app/_lib/sky/types";
import { buildModel, mjdToDecimalYear, skyAt } from "@/app/_lib/nim/motion";
import { fetchFrame as fetchCometFrame, frameQueryKey as cometFrameKey, observationsQuery, SESSION_CACHE } from "../comet-breath/use-comet-data";
import { defaultFplSelection, visitsOf } from "../fake-planet-lab/fpl-state";
import { spherexFrameQuery, spherexSearchQuery } from "../fake-planet-lab/use-fpl-data";
import { catalogQuery, nearestObject } from "../neighborhood/nim-state";
import { GRID_N as STM_GRID_N } from "../sky-time-machine/stm-state";
import { fetchEpochFrame, frameKey as stmFrameKey, searchQuery as stmSearchQuery, SKY_SESSION } from "../sky-time-machine/use-sky-data";

/** Requests in flight per analysis (browsers open about six per host on HTTP/1.1; HTTP/2 takes all). */
const PARALLEL = 8;

export type AnalysisId = "sky-time-machine" | "fake-planet-lab" | "neighborhood-in-motion" | "sky-sonata" | "comet-breath";

export interface Progress {
  done: number;
  total: number;
  /** What is downloading now, shown beside the counts. */
  step: MessageKey;
  failed: number;
}

export interface PrefetchContext {
  qc: QueryClient;
  ra: number;
  dec: number;
  stmFovArcmin: number;
  onProgress: (p: Progress) => void;
  signal: { cancelled: boolean };
}

/**
 * Runs tasks with a concurrency limit and reports each finished task. SPHEREx and WISE are read from S3 (no limit
 * measured up to 80 at once); the server queues the few IBE requests (2MASS) itself.
 */
async function runTasks(tasks: (() => Promise<unknown>)[], limit: number, tick: (ok: boolean) => void, signal: { cancelled: boolean }) {
  let next = 0;
  const worker = async () => {
    while (!signal.cancelled && next < tasks.length) {
      const t = tasks[next++];
      try {
        await t();
        tick(true);
      } catch {
        tick(false);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
}

/**
 * Downloads what one analysis shows when it opens, into the same caches its dialog reads, so it opens without
 * loading. Totals grow once the list of files is known (search first, then files).
 */
export async function prefetchAnalysis(id: AnalysisId, ctx: PrefetchContext) {
  const { qc, ra, dec, onProgress, signal } = ctx;
  let done = 0;
  let failed = 0;
  let total = 1;
  let step: MessageKey = "analyses.stepSearching";
  const report = () => onProgress({ done, total, step, failed });
  const tick = (ok: boolean) => {
    done++;
    if (!ok) failed++;
    report();
  };
  report();

  if (id === "sky-time-machine") {
    const grid: SkyGrid = { ra, dec, fovArcmin: ctx.stmFovArcmin, n: STM_GRID_N };
    total = MISSION_ORDER.length;
    step = "analyses.stepStmSearch";
    report();
    const results = await Promise.all(
      MISSION_ORDER.map((m) =>
        qc.fetchQuery(stmSearchQuery(m, grid)).then(
          (r) => (tick(true), r),
          () => (tick(false), null),
        ),
      ),
    );
    const epochs: Epoch[] = [];
    MISSION_ORDER.forEach((m, i) => {
      for (const e of results[i]?.epochs ?? []) if (e.band === MISSIONS[m].defaultBand) epochs.push(e);
    });
    total += epochs.length;
    step = "analyses.stepStmRead";
    report();
    await runTasks(
      epochs.map((e) => () => qc.fetchQuery({ queryKey: stmFrameKey(e.id, grid), queryFn: () => fetchEpochFrame(e, grid), retry: false, ...SKY_SESSION })),
      PARALLEL,
      tick,
      signal,
    );
    return;
  }

  if (id === "fake-planet-lab" || id === "sky-sonata") {
    step = "analyses.stepSpherexSearch";
    const search = await qc.fetchQuery(spherexSearchQuery(ra, dec));
    tick(true);
    const ex = search.exposures;
    let picks = defaultFplSelection(ex).picks;
    if (id === "sky-sonata") {
      const dets = [...new Set(ex.map((e) => e.detector))].sort();
      const det = dets.includes("D3") ? "D3" : dets[0];
      const visits = visitsOf(ex.filter((e) => e.detector === det));
      const last = visits[visits.length - 1];
      picks = [visits[0]?.[Math.floor(visits[0].length / 2)], visits.length > 1 ? last[Math.floor(last.length / 2)] : undefined].filter((e): e is NonNullable<typeof e> => Boolean(e));
    }
    total += picks.length;
    step = "analyses.stepSpherexRead";
    report();
    await runTasks(picks.map((e) => () => qc.fetchQuery(spherexFrameQuery(e, ra, dec))), PARALLEL, tick, signal);
    return;
  }

  if (id === "neighborhood-in-motion") {
    step = "analyses.stepGaia";
    total = 3;
    const cat = await qc.fetchQuery(catalogQuery());
    tick(true);
    const models = new Map(cat.objects.map((o) => [o.id, buildModel(o, 0)]));
    const near = nearestObject(cat.objects, models, { ra, dec });
    const obj = near && near.sepDeg <= 0.1 ? near.o : cat.objects.find((o) => o.id === "gaia:4472832130942575872");
    const m = obj ? models.get(obj.id) : undefined;
    if (!m) {
      done = total;
      report();
      return;
    }
    step = "analyses.stepModelSearch";
    report();
    const p = skyAt(m, 2025.8);
    const search = await qc.fetchQuery(spherexSearchQuery(p.ra, p.dec));
    tick(true);
    const dets = [...new Set(search.exposures.map((e) => e.detector))].sort();
    const det = dets.includes("D6") ? "D6" : dets[0];
    const visits = visitsOf(search.exposures.filter((e) => e.detector === det));
    const e = visits[0]?.[Math.floor(visits[0].length / 2)];
    step = "analyses.stepSpherexReadOne";
    report();
    if (e) {
      const at = skyAt(m, mjdToDecimalYear((e.tStart + e.tEnd) / 2));
      await qc.fetchQuery(spherexFrameQuery(e, at.ra, at.dec)).then(() => tick(true), () => tick(false));
    } else tick(true);
    return;
  }

  if (id === "comet-breath") {
    step = "analyses.stepCometList";
    total = 2;
    const idx = await qc.fetchQuery(observationsQuery());
    tick(true);
    const first = idx.entries.filter((e) => e.period === "2025-08" && e.detector === "D3")[0];
    step = "analyses.stepCometFirst";
    report();
    if (first) {
      const center = { ra: first.cometRa, dec: first.cometDec };
      await qc.fetchQuery({ queryKey: cometFrameKey(first, center), queryFn: () => fetchCometFrame(first, center), ...SESSION_CACHE }).then(() => tick(true), () => tick(false));
    } else tick(true);
  }
}
