"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PERIODS } from "@/app/_lib/comet/published";
import type { PeriodId } from "@/app/_lib/comet/types";
import { useT } from "@/app/_i18n/i18n-provider";
import { formatUtc, PERIOD_LABEL, useCometState, type DetectorFilter } from "./comet-state";

const DETECTORS: DetectorFilter[] = ["all", "D1", "D2", "D3", "D4", "D5", "D6"];

/** Shared observation picker: period, detector, and a date slider over the actual exposures. */
export function ObservationTimeline() {
  const t = useT();
  const { period, setPeriod, detector, setDetector, visible, selected, selectKey } = useCometState();
  const index = selected ? Math.max(0, visible.findIndex((e) => e.key === selected.key)) : 0;
  const go = (i: number) => {
    const e = visible[Math.min(visible.length - 1, Math.max(0, i))];
    if (e) selectKey(e.key);
  };

  return (
    <div className="grid gap-x-4 gap-y-2 border-b pb-3 @3xl:grid-cols-[auto_minmax(0,1fr)] @3xl:items-center">
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          variant="outline"
          size="sm"
          spacing={0}
          value={[period]}
          onValueChange={(v) => v[0] && setPeriod(v[0] as PeriodId)}
          aria-label={t("comet.periodAria")}
        >
          {(Object.keys(PERIODS) as PeriodId[]).map((p) => (
            <ToggleGroupItem key={p} value={p}>
              {t(PERIOD_LABEL[p])}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <NativeSelect size="sm" value={detector} onChange={(e) => setDetector(e.target.value as DetectorFilter)} aria-label={t("comet.detectorAria")}>
          {DETECTORS.map((d) => (
            <NativeSelectOption key={d} value={d}>
              {d === "all" ? t("comet.allDetectors") : t("comet.detectorOption", { detector: d })}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <span className="text-xs text-muted-foreground">{t("comet.entries", { n: visible.length })}</span>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon-sm" onClick={() => go(index - 1)} disabled={index <= 0} aria-label={t("comet.prevObservation")}>
          <ChevronLeftIcon />
        </Button>
        <Slider
          min={0}
          max={Math.max(0, visible.length - 1)}
          value={[index]}
          onValueChange={(v) => go(Array.isArray(v) ? v[0] : v)}
          disabled={visible.length < 2}
          aria-label={t("comet.observationTime")}
        />
        <Button variant="outline" size="icon-sm" onClick={() => go(index + 1)} disabled={index >= visible.length - 1} aria-label={t("comet.nextObservation")}>
          <ChevronRightIcon />
        </Button>
      </div>

      {selected && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground @3xl:col-span-2">
          <span className="text-foreground">{formatUtc(selected.utcStart)}</span>
          <span>{selected.obsId}</span>
          <span>{selected.detector}</span>
          <span>{t("comet.detectorRange", { min: selected.emMinUm.toFixed(2), max: selected.emMaxUm.toFixed(2) })}</span>
          <span>{t("comet.cometPosition", { ra: selected.cometRa.toFixed(4), dec: selected.cometDec.toFixed(4) })}</span>
        </div>
      )}
    </div>
  );
}
