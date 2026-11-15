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
import { useT } from "@/app/_i18n/i18n-provider";
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
    <ul className="grid max-h-[min(52dvh,32rem)] content-start gap-0.5 overflow-y-auto pr-1 text-xs">
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
  const t = useT();
  const { year, setYear, mode, setMode } = useNim();
  const r = RANGES[mode];
  return (
    <div className="grid gap-2 border-b pb-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup variant="outline" size="sm" spacing={0} value={[mode]} onValueChange={(v) => v[0] && setMode(v[0] as RangeMode)}>
          <ToggleGroupItem value="near">{t("nim.modeNear")}</ToggleGroupItem>
          <ToggleGroupItem value="extrapolation">{t("nim.modeExtrapolation")}</ToggleGroupItem>
        </ToggleGroup>
        <span className="font-mono text-sm">{formatYear(year)}</span>
        <Button size="xs" variant="ghost" onClick={() => setYear(2025.8)}>{t("nim.now")}</Button>
        <span className="text-muted-foreground">{t(r.label)}</span>
      </div>
      <Slider min={r.min} max={r.max} step={r.step} value={[year]} onValueChange={(v) => setYear(Array.isArray(v) ? v[0] : v)} aria-label={t("nim.year")} />
      {mode === "extrapolation" && (
        <p className="text-amber-700 dark:text-amber-400">{t("nim.extrapolationWarning")}</p>
      )}
    </div>
  );
}

function Body() {
  const t = useT();
  const { catalog, selected, models, objects, selectedId, setSelectedId, year, mode, showUncertainty, setShowUncertainty, assumedRv, focusNote } = useNim();
  const [tab, setTab] = useState("map");
  const [hover, setHover] = useState<string | null>(null);
  const m = selected ? models.get(selected.id) : undefined;
  const predicted = useMemo(() => (m ? skyAt(m, 2025.8) : null), [m]);
  const search = useSpherexSearch(predicted?.ra ?? 0, predicted?.dec ?? 0);
  const observationYears = (search.data?.exposures ?? []).map((e) => mjdToDecimalYear((e.tStart + e.tEnd) / 2));
  const hovered = objects.find((o) => o.id === hover);

  if (catalog.isPending) return <p className="flex items-center gap-2 py-8 text-muted-foreground"><Spinner /> {t("nim.loadingCatalog")}</p>;
  if (catalog.isError) return <p className="py-8 text-destructive">{t("nim.catalogFailed", { message: catalog.error.message })}</p>;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
      {focusNote && <p className="text-xs text-muted-foreground">{t(focusNote.key, focusNote.values)}</p>}
      <TimeBar />
      <div className="grid gap-3 md:grid-cols-[14rem_minmax(0,1fr)]">
        <div className="grid content-start gap-2">
          <ObjectList />
          <div className="grid gap-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: STATUS_COLOR["full-3d"] }} /> {t("nim.legendFull3d")}</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: STATUS_COLOR["assumed-rv"] }} /> {t("nim.legendAssumedRv")}</span>
          </div>
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
          <TabsList className="w-full">
            <TabsTrigger value="map"><BoxIcon /> {t("nim.tabMap")}</TabsTrigger>
            <TabsTrigger value="sky"><GlobeIcon /> {t("nim.tabSky")}</TabsTrigger>
            <TabsTrigger value="spherex"><TelescopeIcon /> SPHEREx</TabsTrigger>
            <TabsTrigger value="data"><DatabaseIcon /> {t("nim.tabData")}</TabsTrigger>
          </TabsList>
          <TabsContent value="map">
            <div className="relative mt-2 h-[min(52dvh,32rem)] w-full overflow-hidden rounded-md border">
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
                {t("nim.mapLegend")}
              </div>
            </div>
            <Label className="mt-2 flex items-center gap-2 text-xs font-normal">
              <Switch size="sm" checked={showUncertainty} onCheckedChange={setShowUncertainty} />
              {t("nim.showSpread")}
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
