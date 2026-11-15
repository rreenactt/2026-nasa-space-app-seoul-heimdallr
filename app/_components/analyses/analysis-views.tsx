"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { AudioLinesIcon, HistoryIcon, ImagesIcon, MicroscopeIcon, OrbitIcon, PanelRightCloseIcon, PanelRightOpenIcon, SparklesIcon, XIcon, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { Spinner } from "@/components/ui/spinner";
import { useT } from "@/app/_i18n/i18n-provider";
import type { MessageKey } from "@/app/_i18n/message-keys";
import { targetPositionAt } from "../sky/test-targets";
import { useAnalyses, type PanelView } from "./analyses-context";
import { FixedTargetContext } from "./fixed-target";
import type { AnalysisId } from "./prefetch";

function loading() {
  return <Opening />;
}

function Opening() {
  const t = useT();
  return (
    <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
      <Spinner /> {t("analyses.opening")}
    </p>
  );
}

// Each analysis is loaded only when it is first opened.
const SkyTimeMachineView = dynamic(() => import("../sky-time-machine/sky-time-machine-view").then((m) => m.SkyTimeMachineView), { loading });
const FakePlanetLabView = dynamic(() => import("../fake-planet-lab/fake-planet-lab-view").then((m) => m.FakePlanetLabView), { loading });
const NeighborhoodView = dynamic(() => import("../neighborhood/neighborhood-view").then((m) => m.NeighborhoodView), { loading });
const SkySonataView = dynamic(() => import("../sky-sonata/sky-sonata-view").then((m) => m.SkySonataView), { loading });
const CometBreathView = dynamic(() => import("../comet-breath/comet-breath-view").then((m) => m.CometBreathView), { loading });

/** Analysis names (kept in English in every language). */
export const ANALYSIS_TITLES: Record<AnalysisId, MessageKey> = {
  "sky-time-machine": "analyses.titleSkyTimeMachine",
  "fake-planet-lab": "analyses.titleFakePlanetLab",
  "neighborhood-in-motion": "analyses.titleNeighborhood",
  "sky-sonata": "analyses.titleSkySonata",
  "comet-breath": "analyses.titleCometBreath",
};

/** Tooltip of each tab: what the analysis shows and what it is not. */
const DESCRIPTIONS: Record<AnalysisId, MessageKey> = {
  "sky-time-machine": "analyses.descSkyTimeMachine",
  "fake-planet-lab": "analyses.descFakePlanetLab",
  "neighborhood-in-motion": "analyses.descNeighborhood",
  "sky-sonata": "analyses.descSkySonata",
  "comet-breath": "analyses.descCometBreath",
};

function AnalysisBody({ id, active }: { id: AnalysisId; active: boolean }) {
  const t = useT();
  const { selection, autoOpen, stmFov } = useAnalyses();
  const { ra, dec, target } = selection;
  const name = target?.name ?? t("panel.selectedPoint");
  const note = target ? t(target.noteKey) : "";
  // The epoch and source of the position the panel is open on (the pin, or the target's SPHEREx-epoch position).
  const position = target ? targetPositionAt(target, selection) : null;
  switch (id) {
    case "sky-time-machine":
      return (
        <SkyTimeMachineView
          initialTarget={{ name, ra, dec, fovArcmin: stmFov, source: position ? t("analyses.positionSource", { source: position.source, epoch: position.epoch }) : t("analyses.pointChosen") }}
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
export function PanelViews({ blink, wide, onToggleWide }: { blink: React.ReactNode; wide: boolean; onToggleWide: () => void }) {
  const t = useT();
  const { opened, view, setView, close } = useAnalyses();
  const tabs: PanelView[] = ["blink", ...opened];
  // An analysis that finished downloading in the background is only built when first shown, so canvases and the 3D
  // map measure a visible box instead of a hidden one. Kept afterwards, so switching back keeps its state.
  const [shown, setShown] = useState<ReadonlySet<AnalysisId>>(() => new Set());
  if (view !== "blink" && !shown.has(view)) setShown(new Set(shown).add(view));

  return (
    <div className={cn("grid h-full min-h-0", opened.length ? "grid-rows-[auto_minmax(0,1fr)]" : "grid-rows-[minmax(0,1fr)]")}>
      {opened.length > 0 && (
        <div role="tablist" aria-label={t("analyses.leftView")} className="flex min-w-0 items-end gap-1 border-b px-3 pt-1">
          {tabs.map((tab) => {
            const active = tab === view;
            const Icon = ICONS[tab];
            const title = t(tab === "blink" ? "analyses.tabImages" : ANALYSIS_TITLES[tab]);
            return (
              <div
                key={tab}
                className={cn(
                  "-mb-px flex h-9 min-w-0 items-center border-b text-xs transition-colors",
                  active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setView(tab)}
                  title={tab === "blink" ? undefined : t(DESCRIPTIONS[tab])}
                  className={cn("flex h-full min-w-0 items-center gap-1.5 font-medium", tab === "blink" ? "px-2.5" : "pr-1 pl-2.5")}
                >
                  <Icon className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{title}</span>
                </button>
                {tab !== "blink" && (
                  <button
                    type="button"
                    onClick={() => close(tab)}
                    aria-label={t("analyses.closeTab", { title })}
                    title={t("common.close")}
                    className="mr-1 grid size-5 shrink-0 place-items-center rounded hover:bg-muted"
                  >
                    <XIcon className="size-3" />
                  </button>
                )}
              </div>
            );
          })}
          {/* More room for the analysis: hides the summary column (wide screens only, where the two sit side by side). */}
          <button
            type="button"
            onClick={onToggleWide}
            aria-pressed={wide}
            aria-label={t(wide ? "analyses.showSummary" : "analyses.hideSummary")}
            title={t(wide ? "analyses.showSummary" : "analyses.hideSummary")}
            className="mb-1.5 ml-auto grid size-7 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground max-lg:hidden"
          >
            {wide ? <PanelRightOpenIcon className="size-4" /> : <PanelRightCloseIcon className="size-4" />}
          </button>
        </div>
      )}

      <div className="relative min-h-0">
        <section role={opened.length ? "tabpanel" : undefined} className={cn("h-full min-h-0 p-4", view !== "blink" && "hidden")}>
          {blink}
        </section>
        <FixedTargetContext.Provider value>
          {opened.map((id) => (
            <section key={id} role="tabpanel" className={cn("@container h-full min-h-0 flex-col gap-3 p-4", view === id ? "flex" : "hidden")}>
              {(shown.has(id) || view === id) && <AnalysisBody id={id} active={view === id} />}
            </section>
          ))}
        </FixedTargetContext.Provider>
      </div>
    </div>
  );
}
