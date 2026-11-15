"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, ErrorBar, ReferenceArea, Scatter, ScatterChart, XAxis, YAxis } from "recharts";
import { PlayIcon, SquareIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SPECTRAL_FEATURES } from "@/app/_lib/comet/published";
import type { ObservationEntry, PhotometryResult } from "@/app/_lib/comet/types";
import { useT } from "@/app/_i18n/i18n-provider";
import { formatUtc, PERIOD_LABEL, useCometState } from "./comet-state";
import { REASON_LABEL } from "./image-explorer";
import { decodeFrame, measure, useFrameBatch, type BatchItem } from "./use-comet-data";

/** Picks `n` exposures spread evenly in time, balanced across the six detectors. */
function representativeSample(entries: ObservationEntry[], n: number): ObservationEntry[] {
  if (n >= entries.length) return entries;
  const byDetector = new Map<string, ObservationEntry[]>();
  for (const e of entries) byDetector.set(e.detector, [...(byDetector.get(e.detector) ?? []), e]);
  const perDetector = Math.max(1, Math.ceil(n / byDetector.size));
  const picked: ObservationEntry[] = [];
  for (const list of byDetector.values()) {
    const k = Math.min(perDetector, list.length);
    for (let i = 0; i < k; i++) picked.push(list[Math.round((i * (list.length - 1)) / Math.max(1, k - 1))]);
  }
  return [...new Set(picked)].sort((a, b) => a.mjdMid - b.mjdMid);
}

interface Point extends PhotometryResult {
  key: string;
  entry: ObservationEntry;
}

const chartConfig = {
  ok: { label: "Measurement", color: "var(--series-1)" },
  flagged: { label: "Quality flag", color: "var(--muted-foreground)" },
} satisfies ChartConfig;

