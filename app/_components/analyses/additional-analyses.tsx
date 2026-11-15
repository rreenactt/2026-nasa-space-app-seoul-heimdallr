"use client";

import { useEffect, useState } from "react";
import { EyeIcon, PlayIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useT } from "@/app/_i18n/i18n-provider";
import type { MessageKey } from "@/app/_i18n/message-keys";
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
  const t = useT();
  const { selection, stmFov, jobs, run, cancel, opened, view, setView } = useAnalyses();
  const { target } = selection;
  const name = target?.name ?? t("panel.selectedPoint");
  const nearby = target ? NEARBY_PINS.has(target.id) : false;

  // Refresh the remaining-time estimate every second while something downloads.
  const [, setNow] = useState(0);
  const anyRunning = Object.values(jobs).some((j) => j.status === "running");
  useEffect(() => {
    if (!anyRunning) return;
    const timer = setInterval(() => setNow((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [anyRunning]);

  const items: { id: AnalysisId; summary: MessageKey; badge: { label: MessageKey; ready: boolean }; note: string }[] = [
    {
      id: "sky-time-machine",
      summary: "analyses.stmSummary",
      badge: { label: "analyses.anyPosition", ready: true },
      note: t("analyses.stmNote", { fov: stmFov }),
    },
    {
      id: "fake-planet-lab",
      summary: "analyses.fplSummary",
      badge: { label: "analyses.anyPosition", ready: true },
      note: t("analyses.fplNote"),
    },
    {
      id: "neighborhood-in-motion",
      summary: "analyses.nimSummary",
      badge: nearby ? { label: "analyses.objectInMap", ready: true } : { label: "analyses.nearbyOnly", ready: false },
      note: nearby ? t("analyses.nimNoteInMap", { name }) : t("analyses.nimNoteNearest"),
    },
    {
      id: "sky-sonata",
      summary: "analyses.sonataSummary",
      badge: { label: "analyses.anyPosition", ready: true },
      note: t("analyses.sonataNote"),
    },
    {
      id: "comet-breath",
      summary: "analyses.cometSummary",
      badge: { label: "analyses.cometOnly", ready: false },
      note: t("analyses.cometNote"),
    },
  ];

  return (
    <ul className="grid gap-2">
      {items.map((it) => {
        const title = t(ANALYSIS_TITLES[it.id]);
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
                <Badge variant={it.badge.ready ? "secondary" : "outline"}>{t(it.badge.label)}</Badge>
              </div>
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground select-none">{t(it.summary)}</summary>
                <p className="mt-1 text-muted-foreground">{it.note}</p>
              </details>

              {j.status === "idle" && (
                <Button size="sm" variant="secondary" className="w-fit" onClick={() => run(it.id)}>
                  <PlayIcon /> {t("analyses.run")}
                </Button>
              )}
              {j.status === "running" && p && (
                <div className="grid gap-1">
                  <Progress value={(p.done / Math.max(1, p.total)) * 100} aria-label={t("analyses.downloadLabel", { title })} />
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground" aria-live="polite">
                    <span>
                      {left != null
                        ? t("analyses.progressEta", { step: t(p.step), done: p.done, total: p.total, left: p.total - p.done, seconds: left })
                        : t("analyses.progress", { step: t(p.step), done: p.done, total: p.total, left: p.total - p.done })}
                    </span>
                    <Button size="xs" variant="ghost" onClick={() => cancel(it.id)}>
                      <XIcon /> {t("analyses.cancel")}
                    </Button>
                  </div>
                </div>
              )}
              {j.status === "done" && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Button size="sm" variant={view === it.id ? "default" : "secondary"} onClick={() => (isOpen ? setView(it.id) : run(it.id))}>
                    <EyeIcon /> {t(view === it.id ? "analyses.showingLeft" : "analyses.show")}
                  </Button>
                  <span className="text-muted-foreground">
                    {t("analyses.filesDone", { n: j.progress.done - j.progress.failed, seconds: j.seconds })}
                    {j.progress.failed ? ` · ${t("analyses.filesFailed", { n: j.progress.failed })}` : ""}
                  </span>
                </div>
              )}
              {j.status === "error" && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-destructive">
                  {j.message ?? t("analyses.downloadFailed")}
                  <Button size="xs" variant="outline" onClick={() => run(it.id)}>
                    {t("analyses.tryAgain")}
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
