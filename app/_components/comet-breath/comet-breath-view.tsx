"use client";

import { useRef, useState } from "react";
import { AlertCircleIcon, ImageIcon, LineChartIcon, ScaleIcon, ScrollTextIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/app/_i18n/i18n-provider";
import type { MessageKey } from "@/app/_i18n/message-keys";
import { CometStateProvider } from "./comet-state";
import { EvidencePanel } from "./evidence-panel";
import { ImageExplorer } from "./image-explorer";
import { ObservationTimeline } from "./observation-timeline";
import { RatesPanel } from "./rates-panel";
import { SpectrumExplorer } from "./spectrum-explorer";
import { useObservationIndex } from "./use-comet-data";

export type CometTab = "images" | "spectrum" | "rates" | "evidence";

const TABS: { id: CometTab; label: MessageKey; icon: React.ComponentType }[] = [
  { id: "images", label: "comet.tabImages", icon: ImageIcon },
  { id: "spectrum", label: "comet.tabSpectrum", icon: LineChartIcon },
  { id: "rates", label: "comet.tabRates", icon: ScaleIcon },
  { id: "evidence", label: "comet.tabEvidence", icon: ScrollTextIcon },
];

/**
 * Comet Breath, shown inside the analysis panel: every feature is a tab, sharing the selected period / observation.
 * Data is fetched from IRSA / JPL only when a tab needs it and kept in memory while the page is open.
 */
export function CometBreathView({ defaultTab = "images" }: { defaultTab?: CometTab }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col [--series-1:#2a78d6] [--series-2:#eb6834] dark:[--series-1:#3987e5] dark:[--series-2:#d95926]">
      <CometStateProvider>
        <ViewBody defaultTab={defaultTab} />
      </CometStateProvider>
    </div>
  );
}

function ViewBody({ defaultTab }: { defaultTab: CometTab }) {
  const t = useT();
  const index = useObservationIndex();
  const [tab, setTabState] = useState<CometTab>(defaultTab);
  const scrollRef = useRef<HTMLDivElement>(null);
  const setTab = (next: CometTab) => {
    setTabState(next);
    scrollRef.current?.scrollTo({ top: 0 });
  };

  if (index.isPending) {
    return (
      <div className="flex items-center gap-2 py-10 text-muted-foreground">
        <Spinner /> {t("comet.loadingList")}
      </div>
    );
  }
  if (index.isError) {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>{t("comet.listError")}</AlertTitle>
        <AlertDescription>
          {index.error.message}
          <Button variant="outline" size="sm" className="mt-2" onClick={() => index.refetch()}>
            {t("analyses.tryAgain")}
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
              <span className="max-sm:sr-only">{t(label)}</span>
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
