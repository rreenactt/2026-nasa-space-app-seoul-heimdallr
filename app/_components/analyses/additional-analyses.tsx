"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DownloadIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { SoundSettings } from "@/app/_lib/sonata/mapping";
import { CometBreathDialog } from "../comet-breath/comet-breath-dialog";
import { FakePlanetLabDialog } from "../fake-planet-lab/fake-planet-lab-dialog";
import { NeighborhoodDialog } from "../neighborhood/neighborhood-dialog";
import type { SkySelection } from "../sky/sky-selection";
import { SkySonataDialog } from "../sky-sonata/sky-sonata-dialog";
import { SkyTimeMachineDialog } from "../sky-time-machine/sky-time-machine-dialog";
import { prefetchAnalysis, type AnalysisId, type Progress as P } from "./prefetch";

/** Opens one analysis right away (older `?stm=` / `?sonata=` links): it is downloaded first, then opened. */
export type AutoOpenAnalysis =
  | { analysis: "sky-time-machine"; fovArcmin: number }
  | { analysis: "sky-sonata"; settings: Partial<SoundSettings> };

/** Test targets that are in the Neighborhood in Motion catalog (pin ids from sky/test-targets.ts). */
const NEARBY_PINS = new Set(["barnard", "eps-ind-b", "wise0855"]);

type JobState =
  | { status: "idle" }
  | { status: "queued" }
  | { status: "running"; progress: P; startedAt: number }
  | { status: "done"; progress: P; seconds: number }
  | { status: "error"; message: string };

function eta(progress: P, startedAt: number) {
  if (progress.done === 0 || progress.done >= progress.total) return null;
  const per = (Date.now() - startedAt) / progress.done;
  return Math.max(1, Math.round((per * (progress.total - progress.done)) / 1000));
}

/**
 * The five additional analyses (PLAN.md chapter 6) beside the blink viewer. "Download data" fetches what an analysis
 * shows when it opens (one analysis at a time, queued); the progress bar shows files done, files left and an
 * estimate. When it is ready, "Open" shows it without loading. Each opens on the panel's point.
 */
