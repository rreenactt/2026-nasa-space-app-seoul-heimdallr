"use client";

import { useRef, useState } from "react";
import { AlertCircleIcon, ImageIcon, LineChartIcon, ScaleIcon, ScrollTextIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CometStateProvider } from "./comet-state";
import { EvidencePanel } from "./evidence-panel";
import { ImageExplorer } from "./image-explorer";
import { ObservationTimeline } from "./observation-timeline";
import { RatesPanel } from "./rates-panel";
import { SpectrumExplorer } from "./spectrum-explorer";
import { useObservationIndex } from "./use-comet-data";

export type CometTab = "images" | "spectrum" | "rates" | "evidence";

const TABS: { id: CometTab; label: string; icon: React.ComponentType }[] = [
  { id: "images", label: "관측 영상", icon: ImageIcon },
  { id: "spectrum", label: "스펙트럼", icon: LineChartIcon },
  { id: "rates", label: "방출률 비교", icon: ScaleIcon },
  { id: "evidence", label: "관측 근거", icon: ScrollTextIcon },
];

/**
 * Comet Breath popup: every feature is a tab inside one dialog, sharing the selected period / observation.
 * Data is fetched from IRSA / JPL only when a tab needs it and kept in memory while the page is open.
 */
export function CometBreathDialog({ trigger, defaultTab = "images" }: { trigger?: React.ReactElement; defaultTab?: CometTab }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ?? <Button>Comet Breath 열기</Button>} />
      <DialogContent className="flex max-h-[92dvh] flex-col gap-4 overflow-hidden sm:max-w-5xl [--series-1:#2a78d6] [--series-2:#eb6834] dark:[--series-1:#3987e5] dark:[--series-2:#d95926]">
        <DialogHeader>
          <DialogTitle>Comet Breath · 3I/ATLAS</DialogTitle>
          <DialogDescription>SPHEREx 관측 영상·스펙트럼·논문 방출률·처리 근거를 한 곳에서 탐색합니다.</DialogDescription>
        </DialogHeader>
        {open && (
          <CometStateProvider>
            <DialogBody defaultTab={defaultTab} />
          </CometStateProvider>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DialogBody({ defaultTab }: { defaultTab: CometTab }) {
  const index = useObservationIndex();
  const [tab, setTabState] = useState<CometTab>(defaultTab);
  const scrollRef = useRef<HTMLDivElement>(null);
  const setTab = (t: CometTab) => {
    setTabState(t);
    scrollRef.current?.scrollTo({ top: 0 });
  };

  if (index.isPending) {
    return (
      <div className="flex items-center gap-2 py-10 text-muted-foreground">
        <Spinner /> IRSA 관측 목록을 불러오는 중…
      </div>
    );
  }
  if (index.isError) {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>관측 목록을 불러오지 못했습니다</AlertTitle>
        <AlertDescription>
          {index.error.message}
          <Button variant="outline" size="sm" className="mt-2" onClick={() => index.refetch()}>
            다시 시도
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <ObservationTimeline />
      <Tabs value={tab} onValueChange={(v) => setTab(v as CometTab)} className="min-h-0 flex-1">
        <TabsList className="w-full">
          {TABS.map(({ id, label, icon: Icon }) => (
            <TabsTrigger key={id} value={id}>
              <Icon />
              <span className="max-sm:sr-only">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto pr-1">
          <TabsContent value="images">
            <ImageExplorer />
          </TabsContent>
          <TabsContent value="spectrum">
            <SpectrumExplorer onPick={() => setTab("images")} />
          </TabsContent>
          <TabsContent value="rates">
            <RatesPanel />
          </TabsContent>
          <TabsContent value="evidence">
            <EvidencePanel />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
