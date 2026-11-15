"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { SoundSettings } from "@/app/_lib/sonata/mapping";
import type { SkySelection } from "../sky/sky-selection";
import { prefetchAnalysis, type AnalysisId, type Progress } from "./prefetch";

/** Opens one analysis right away (older `?stm=` / `?sonata=` links): it is downloaded first, then shown. */
export type AutoOpenAnalysis =
  | { analysis: "sky-time-machine"; fovArcmin: number }
  | { analysis: "sky-sonata"; settings: Partial<SoundSettings> };

export type JobState =
  | { status: "idle" }
  | { status: "running"; progress: Progress; startedAt: number }
  | { status: "done"; progress: Progress; seconds: number }
  | { status: "error"; message: string };

/** What the left side of the panel shows: the blink viewer or one opened analysis. */
export type PanelView = "blink" | AnalysisId;

type AnalysesValue = {
  selection: SkySelection;
  autoOpen?: AutoOpenAnalysis;
  stmFov: number;
  jobs: Record<AnalysisId, JobState>;
  /** Downloads an analysis and shows it when ready. Shown right away if it is already downloaded. */
  run: (id: AnalysisId) => void;
  cancel: (id: AnalysisId) => void;
  /** Analyses opened as tabs beside the blink viewer, in the order they were opened. */
  opened: AnalysisId[];
  view: PanelView;
  setView: (view: PanelView) => void;
  close: (id: AnalysisId) => void;
};

const AnalysesContext = createContext<AnalysesValue | null>(null);

const IDLE: Record<AnalysisId, JobState> = {
  "sky-time-machine": { status: "idle" },
  "fake-planet-lab": { status: "idle" },
  "neighborhood-in-motion": { status: "idle" },
  "sky-sonata": { status: "idle" },
  "comet-breath": { status: "idle" },
};

/**
 * Additional analyses of one panel point (PLAN.md chapter 5): each downloads on its own (several at once), then opens
 * as a tab on the left in place of the blink viewer, so the summary and rating stay beside it.
 */
export function AnalysesProvider({
  selection,
  autoOpen,
  children,
}: {
  selection: SkySelection;
  autoOpen?: AutoOpenAnalysis;
  children: React.ReactNode;
}) {
  const qc = useQueryClient();
  const { ra, dec } = selection;
  const stmFov = autoOpen?.analysis === "sky-time-machine" ? autoOpen.fovArcmin : 8;

  const [jobs, setJobs] = useState(IDLE);
  const [opened, setOpened] = useState<AnalysisId[]>([]);
  const [view, setView] = useState<PanelView>("blink");
  const signals = useRef(new Map<AnalysisId, { cancelled: boolean }>());
  // The analysis asked for last. When several finish, only this one takes over the left side.
  const lastAsked = useRef<AnalysisId | null>(null);
  const set = (id: AnalysisId, s: JobState) => setJobs((j) => ({ ...j, [id]: s }));

  const show = useCallback((id: AnalysisId, focus: boolean) => {
    setOpened((o) => (o.includes(id) ? o : [...o, id]));
    if (focus) setView(id);
  }, []);

  const download = useCallback(
    async (id: AnalysisId) => {
      if (signals.current.has(id)) return;
      const signal = { cancelled: false };
      signals.current.set(id, signal);
      const startedAt = Date.now();
      let last: Progress = { done: 0, total: 1, step: "Starting", failed: 0 };
      set(id, { status: "running", progress: last, startedAt });
      try {
        await prefetchAnalysis(id, {
          qc,
          ra,
          dec,
          stmFovArcmin: stmFov,
          signal,
          onProgress: (p) => {
            last = p;
            if (!signal.cancelled) set(id, { status: "running", progress: p, startedAt });
          },
        });
        if (signal.cancelled) {
          set(id, { status: "idle" });
        } else {
          set(id, { status: "done", progress: last, seconds: Math.round((Date.now() - startedAt) / 1000) });
          show(id, lastAsked.current === id);
        }
      } catch (e) {
        set(id, signal.cancelled ? { status: "idle" } : { status: "error", message: e instanceof Error ? e.message : "Download failed" });
      } finally {
        signals.current.delete(id);
      }
    },
    [qc, ra, dec, stmFov, show],
  );

  const run = useCallback(
    (id: AnalysisId) => {
      lastAsked.current = id;
      if (jobs[id].status === "done") show(id, true);
      else void download(id);
    },
    [jobs, show, download],
  );

  const cancel = useCallback((id: AnalysisId) => {
    const s = signals.current.get(id);
    if (s) s.cancelled = true;
    set(id, { status: "idle" });
  }, []);

  const close = useCallback((id: AnalysisId) => {
    setOpened((o) => o.filter((x) => x !== id));
    setView((v) => (v === id ? "blink" : v));
  }, []);

  // Older links: download that analysis now; it opens by itself when ready.
  const started = useRef(false);
  useEffect(() => {
    if (autoOpen && !started.current) {
      started.current = true;
      lastAsked.current = autoOpen.analysis;
      void download(autoOpen.analysis);
    }
  }, [autoOpen, download]);

  useEffect(() => {
    const all = signals.current;
    return () => all.forEach((s) => (s.cancelled = true));
  }, []);

  const value = useMemo(
    () => ({ selection, autoOpen, stmFov, jobs, run, cancel, opened, view, setView, close }),
    [selection, autoOpen, stmFov, jobs, run, cancel, opened, view, close],
  );
  return <AnalysesContext.Provider value={value}>{children}</AnalysesContext.Provider>;
}

export function useAnalyses() {
  const value = useContext(AnalysesContext);
  if (!value) throw new Error("useAnalyses needs an AnalysesProvider");
  return value;
}
