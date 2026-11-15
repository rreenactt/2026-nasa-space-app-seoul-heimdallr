"use client";

import { useEffect, useState } from "react";
import { EyeIcon, PlayIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAnalyses } from "./analyses-context";
import { AnalysisIllustration } from "./analysis-illustrations";
import { ANALYSIS_TITLES } from "./analysis-views";
import type { AnalysisId, Progress as P } from "./prefetch";

/** Test targets that are in the Neighborhood in Motion catalog (pin ids from sky/test-targets.ts). */
const NEARBY_PINS = new Set(["barnard", "eps-ind-b", "wise0855"]);

function eta(progress: P, startedAt: number) {
  if (progress.done === 0 || progress.done >= progress.total) return null;
  const per = (Date.now() - startedAt) / progress.done;
  return Math.max(1, Math.round((per * (progress.total - progress.done)) / 1000));
}

/**
 * The five additional analyses (PLAN.md chapter 6) beside the blink viewer. "Run" downloads what an analysis shows
 * (several can download at once, with files done, files left and an estimate), then opens it as a tab on the left.
 */
export function AdditionalAnalyses() {
  const { selection, stmFov, jobs, run, cancel, opened, view, setView } = useAnalyses();
  const { target } = selection;
  const name = target?.name ?? "Selected point";
  const nearby = target ? NEARBY_PINS.has(target.id) : false;

  // Refresh the remaining-time estimate every second while something downloads.
  const [, setNow] = useState(0);
  const anyRunning = Object.values(jobs).some((j) => j.status === "running");
  useEffect(() => {
    if (!anyRunning) return;
    const t = setInterval(() => setNow((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [anyRunning]);

  const items: { id: AnalysisId; summary: string; badge: { label: string; ready: boolean }; note: string }[] = [
    {
      id: "sky-time-machine",
      summary: "The same patch of sky from 2MASS (≈2000), WISE/NEOWISE (2010–2024) and SPHEREx, in real observation order.",
      badge: { label: "Any position", ready: true },
      note: `${stmFov}′ field on this point. The largest download (about 30 images); 2MASS images come from IRSA, two at a time.`,
    },
    {
      id: "fake-planet-lab",
      summary: "Is a dot real or a defect? Quality flags, uncertainty and other observations for any spot you click.",
      badge: { label: "Any position", ready: true },
      note: "SPHEREx search and up to 3 exposures of this point.",
    },
    {
      id: "neighborhood-in-motion",
      summary: "Nearby stars and brown dwarfs in 3D from measured distance and motion, linked to SPHEREx.",
      badge: nearby ? { label: "Object in the map", ready: true } : { label: "Nearby objects only", ready: false },
      note: nearby ? `${name} is in the map and will be selected.` : "This point is matched to the nearest object within about 3.6 pc; the map says if none is close.",
    },
    {
      id: "sky-sonata",
      summary: "Hear the sky: position becomes left/right and pitch, brightness becomes loudness. Keyboard-first.",
      badge: { label: "Any position", ready: true },
      note: "SPHEREx search and two observations (A and B) of this point.",
    },
    {
      id: "comet-breath",
      summary: "Water, CO₂ and CO from the interstellar comet 3I/ATLAS, before and after perihelion.",
      badge: { label: "3I/ATLAS only", ready: false },
      note: "Uses the dedicated 3I/ATLAS dataset, not this point (the comet moves, so fixed coordinates cannot find it).",
    },
  ];

  return (
    <ul className="grid gap-2">
      {items.map((it) => {
        const title = ANALYSIS_TITLES[it.id];
        const j = jobs[it.id];
        const p = j.status === "running" ? j.progress : null;
        const left = j.status === "running" ? eta(j.progress, j.startedAt) : null;
        const isOpen = opened.includes(it.id);
        return (
          <li key={it.id} className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-3 rounded-md border p-3">
            <AnalysisIllustration id={it.id} className="h-auto w-full rounded-sm bg-muted/40 p-1 text-muted-foreground" />
            <div className="grid min-w-0 gap-2">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
                <Badge variant={it.badge.ready ? "secondary" : "outline"}>{it.badge.label}</Badge>
              </div>
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground select-none">{it.summary}</summary>
                <p className="mt-1 text-muted-foreground">{it.note}</p>
              </details>

              {j.status === "idle" && (
                <Button size="sm" variant="secondary" className="w-fit" onClick={() => run(it.id)}>
                  <PlayIcon /> Run
                </Button>
              )}
              {j.status === "running" && p && (
                <div className="grid gap-1">
                  <Progress value={(p.done / Math.max(1, p.total)) * 100} aria-label={`${title} download`} />
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground" aria-live="polite">
                    <span>
                      {p.step} · {p.done} / {p.total} done, {p.total - p.done} left{left != null ? ` · about ${left} s` : ""}. Opens when ready.
                    </span>
                    <Button size="xs" variant="ghost" onClick={() => cancel(it.id)}>
                      <XIcon /> Cancel
                    </Button>
                  </div>
                </div>
              )}
              {j.status === "done" && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Button size="sm" variant={view === it.id ? "default" : "secondary"} onClick={() => (isOpen ? setView(it.id) : run(it.id))}>
                    <EyeIcon /> {view === it.id ? "Showing on the left" : "Show"}
                  </Button>
                  <span className="text-muted-foreground">
                    {j.progress.done - j.progress.failed} files in {j.seconds} s{j.progress.failed ? ` · ${j.progress.failed} failed (shown inside)` : ""}
                  </span>
                </div>
              )}
              {j.status === "error" && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-destructive">
                  {j.message}
                  <Button size="xs" variant="outline" onClick={() => run(it.id)}>
                    Try again
                  </Button>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
