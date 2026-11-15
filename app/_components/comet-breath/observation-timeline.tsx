"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PERIODS } from "@/app/_lib/comet/published";
import type { PeriodId } from "@/app/_lib/comet/types";
import { formatUtc, useCometState, type DetectorFilter } from "./comet-state";

const DETECTORS: DetectorFilter[] = ["all", "D1", "D2", "D3", "D4", "D5", "D6"];

/** Shared observation picker: period, detector, and a date slider over the actual exposures. */
export function ObservationTimeline() {
  const { period, setPeriod, detector, setDetector, visible, selected, selectKey } = useCometState();
  const index = selected ? Math.max(0, visible.findIndex((e) => e.key === selected.key)) : 0;
  const go = (i: number) => {
    const e = visible[Math.min(visible.length - 1, Math.max(0, i))];
    if (e) selectKey(e.key);
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          variant="outline"
          size="sm"
          spacing={0}
          value={[period]}
          onValueChange={(v) => v[0] && setPeriod(v[0] as PeriodId)}
          aria-label="Observation period"
        >
          {(Object.keys(PERIODS) as PeriodId[]).map((p) => (
            <ToggleGroupItem key={p} value={p}>
              {PERIODS[p].label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <NativeSelect size="sm" value={detector} onChange={(e) => setDetector(e.target.value as DetectorFilter)} aria-label="Detector">
          {DETECTORS.map((d) => (
            <NativeSelectOption key={d} value={d}>
              {d === "all" ? "All detectors" : `Detector ${d}`}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <span className="text-xs text-muted-foreground">{visible.length} entries (one file per detector)</span>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon-sm" onClick={() => go(index - 1)} disabled={index <= 0} aria-label="Previous observation">
          <ChevronLeftIcon />
        </Button>
        <Slider
          min={0}
          max={Math.max(0, visible.length - 1)}
          value={[index]}
          onValueChange={(v) => go(Array.isArray(v) ? v[0] : v)}
          disabled={visible.length < 2}
          aria-label="Observation time"
        />
        <Button variant="outline" size="icon-sm" onClick={() => go(index + 1)} disabled={index >= visible.length - 1} aria-label="Next observation">
          <ChevronRightIcon />
        </Button>
      </div>

      {selected && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
          <span className="text-foreground">{formatUtc(selected.utcStart)}</span>
          <span>{selected.obsId}</span>
          <span>{selected.detector}</span>
          <span>
            Detector range {selected.emMinUm.toFixed(2)}–{selected.emMaxUm.toFixed(2)} µm
          </span>
          <span>
            Comet RA {selected.cometRa.toFixed(4)}° Dec {selected.cometDec.toFixed(4)}°
          </span>
        </div>
      )}
    </div>
  );
}