export function AdditionalAnalyses({ selection, autoOpen }: { selection: SkySelection; autoOpen?: AutoOpenAnalysis }) {
  const qc = useQueryClient();
  const { ra, dec, target } = selection;
  const name = target?.name ?? "Selected point";
  const source = target ? `${target.source} (epoch ${target.epoch})` : "Point chosen on the sky";
  const nearby = target ? NEARBY_PINS.has(target.id) : false;
  const stmFov = autoOpen?.analysis === "sky-time-machine" ? autoOpen.fovArcmin : 8;

  const [jobs, setJobs] = useState<Record<AnalysisId, JobState>>({
    "sky-time-machine": { status: "idle" },
    "fake-planet-lab": { status: "idle" },
    "neighborhood-in-motion": { status: "idle" },
    "sky-sonata": { status: "idle" },
    "comet-breath": { status: "idle" },
  });
  const [, setNow] = useState(0);
  const queue = useRef<AnalysisId[]>([]);
  const busy = useRef(false);
  const signal = useRef({ cancelled: false });
  const set = (id: AnalysisId, s: JobState) => setJobs((j) => ({ ...j, [id]: s }));

  const pump = useCallback(async () => {
    if (busy.current) return;
    const id = queue.current.shift();
    if (!id) return;
    busy.current = true;
    signal.current = { cancelled: false };
    const startedAt = Date.now();
    let last: P = { done: 0, total: 1, step: "Starting", failed: 0 };
    set(id, { status: "running", progress: last, startedAt });
    try {
      await prefetchAnalysis(id, {
        qc,
        ra,
        dec,
        stmFovArcmin: stmFov,
        signal: signal.current,
        onProgress: (p) => {
          last = p;
          set(id, { status: "running", progress: p, startedAt });
        },
      });
      set(id, signal.current.cancelled ? { status: "idle" } : { status: "done", progress: last, seconds: Math.round((Date.now() - startedAt) / 1000) });
    } catch (e) {
      set(id, { status: "error", message: e instanceof Error ? e.message : "Download failed" });
    } finally {
      busy.current = false;
      void pump();
    }
  }, [qc, ra, dec, stmFov]);

  const enqueue = useCallback(
    (id: AnalysisId) => {
      if (queue.current.includes(id)) return;
      queue.current.push(id);
      set(id, { status: "queued" });
      void pump();
    },
    [pump],
  );
  const cancel = (id: AnalysisId) => {
    if (jobs[id].status === "queued") {
      queue.current = queue.current.filter((q) => q !== id);
      set(id, { status: "idle" });
    } else if (jobs[id].status === "running") signal.current.cancelled = true;
  };

  // Older links: download that analysis now; it opens by itself when ready.
  const started = useRef(false);
  useEffect(() => {
    if (autoOpen && !started.current) {
      started.current = true;
      enqueue(autoOpen.analysis);
    }
  }, [autoOpen, enqueue]);

  // Refresh the remaining-time estimate every second while something downloads.
  const anyRunning = Object.values(jobs).some((j) => j.status === "running");
  useEffect(() => {
    if (!anyRunning) return;
    const t = setInterval(() => setNow((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [anyRunning]);
  useEffect(() => () => void (signal.current.cancelled = true), []);

  const auto = (id: AnalysisId) => autoOpen?.analysis === id;
  const items: { id: AnalysisId; title: string; summary: string; badge: { label: string; ready: boolean }; note: string; open: (o: boolean) => React.ReactElement }[] = [
    {
      id: "sky-time-machine",
      title: "Sky Time Machine",
      summary: "The same patch of sky from 2MASS (≈2000), WISE/NEOWISE (2010–2024) and SPHEREx, in real observation order.",
      badge: { label: "Any position", ready: true },
      note: `${stmFov}′ field on this point. The largest download (about 30 images); IRSA limits how fast it goes.`,
      open: (o) => (
        <SkyTimeMachineDialog initialTarget={{ name, ra, dec, fovArcmin: stmFov, source }} defaultOpen={o} trigger={<Button size="sm">Open</Button>} />
      ),
    },
    {
      id: "fake-planet-lab",
      title: "Fake Planet Lab",
      summary: "Is a dot real or a defect? Quality flags, uncertainty and other observations for any spot you click.",
      badge: { label: "Any position", ready: true },
      note: "SPHEREx search and up to 3 exposures of this point.",
      open: () => <FakePlanetLabDialog initialTarget={{ name, ra, dec, note: target?.note ?? "" }} trigger={<Button size="sm">Open</Button>} />,
    },
    {
      id: "neighborhood-in-motion",
      title: "Neighborhood in Motion",
      summary: "Nearby stars and brown dwarfs in 3D from measured distance and motion, linked to SPHEREx.",
      badge: nearby ? { label: "Object in the map", ready: true } : { label: "Nearby objects only", ready: false },
      note: nearby ? `${name} is in the map and will be selected.` : "This point is matched to the nearest object within about 3.6 pc; the map says if none is close.",
      open: () => <NeighborhoodDialog focus={{ ra, dec, name }} trigger={<Button size="sm">Open</Button>} />,
    },
    {
      id: "sky-sonata",
      title: "Sky Sonata",
      summary: "Hear the sky: position becomes left/right and pitch, brightness becomes loudness. Keyboard-first.",
      badge: { label: "Any position", ready: true },
      note: "SPHEREx search and two observations (A and B) of this point.",
      open: (o) => (
        <SkySonataDialog
          shared={{ target: { name, ra, dec, note: target?.note ?? "" }, settings: autoOpen?.analysis === "sky-sonata" ? autoOpen.settings : undefined }}
          defaultOpen={o}
          trigger={<Button size="sm">Open</Button>}
        />
      ),
    },
    {
      id: "comet-breath",
      title: "Comet Breath · 3I/ATLAS",
      summary: "Water, CO₂ and CO from the interstellar comet 3I/ATLAS, before and after perihelion.",
      badge: { label: "3I/ATLAS only", ready: false },
      note: "Uses the dedicated 3I/ATLAS dataset, not this point (the comet moves, so fixed coordinates cannot find it).",
      open: () => <CometBreathDialog trigger={<Button size="sm">Open</Button>} />,
    },
  ];

  return (
    <ul className="grid gap-2">
      {items.map((it) => {
        const j = jobs[it.id];
        const p = j.status === "running" || j.status === "done" ? j.progress : null;
        const left = j.status === "running" ? eta(j.progress, j.startedAt) : null;
        return (
          <li key={it.id} className="grid gap-2 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-medium">{it.title}</span>
              <Badge variant={it.badge.ready ? "secondary" : "outline"}>{it.badge.label}</Badge>
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground select-none">{it.summary}</summary>
              <p className="mt-1 text-muted-foreground">{it.note}</p>
            </details>

            {j.status === "idle" && (
              <Button size="sm" variant="secondary" className="w-fit" onClick={() => enqueue(it.id)}>
                <DownloadIcon /> Download data
              </Button>
            )}
            {j.status === "queued" && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                Waiting — one analysis downloads at a time.
                <Button size="xs" variant="ghost" onClick={() => cancel(it.id)}><XIcon /> Cancel</Button>
              </div>
            )}
            {j.status === "running" && p && (
              <div className="grid gap-1">
                <Progress value={(p.done / Math.max(1, p.total)) * 100} aria-label={`${it.title} download`} />
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground" aria-live="polite">
                  <span>
                    {p.step} · {p.done} / {p.total} done, {p.total - p.done} left{left != null ? ` · about ${left} s` : ""}
                  </span>
                  <Button size="xs" variant="ghost" onClick={() => cancel(it.id)}><XIcon /> Cancel</Button>
                </div>
              </div>
            )}
            {j.status === "done" && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {it.open(auto(it.id))}
                <span className="text-muted-foreground">
                  Ready · {j.progress.done - j.progress.failed} files in {j.seconds} s{j.progress.failed ? ` · ${j.progress.failed} failed (shown inside)` : ""}
                </span>
              </div>
            )}
            {j.status === "error" && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-destructive">
                {j.message}
                <Button size="xs" variant="outline" onClick={() => enqueue(it.id)}>Try again</Button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
