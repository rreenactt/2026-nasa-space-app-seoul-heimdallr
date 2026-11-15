"use client";

import { useRef, useState } from "react";
import { ClockIcon, Columns2Icon, FootprintsIcon, ScrollTextIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/app/_i18n/i18n-provider";
import type { MessageKey } from "@/app/_i18n/message-keys";
import { CompareTab } from "./compare-tab";
import { EvidenceTab } from "./evidence-tab";
import { MotionTab } from "./motion-tab";
import { StmStateProvider, type Target } from "./stm-state";
import { TargetBar } from "./target-bar";
import { TimelineTab } from "./timeline-tab";

type StmTab = "timeline" | "compare" | "motion" | "evidence";

const TABS: { id: StmTab; label: MessageKey; icon: React.ComponentType }[] = [
  { id: "timeline", label: "stm.tabTimeline", icon: ClockIcon },
  { id: "compare", label: "stm.tabCompare", icon: Columns2Icon },
  { id: "motion", label: "stm.tabMotion", icon: FootprintsIcon },
  { id: "evidence", label: "stm.tabEvidence", icon: ScrollTextIcon },
];

/**
 * Sky Time Machine, shown inside the analysis panel: the same patch of sky from 2MASS (≈2000), WISE/NEOWISE
 * (2010–2024) and SPHEREx (2025–), in real observation order. Everything is fetched on demand and kept in memory only.
 */
export function SkyTimeMachineView({ initialTarget }: { initialTarget?: Target }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col [--series-1:#2a78d6] [--series-2:#eb6834] [--series-3:#1baf7a] [--series-4:#eda100] dark:[--series-1:#3987e5] dark:[--series-2:#d95926] dark:[--series-3:#199e70] dark:[--series-4:#c98500]">
      <StmStateProvider initialTarget={initialTarget}>
        <Body />
      </StmStateProvider>
    </div>
  );
}

function Body() {
  const t = useT();
  const [tab, setTabState] = useState<StmTab>("timeline");
  const scrollRef = useRef<HTMLDivElement>(null);
  const setTab = (next: StmTab) => {
    setTabState(next);
    scrollRef.current?.scrollTo({ top: 0 });
  };
  return (
    <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
      <TargetBar />
      <Tabs value={tab} onValueChange={(v) => setTab(v as StmTab)}>
        <TabsList className="w-full">
          {TABS.map(({ id, label, icon: Icon }) => (
            <TabsTrigger key={id} value={id}>
              <Icon />
              <span className="max-sm:sr-only">{t(label)}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="timeline">
          <TimelineTab />
        </TabsContent>
        <TabsContent value="compare">
          <CompareTab />
        </TabsContent>
        <TabsContent value="motion">
          <MotionTab />
        </TabsContent>
        <TabsContent value="evidence">
          <EvidenceTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
