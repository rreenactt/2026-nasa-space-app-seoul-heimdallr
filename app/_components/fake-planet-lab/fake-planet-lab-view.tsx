"use client";

import { useRef, useState } from "react";
import { BookOpenIcon, ClipboardListIcon, MicroscopeIcon, ScrollTextIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFixedTarget } from "../analyses/fixed-target";
import { FPL_EXAMPLES, FplStateProvider, useFpl, type FplTarget } from "./fpl-state";
import { FlagGuideTab, ProvenanceTab, RecordsTab } from "./guide-tabs";
import { InspectTab } from "./inspect-tab";

type Tab = "inspect" | "flags" | "records" | "provenance";
const TABS: { id: Tab; label: string; icon: React.ComponentType }[] = [
  { id: "inspect", label: "Inspect", icon: MicroscopeIcon },
  { id: "flags", label: "Flag guide", icon: BookOpenIcon },
  { id: "records", label: "Records", icon: ClipboardListIcon },
  { id: "provenance", label: "Provenance", icon: ScrollTextIcon },
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
  const { target, setTarget } = useFpl();
  const [ra, setRa] = useState(target.ra.toFixed(5));
  const [dec, setDec] = useState(target.dec.toFixed(5));
  const example = FPL_EXAMPLES.find((e) => e.name === target.name);
  return (
    <div className="grid gap-2 rounded-lg border bg-muted/30 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1">
          <Label className="text-xs">Example</Label>
          <NativeSelect
            size="sm"
            value={example?.name ?? ""}
            onChange={(e) => {
              const t = FPL_EXAMPLES.find((x) => x.name === e.target.value);
              if (!t) return;
              setTarget(t);
              setRa(t.ra.toFixed(5));
              setDec(t.dec.toFixed(5));
            }}
          >
            <NativeSelectOption value="">Custom position</NativeSelectOption>
            {FPL_EXAMPLES.map((e) => (
              <NativeSelectOption key={e.name} value={e.name}>
                {e.name}
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
          Go
        </Button>
      </div>
      {example?.note && <p className="text-xs text-muted-foreground">{example.note}</p>}
    </div>
  );
}

function Body() {
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
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="inspect">
          <InspectTab />
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
