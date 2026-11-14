"use client";

import { useRef, useState } from "react";
import { ClockIcon, Columns2Icon, FootprintsIcon, ScrollTextIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompareTab } from "./compare-tab";
import { EvidenceTab } from "./evidence-tab";
import { MotionTab } from "./motion-tab";
import { StmStateProvider, type Target } from "./stm-state";
import { TargetBar } from "./target-bar";
import { TimelineTab } from "./timeline-tab";

type StmTab = "timeline" | "compare" | "motion" | "evidence";

const TABS: { id: StmTab; label: string; icon: React.ComponentType }[] = [
  { id: "timeline", label: "타임라인·재생", icon: ClockIcon },
  { id: "compare", label: "두 시점 비교", icon: Columns2Icon },
  { id: "motion", label: "이동 표시", icon: FootprintsIcon },
  { id: "evidence", label: "근거 확인", icon: ScrollTextIcon },
];

/**
 * Sky Time Machine popup: the same patch of sky from 2MASS (≈2000), WISE/NEOWISE (2010–2024) and
 * SPHEREx (2025–), in real observation order. Everything is fetched on demand and kept in memory only.
 */
export function SkyTimeMachineDialog({ initialTarget, defaultOpen = false, trigger }: { initialTarget?: Target; defaultOpen?: boolean; trigger?: React.ReactElement }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ?? <Button variant="outline">Sky Time Machine 열기</Button>} />
      <DialogContent className="flex max-h-[94dvh] flex-col gap-3 overflow-hidden sm:max-w-6xl [--series-1:#2a78d6] [--series-2:#eb6834] [--series-3:#1baf7a] [--series-4:#eda100] dark:[--series-1:#3987e5] dark:[--series-2:#d95926] dark:[--series-3:#199e70] dark:[--series-4:#c98500]">
        <DialogHeader>
          <DialogTitle>Sky Time Machine</DialogTitle>
          <DialogDescription>같은 하늘을 수십 년에 걸쳐 비교하며, 움직이는 천체를 직접 찾아보세요.</DialogDescription>
        </DialogHeader>
        {open && (
          <StmStateProvider initialTarget={initialTarget}>
            <Body />
          </StmStateProvider>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Body() {
  const [tab, setTabState] = useState<StmTab>("timeline");
  const scrollRef = useRef<HTMLDivElement>(null);
  const setTab = (t: StmTab) => {
    setTabState(t);
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
              <span className="max-sm:sr-only">{label}</span>
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