export function SpectrumExplorer({ onPick }: { onPick: () => void }) {
  const t = useT();
  const { entries, period, aperture, selectKey } = useCometState();
  const [sampleSize, setSampleSize] = useState(12);
  const [includeFlagged, setIncludeFlagged] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const batch = useFrameBatch(3);

  const periodEntries = useMemo(() => entries.filter((e) => e.period === period), [entries, period]);
  const done = batch.items.filter((i) => i.state === "done" || i.state === "error").length;
  const measuredPeriod = batch.items[0]?.entry.period;
  const failures = batch.items.filter((i): i is Extract<BatchItem, { state: "error" }> => i.state === "error");

  // Photometry runs in the browser on the in-memory cutouts, so aperture changes apply instantly.
  const points = useMemo<Point[]>(() => {
    const out: Point[] = [];
    for (const it of batch.items) {
      if (it.state !== "done") continue;
      const r = measure(decodeFrame(it.frame), it.entry, aperture);
      if (r && r.wavelengthUm != null) out.push({ ...r, key: it.entry.key, entry: it.entry });
    }
    return out.sort((a, b) => a.wavelengthUm! - b.wavelengthUm!);
  }, [batch.items, aperture]);

  const shown = points.filter((p) => includeFlagged || p.quality === "ok");
  const ok = shown.filter((p) => p.quality === "ok");
  const flagged = shown.filter((p) => p.quality !== "ok");
  const dates = [...new Set(shown.map((p) => p.entry.utcStart.slice(0, 10)))].sort();
  const features = SPECTRAL_FEATURES.filter((f) => f.periods.includes(period));
  const pick = (p: Point) => {
    selectKey(p.key);
    onPick();
  };

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div className="flex flex-wrap items-end gap-4">
        <div className="grid gap-1">
          <Label className="text-xs">{t("comet.toMeasure", { period: t(PERIOD_LABEL[period]) })}</Label>
          <NativeSelect size="sm" value={String(sampleSize)} onChange={(e) => setSampleSize(Number(e.target.value))}>
            <NativeSelectOption value="12">{t("comet.representative", { n: 12 })}</NativeSelectOption>
            <NativeSelectOption value="24">{t("comet.representative", { n: 24 })}</NativeSelectOption>
            <NativeSelectOption value="48">{t("comet.representative", { n: 48 })}</NativeSelectOption>
            <NativeSelectOption value="9999">{t("comet.allSlow", { n: periodEntries.length })}</NativeSelectOption>
          </NativeSelect>
        </div>
        {batch.running ? (
          <Button size="sm" variant="outline" onClick={batch.cancel}>
            <SquareIcon /> {t("comet.stop")}
          </Button>
        ) : (
          <Button size="sm" onClick={() => batch.run(representativeSample(periodEntries, sampleSize))} disabled={periodEntries.length === 0}>
            <PlayIcon /> {t("comet.startMeasuring")}
          </Button>
        )}
        <ApertureControls />
      </div>

      {batch.items.length > 0 && (
        <div className="grid gap-1">
          <Progress value={(done / batch.items.length) * 100} />
          <span className="text-xs text-muted-foreground">
            {t("comet.imagesRead", { done, total: batch.items.length, failed: failures.length })}
            {failures.length > 0 &&
              ` ${t("comet.failExample", { obsId: failures[0].entry.obsId, detector: failures[0].entry.detector, message: failures[0].message })}`}
            {measuredPeriod && measuredPeriod !== period && ` · ${t("comet.otherPeriod")}`}
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">{t("comet.spectrumHeading")}</h3>
          <p className="text-xs text-muted-foreground">
            {dates.length > 0
              ? t("comet.spectrumSummary", {
                  points: shown.length,
                  exposures: new Set(shown.map((p) => p.entry.obsId)).size,
                  from: dates[0],
                  to: dates.at(-1) ?? "",
                })
              : t("comet.spectrumHelp")}
          </p>
        </div>
        <div className="flex gap-4">
          <Label className="flex items-center gap-2 text-xs font-normal">
            <Switch size="sm" checked={includeFlagged} onCheckedChange={setIncludeFlagged} /> {t("comet.includeFlagged")}
          </Label>
          <Label className="flex items-center gap-2 text-xs font-normal">
            <Switch size="sm" checked={showTable} onCheckedChange={setShowTable} /> {t("comet.showTable")}
          </Label>
        </div>
      </div>

      <ChartContainer config={chartConfig} className="aspect-[16/8] w-full">
        <ScatterChart margin={{ top: 24, right: 12, bottom: 20, left: 4 }}>
          <CartesianGrid vertical={false} />
          {features.map((f) => (
            <ReferenceArea
              key={f.id}
              x1={f.min}
              x2={f.max}
              fill="currentColor"
              fillOpacity={0.07}
              ifOverflow="extendDomain"
              label={{ value: f.label, position: "insideTop", fontSize: 10, fill: "var(--muted-foreground)" }}
            />
          ))}
          <XAxis
            type="number"
            dataKey="wavelengthUm"
            domain={[0.7, 5.1]}
            ticks={[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]}
            tickLine={false}
            label={{ value: t("comet.axisWavelength"), position: "insideBottom", offset: -12, fontSize: 11 }}
          />
          <YAxis type="number" dataKey="fluxMjy" tickLine={false} axisLine={false} width={48} label={{ value: "mJy", angle: -90, position: "insideLeft", fontSize: 11 }} />
          <ChartTooltip cursor={false} content={<PointTooltip />} />
          <Scatter name="ok" data={ok} fill="var(--color-ok)" onClick={(d) => pick(d.payload as Point)} className="cursor-pointer">
            <ErrorBar dataKey="errorMjy" direction="y" width={0} stroke="var(--color-ok)" strokeOpacity={0.6} />
          </Scatter>
          <Scatter
            name="flagged"
            data={flagged}
            fill="transparent"
            stroke="var(--color-flagged)"
            onClick={(d) => pick(d.payload as Point)}
            className="cursor-pointer"
          >
            <ErrorBar dataKey="errorMjy" direction="y" width={0} stroke="var(--color-flagged)" strokeOpacity={0.5} />
          </Scatter>
        </ScatterChart>
      </ChartContainer>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[var(--series-1)]" /> {t("comet.legendMeasurement")}</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full border border-muted-foreground" /> {t("comet.legendFlagged")}</span>
        <span>{t("comet.legendNote")}</span>
      </div>

      {showTable && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>UTC</TableHead>
                <TableHead>{t("comet.colObservation")}</TableHead>
                <TableHead className="text-right">λ (µm)</TableHead>
                <TableHead className="text-right">Δλ</TableHead>
                <TableHead className="text-right">{t("comet.colFlux")}</TableHead>
                <TableHead className="text-right">S/N</TableHead>
                <TableHead>{t("comet.quality")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((p) => (
                <TableRow key={p.key} className="cursor-pointer font-mono text-xs" onClick={() => pick(p)}>
                  <TableCell>{formatUtc(p.entry.utcStart)}</TableCell>
                  <TableCell>{p.entry.obsId} {p.entry.detector}</TableCell>
                  <TableCell className="text-right">{p.wavelengthUm!.toFixed(3)}</TableCell>
                  <TableCell className="text-right">{p.bandwidthUm?.toFixed(3)}</TableCell>
                  <TableCell className="text-right">{p.fluxMjy.toFixed(2)} ± {p.errorMjy.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{p.snr.toFixed(1)}</TableCell>
                  <TableCell>{p.reasons.map((r) => t(REASON_LABEL[r])).join(", ") || t("comet.qualityGood")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function ApertureControls() {
  const t = useT();
  const { aperture, setAperture } = useCometState();
  return (
      <div className="flex flex-wrap items-end gap-4">
        <RangeField label={t("comet.apertureRadius", { r: aperture.rAp })} min={1} max={8} step={0.5} value={aperture.rAp} onChange={(v) => setAperture({ ...aperture, rAp: v })} />
        <RangeField
          label={t("comet.backgroundAnnulus", { rIn: aperture.rIn, rOut: aperture.rOut })}
          min={aperture.rAp + 2}
          max={34}
          step={1}
          value={[aperture.rIn, aperture.rOut]}
          onChange={(v) => setAperture({ ...aperture, rIn: v[0], rOut: v[1] })}
        />
        <Label className="flex items-center gap-2 text-xs font-normal">
          <Switch
            size="sm"
            checked={aperture.maskSourcesInAnnulus}
            onCheckedChange={(v) => setAperture({ ...aperture, maskSourcesInAnnulus: v })}
          />
          {t("comet.excludeSource")}
        </Label>
        <Badge variant="outline">{t("comet.paperSetting")}</Badge>
      </div>
  );
}

function RangeField<T extends number | number[]>(props: { label: string; min: number; max: number; step: number; value: T; onChange: (v: T) => void }) {
  return (
    <div className="grid w-40 gap-2">
      <Label className="text-xs">{props.label}</Label>
      <Slider
        min={props.min}
        max={props.max}
        step={props.step}
        value={Array.isArray(props.value) ? props.value : [props.value]}
        onValueChange={(v) => {
          const arr = Array.isArray(v) ? v : [v];
          props.onChange((Array.isArray(props.value) ? arr : arr[0]) as T);
        }}
      />
    </div>
  );
}

function PointTooltip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  const t = useT();
  const p = active ? payload?.[0]?.payload : undefined;
  if (!p) return null;
  return (
    <div className="grid gap-0.5 rounded-md border bg-background px-2.5 py-1.5 text-xs shadow-md">
      <span className="font-medium">{formatUtc(p.entry.utcStart)}</span>
      <span className="text-muted-foreground">{p.entry.obsId} · {p.entry.detector}</span>
      <span className="font-mono">λ {p.wavelengthUm!.toFixed(3)} µm (Δλ {p.bandwidthUm?.toFixed(3)})</span>
      <span className="font-mono">{p.fluxMjy.toFixed(2)} ± {p.errorMjy.toFixed(2)} mJy · S/N {p.snr.toFixed(1)}</span>
      {p.reasons.length > 0 && <span className="text-muted-foreground">{p.reasons.map((r) => t(REASON_LABEL[r])).join(", ")}</span>}
    </div>
  );
}
