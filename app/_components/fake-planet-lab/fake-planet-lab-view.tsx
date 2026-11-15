"use client";

import { useRef, useState } from "react";
import { BookOpenIcon, ClipboardListIcon, MicroscopeIcon, ScrollTextIcon, SunDimIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/app/_i18n/i18n-provider";
import type { MessageKey } from "@/app/_i18n/message-keys";
import { useFixedTarget } from "../analyses/fixed-target";
import { BrightnessTab } from "./brightness-tab";
import { FPL_EXAMPLES, FplStateProvider, useFpl, type FplTarget } from "./fpl-state";
import { targetName, targetNote } from "./fpl-text";
import { FlagGuideTab, ProvenanceTab, RecordsTab } from "./guide-tabs";
import { InspectTab } from "./inspect-tab";

type Tab = "inspect" | "brightness" | "flags" | "records" | "provenance";
const TABS: { id: Tab; label: MessageKey; icon: React.ComponentType }[] = [
  { id: "inspect", label: "fpl.tabInspect", icon: MicroscopeIcon },
  { id: "brightness", label: "fpl.tabBrightness", icon: SunDimIcon },
  { id: "flags", label: "fpl.tabFlags", icon: BookOpenIcon },
  { id: "records", label: "fpl.tabRecords", icon: ClipboardListIcon },
  { id: "provenance", label: "fpl.tabProvenance", icon: ScrollTextIcon },
];

/**
 * Fake Planet Lab, shown inside the analysis panel: is a moving-looking dot a real signal, or an image defect /
 * comparison artifact? Shows SPHEREx quality flags, uncertainty and other observations for a position. On-demand data only.
 */
export function FakePlanetLabView({ initialTarget }: { initialTarget?: FplTarget }) {
  return (
    <FplStateProvider initialTarget={initialTarget}>
      <Body />
    </FplStateProvider>
  );
}

function TargetBar() {
  const t = useT();
  const { target, setTarget } = useFpl();
  const [ra, setRa] = useState(target.ra.toFixed(5));
  const [dec, setDec] = useState(target.dec.toFixed(5));
  const example = FPL_EXAMPLES.find((e) => e.name === target.name);
  return (
    <div className="grid gap-2 rounded-lg border bg-muted/30 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1">
          <Label className="text-xs">{t("fpl.example")}</Label>
          <NativeSelect
            size="sm"
            value={example?.name ?? ""}
            onChange={(e) => {
              const ex = FPL_EXAMPLES.find((x) => x.name === e.target.value);
              if (!ex) return;
              setTarget(ex);
              setRa(ex.ra.toFixed(5));
              setDec(ex.dec.toFixed(5));
            }}
          >
            <NativeSelectOption value="">{t("fpl.customPosition")}</NativeSelectOption>
            {FPL_EXAMPLES.map((e) => (
              <NativeSelectOption key={e.name} value={e.name}>
                {targetName(t, e.name)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="fpl-ra" className="text-xs">RA (deg)</Label>
          <Input id="fpl-ra" className="h-8 w-28 font-mono" value={ra} onChange={(e) => setRa(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="fpl-dec" className="text-xs">Dec (deg)</Label>
          <Input id="fpl-dec" className="h-8 w-28 font-mono" value={dec} onChange={(e) => setDec(e.target.value)} />
        </div>
        <Button
          size="sm"
          onClick={() => {
            const r = Number(ra);
            const d = Number(dec);
            if (r >= 0 && r < 360 && Math.abs(d) <= 90) setTarget({ name: "Custom position", ra: r, dec: d, note: "" });
          }}
        >
          {t("fpl.go")}
        </Button>
      </div>
      {example?.note && <p className="text-xs text-muted-foreground">{targetNote(t, example)}</p>}
    </div>
  );
}

function Body() {
  const t = useT();
  const [tab, setTabState] = useState<Tab>("inspect");
  const ref = useRef<HTMLDivElement>(null);
  const fixed = useFixedTarget();
  return (
    <div ref={ref} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
      {/* In the analysis panel the point is already chosen; the example list and coordinates would only compete with it. */}
      {!fixed && <TargetBar />}
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTabState(v as Tab);
          ref.current?.scrollTo({ top: 0 });
        }}
      >
        <TabsList className="w-full">
          {TABS.map(({ id, label, icon: Icon }) => (
            <TabsTrigger key={id} value={id}>
              <Icon />
              {t(label)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="inspect">
          <InspectTab />
        </TabsContent>
        <TabsContent value="brightness">
          {tab === "brightness" && <BrightnessTab />}
        </TabsContent>
        <TabsContent value="flags">
          <FlagGuideTab />
        </TabsContent>
        <TabsContent value="records">
          <RecordsTab />
        </TabsContent>
        <TabsContent value="provenance">
          <ProvenanceTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
