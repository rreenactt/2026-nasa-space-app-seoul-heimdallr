"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { BoxIcon, DatabaseIcon, GlobeIcon, TelescopeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { mjdToDecimalYear, modelStatus, skyAt } from "@/app/_lib/nim/motion";
import { useSpherexSearch } from "../fake-planet-lab/use-fpl-data";
import { DataTab } from "./data-tab";
import { STATUS_COLOR } from "./map-3d";
import { formatYear, NimStateProvider, RANGES, useNim, type NimFocus, type RangeMode } from "./nim-state";
import { SkyView } from "./sky-view";
import { SpherexTab } from "./spherex-tab";

// three.js touches browser APIs on load.
const Map3D = dynamic(() => import("./map-3d"), { ssr: false });

/**
 * Neighborhood in Motion, shown inside the analysis panel: nearby stars and brown dwarfs placed in 3D from measured
 * distance and motion.
 */
export function NeighborhoodView({ focus }: { focus?: NimFocus }) {
  return (
    <NimStateProvider focus={focus}>
      <Body />
    </NimStateProvider>
  );
}

function ObjectList() {
  const { objects, selectedId, setSelectedId, models, year } = useNim();
  return (
    <ul className="grid max-h-[60dvh] content-start gap-0.5 overflow-y-auto pr-1 text-xs">
      {objects.map((o) => {
        const st = modelStatus(o).level;
        const d = models.get(o.id) ? skyAt(models.get(o.id)!, year).distancePc : NaN;
        return (
          <li key={o.id}>
            <button
              type="button"
              onClick={() => setSelectedId(o.id)}
              className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left ${o.id === selectedId ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              <span className="size-2 shrink-0 rounded-full" style={{ background: STATUS_COLOR[st] }} />
              <span className="min-w-0 flex-1 truncate">{o.name}</span>
              <span className="font-mono opacity-70">{d.toFixed(2)} pc</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function TimeBar() {
  const { year, setYear, mode, setMode } = useNim();
  const r = RANGES[mode];
  return (
    <div className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup variant="outline" size="sm" spacing={0} value={[mode]} onValueChange={(v) => v[0] && setMode(v[0] as RangeMode)}>
          <ToggleGroupItem value="near">Near the observations</ToggleGroupItem>
          <ToggleGroupItem value="extrapolation">Extrapolation</ToggleGroupItem>
        </ToggleGroup>
        <span className="font-mono text-sm">{formatYear(year)}</span>
        <Button size="xs" variant="ghost" onClick={() => setYear(2025.8)}>Now (2025.8)</Button>
        <span className="text-muted-foreground">{r.label}</span>
      </div>
      <Slider min={r.min} max={r.max} step={r.step} value={[year]} onValueChange={(v) => setYear(Array.isArray(v) ? v[0] : v)} aria-label="Year" />
      {mode === "extrapolation" && (
        <p className="text-amber-700 dark:text-amber-400">Educational extrapolation: straight lines over thousands of years ignore the Galaxy&apos;s gravity and companions. Treat positions as illustrative.</p>
      )}
    </div>
  );
}

function Body() {
  const { catalog, selected, models, objects, selectedId, setSelectedId, year, mode, showUncertainty, setShowUncertainty, assumedRv, focusNote } = useNim();
  const [tab, setTab] = useState("map");
  const [hover, setHover] = useState<string | null>(null);
  const m = selected ? models.get(selected.id) : undefined;
  const predicted = useMemo(() => (m ? skyAt(m, 2025.8) : null), [m]);
  const search = useSpherexSearch(predicted?.ra ?? 0, predicted?.dec ?? 0);
  const observationYears = (search.data?.exposures ?? []).map((e) => mjdToDecimalYear((e.tStart + e.tEnd) / 2));
  const hovered = objects.find((o) => o.id === hover);

  if (catalog.isPending) return <p className="flex items-center gap-2 py-8 text-muted-foreground"><Spinner /> Querying Gaia DR3 for stars within about 3.6 pc…</p>;
  if (catalog.isError) return <p className="py-8 text-destructive">Could not load the catalog: {catalog.error.message}</p>;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
      {focusNote && <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs">{focusNote}</p>}
      <TimeBar />
      <div className="grid gap-3 md:grid-cols-[14rem_minmax(0,1fr)]">
        <div className="grid content-start gap-2">
          <ObjectList />
          <div className="grid gap-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: STATUS_COLOR["full-3d"] }} /> All three motions measured</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: STATUS_COLOR["assumed-rv"] }} /> Radial velocity assumed (dashed path)</span>
          </div>
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
          <TabsList className="w-full">
            <TabsTrigger value="map"><BoxIcon /> 3D map</TabsTrigger>
            <TabsTrigger value="sky"><GlobeIcon /> Sky view</TabsTrigger>
            <TabsTrigger value="spherex"><TelescopeIcon /> SPHEREx</TabsTrigger>
            <TabsTrigger value="data"><DatabaseIcon /> Data & model</TabsTrigger>
          </TabsList>
          <TabsContent value="map">
            <div className="relative mt-2 aspect-[16/10] w-full overflow-hidden rounded-md">
              <Map3D
                objects={objects}
                models={models}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onHover={setHover}
                year={year}
                range={RANGES[mode]}
                showUncertainty={showUncertainty}
                assumedRv={assumedRv}
              />
              <div className="pointer-events-none absolute top-2 left-2 rounded bg-black/60 px-2 py-1 font-mono text-[11px] text-white">
                {formatYear(year)} · {(hovered ?? selected)?.name}
                {m && !hovered && ` · ${skyAt(m, year).distancePc.toFixed(3)} pc`}
              </div>
              <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-[11px] text-white/80">
                Sun at centre · rings 1–4 pc in the celestial equator plane · north celestial pole up · grey = past, colour = future (model)
              </div>
            </div>
            <Label className="mt-2 flex items-center gap-2 text-xs font-normal">
              <Switch size="sm" checked={showUncertainty} onCheckedChange={setShowUncertainty} />
              Show the spread of the selected object at this year from measurement errors (pink)
            </Label>
          </TabsContent>
          <TabsContent value="sky">
            <SkyView observationYears={observationYears} />
          </TabsContent>
          <TabsContent value="spherex">
            <SpherexTab search={search} predicted={predicted} />
          </TabsContent>
          <TabsContent value="data">
            <DataTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
