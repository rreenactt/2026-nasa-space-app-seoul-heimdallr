"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { AudioLinesIcon, HistoryIcon, ImagesIcon, MicroscopeIcon, OrbitIcon, SparklesIcon, XIcon, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { Spinner } from "@/components/ui/spinner";
import { useAnalyses, type PanelView } from "./analyses-context";
import { FixedTargetContext } from "./fixed-target";
import type { AnalysisId } from "./prefetch";

const loading = () => (
  <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
    <Spinner /> Opening…
  </p>
);

// Each analysis is loaded only when it is first opened.
const SkyTimeMachineView = dynamic(() => import("../sky-time-machine/sky-time-machine-view").then((m) => m.SkyTimeMachineView), { loading });
const FakePlanetLabView = dynamic(() => import("../fake-planet-lab/fake-planet-lab-view").then((m) => m.FakePlanetLabView), { loading });
const NeighborhoodView = dynamic(() => import("../neighborhood/neighborhood-view").then((m) => m.NeighborhoodView), { loading });
const SkySonataView = dynamic(() => import("../sky-sonata/sky-sonata-view").then((m) => m.SkySonataView), { loading });
const CometBreathView = dynamic(() => import("../comet-breath/comet-breath-view").then((m) => m.CometBreathView), { loading });

export const ANALYSIS_TITLES: Record<AnalysisId, string> = {
  "sky-time-machine": "Sky Time Machine",
  "fake-planet-lab": "Fake Planet Lab",
  "neighborhood-in-motion": "Neighborhood in Motion",
  "sky-sonata": "Sky Sonata",
  "comet-breath": "Comet Breath · 3I/ATLAS",
};

/** One line under the tabs: what the open analysis shows and what it is not. */
const DESCRIPTIONS: Record<AnalysisId, string> = {
  "sky-time-machine": "The same patch of sky across decades, from 2MASS and WISE/NEOWISE to SPHEREx. Compare positions, not brightness.",
  "fake-planet-lab": "Check whether a dot is a real signal or a defect: quality flags, uncertainty and other observations, with the evidence kept.",
  "neighborhood-in-motion": "Nearest neighbours placed in 3D from measured distance and motion. Past and future positions come from a model, not observations.",
  "sky-sonata": "A rule-based conversion of the observed positions and brightness into sound. It was not recorded in space.",
  "comet-breath": "SPHEREx images, spectra, published production rates and processing evidence for the interstellar comet 3I/ATLAS.",
};

function AnalysisBody({ id, active }: { id: AnalysisId; active: boolean }) {
  const { selection, autoOpen, stmFov } = useAnalyses();
  const { ra, dec, target } = selection;
  const name = target?.name ?? "Selected point";
  const note = target?.note ?? "";
  switch (id) {
    case "sky-time-machine":
      return (
        <SkyTimeMachineView
          initialTarget={{ name, ra, dec, fovArcmin: stmFov, source: target ? `${target.source} (epoch ${target.epoch})` : "Point chosen on the sky" }}
        />
      );
    case "fake-planet-lab":
      return <FakePlanetLabView initialTarget={{ name, ra, dec, note }} />;
    case "neighborhood-in-motion":
      return <NeighborhoodView focus={{ ra, dec, name }} />;
    case "sky-sonata":
      return (
        <SkySonataView
          active={active}
          shared={{ target: { name, ra, dec, note }, settings: autoOpen?.analysis === "sky-sonata" ? autoOpen.settings : undefined }}
        />
      );
    case "comet-breath":
      return <CometBreathView />;
  }
}

const ICONS: Record<PanelView, LucideIcon> = {
  blink: ImagesIcon,
  "sky-time-machine": HistoryIcon,
  "fake-planet-lab": MicroscopeIcon,
  "neighborhood-in-motion": OrbitIcon,
  "sky-sonata": AudioLinesIcon,
  "comet-breath": SparklesIcon,
};

/**
 * Left side of the analysis panel: the SPHEREx images, and every opened analysis as a tab (PLAN.md chapter 5, `view`
 * outputs). With no analysis open there is nothing to switch between, so the tab strip is not shown at all. Hidden
 * tabs stay mounted so an analysis keeps its state when you switch back; closing a tab unmounts it.
 */
export function PanelViews({ blink }: { blink: React.ReactNode }) {
  const { opened, view, setView, close } = useAnalyses();
  const tabs: PanelView[] = ["blink", ...opened];
  // An analysis that finished downloading in the background is only built when first shown, so canvases and the 3D
  // map measure a visible box instead of a hidden one. Kept afterwards, so switching back keeps its state.
  const [shown, setShown] = useState<ReadonlySet<AnalysisId>>(() => new Set());
  if (view !== "blink" && !shown.has(view)) setShown(new Set(shown).add(view));

  return (
    <div className={cn("grid h-full min-h-0", opened.length ? "grid-rows-[auto_minmax(0,1fr)]" : "grid-rows-[minmax(0,1fr)]")}>
      {opened.length > 0 && (
        <div role="tablist" aria-label="Left view" className="flex min-w-0 items-center gap-1 overflow-x-auto border-b bg-muted/20 px-3 py-1.5">
          {tabs.map((t) => {
            const active = t === view;
            const Icon = ICONS[t];
            const title = t === "blink" ? "SPHEREx images" : ANALYSIS_TITLES[t];
            return (
              <div
                key={t}
                className={cn(
                  "flex h-8 shrink-0 items-center rounded-md text-xs transition-colors",
                  active ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setView(t)}
                  className={cn("flex h-full items-center gap-1.5 font-medium", t === "blink" ? "px-3" : "pr-1 pl-3")}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {title}
                </button>
                {t !== "blink" && (
                  <button
                    type="button"
                    onClick={() => close(t)}
                    aria-label={`Close ${title}`}
                    title="Close"
                    className="mr-1 grid size-5 place-items-center rounded hover:bg-muted"
                  >
                    <XIcon className="size-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="relative min-h-0">
        <section role={opened.length ? "tabpanel" : undefined} className={cn("h-full min-h-0 p-4", view !== "blink" && "hidden")}>
          {blink}
        </section>
        <FixedTargetContext.Provider value>
          {opened.map((id) => (
            <section key={id} role="tabpanel" className={cn("h-full min-h-0 flex-col gap-3 p-4", view === id ? "flex" : "hidden")}>
              <p className="text-xs text-muted-foreground">{DESCRIPTIONS[id]}</p>
              {(shown.has(id) || view === id) && <AnalysisBody id={id} active={view === id} />}
            </section>
          ))}
        </FixedTargetContext.Provider>
      </div>
    </div>
  );
}
