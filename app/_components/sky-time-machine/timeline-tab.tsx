"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, DownloadCloudIcon, PauseIcon, PlayIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { MISSION_ORDER, MISSIONS } from "@/app/_lib/sky/missions";
import { mjdToYear } from "@/app/_lib/sky/wcs";
import type { Epoch } from "@/app/_lib/sky/types";
import { useT } from "@/app/_i18n/i18n-provider";
import { FrameView } from "./frame-view";
import { formatElapsed, formatPeriod, MISSION_COLOR, useStm } from "./stm-state";
import { fetchEpochFrame, frameKey, useEpochFrame, useLoadedFrames, usePrefetchFrames } from "./use-sky-data";

/** Time-proportional lanes, one per mission; a stop's width spans its real observing window. */
export function TimelineStrip({ value, onSelect, highlight }: { value?: string | null; onSelect: (e: Epoch) => void; highlight?: string[] }) {
  const t = useT();
  const { epochs, grid } = useStm();
  const loadedFrames = useLoadedFrames(epochs, grid);
  const lanes = MISSION_ORDER.filter((m) => epochs.some((e) => e.mission === m));
  if (!epochs.length) return <p className="text-xs text-muted-foreground">{t("stm.noEpochs")}</p>;
  const y0 = Math.floor(mjdToYear(epochs[0].timeStart)) - 0.5;
  const y1 = Math.ceil(mjdToYear(epochs[epochs.length - 1].timeEnd)) + 0.5;
  const W = 1000;
  const laneH = 22;
  const left = 70;
  const H = lanes.length * laneH + 22;
  const x = (mjd: number) => left + ((mjdToYear(mjd) - y0) / (y1 - y0)) * (W - left - 8);
  const ticks = [];
  for (let y = Math.ceil(y0); y <= y1; y += y1 - y0 > 15 ? 5 : 1) ticks.push(y);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[420px]" role="group" aria-label={t("stm.timelineLabel")}>
        {ticks.map((tick) => {
          const tx = left + ((tick - y0) / (y1 - y0)) * (W - left - 8);
          return (
            <g key={tick}>
              <line x1={tx} x2={tx} y1={0} y2={H - 18} className="stroke-border" />
              <text x={tx} y={H - 5} textAnchor="middle" className="fill-muted-foreground text-[11px]">{tick}</text>
            </g>
          );
        })}
        {lanes.map((m, li) => (
          <g key={m}>
            <text x={left - 8} y={li * laneH + 15} textAnchor="end" className="fill-foreground text-[11px]">{MISSIONS[m].label}</text>
            {epochs
              .filter((e) => e.mission === m)
              .map((e) => {
                const xs = x(e.timeStart);
                const w = Math.max(5, x(e.timeEnd) - xs);
                const selected = e.id === value;
                const loaded = loadedFrames.get(e.id) !== undefined;
                const hl = highlight?.includes(e.id);
                return (
                  <rect
                    key={e.id}
                    x={xs}
                    y={li * laneH + 4}
                    width={w}
                    height={laneH - 8}
                    rx={2}
                    fill={MISSION_COLOR[m]}
                    fillOpacity={loaded ? 1 : 0.45}
                    stroke={selected || hl ? "var(--foreground)" : "none"}
                    strokeWidth={2}
                    className="cursor-pointer"
                    onClick={() => onSelect(e)}
                  >
                    <title>{t("stm.barTitle", { mission: MISSIONS[m].label, band: e.band, period: formatPeriod(e.timeStart, e.timeEnd), n: e.totalExposures })}</title>
                  </rect>
                );
              })}
          </g>
        ))}
      </svg>
      <p className="text-[11px] text-muted-foreground">{t("stm.timelineLegend")}</p>
    </div>
  );
}

export function TimelineTab() {
  const t = useT();
  const { epochs, current, setCurrentId, grid } = useStm();
  const [playing, setPlaying] = useState(false);
  const [interval, setIntervalMs] = useState(1500);
  const prefetch = usePrefetchFrames(grid);
  const qc = useQueryClient();
  const idx = current ? epochs.findIndex((e) => e.id === current.id) : -1;
  const frame = useEpochFrame(current, grid);
  const prev = idx > 0 ? epochs[idx - 1] : undefined;

  // Prefetch the next stop so playback does not stall.
  useEffect(() => {
    const nxt = epochs[idx + 1];
    if (nxt) void qc.prefetchQuery({ queryKey: frameKey(nxt.id, grid), queryFn: () => fetchEpochFrame(nxt, grid), retry: false, staleTime: Infinity });
  }, [idx, epochs, grid, qc]);

  // Advance only once the current frame has arrived (or failed).
  useEffect(() => {
    if (!playing || frame.isPending) return;
    const timer = setTimeout(() => {
      const nxt = epochs[(idx + 1) % epochs.length];
      if (nxt) setCurrentId(nxt.id);
    }, interval);
    return () => clearTimeout(timer);
  }, [playing, frame.isPending, idx, epochs, interval, setCurrentId]);

  const elapsed = useMemo(() => (current && prev ? current.timeStart - prev.timeStart : null), [current, prev]);

  return (
    <div className="grid gap-x-5 gap-y-3 pt-2 @3xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] @3xl:items-start">
      <FrameView epoch={current} />
      <div className="grid min-w-0 gap-3">
      <TimelineStrip value={current?.id} onSelect={(e) => setCurrentId(e.id)} />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="icon-sm" variant="outline" disabled={idx <= 0} onClick={() => prev && setCurrentId(prev.id)} aria-label={t("stm.prevDate")}>
          <ChevronLeftIcon />
        </Button>
        <Button size="sm" onClick={() => setPlaying(!playing)} disabled={epochs.length < 2}>
          {playing ? <PauseIcon /> : <PlayIcon />} {playing ? t("stm.stop") : t("stm.playInOrder")}
        </Button>
        <Button size="icon-sm" variant="outline" disabled={idx >= epochs.length - 1} onClick={() => setCurrentId(epochs[idx + 1].id)} aria-label={t("stm.nextDate")}>
          <ChevronRightIcon />
        </Button>
        <NativeSelect size="sm" value={String(interval)} onChange={(e) => setIntervalMs(Number(e.target.value))} aria-label={t("stm.playbackInterval")}>
          <NativeSelectOption value="700">{t("stm.speedFast")}</NativeSelectOption>
          <NativeSelectOption value="1500">{t("stm.speedNormal")}</NativeSelectOption>
          <NativeSelectOption value="3000">{t("stm.speedSlow")}</NativeSelectOption>
        </NativeSelect>
        {prefetch.running ? (
          <Button size="sm" variant="outline" onClick={prefetch.stop}>{t("stm.stopPreload")}</Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => prefetch.start(epochs)} disabled={!epochs.length}>
            <DownloadCloudIcon /> {t("stm.preloadAll")}
          </Button>
        )}
        <span className="text-xs text-muted-foreground">
          {idx + 1} / {epochs.length}
        </span>
      </div>
      {prefetch.total > 0 && (
        <div className="grid gap-1">
          <Progress value={(prefetch.done / prefetch.total) * 100} />
          <span className="text-xs text-muted-foreground">{t("stm.imagesReady", { done: prefetch.done, total: prefetch.total })}</span>
        </div>
      )}

        {current && (
          <dl className="grid content-start gap-x-3 gap-y-1 text-xs [grid-template-columns:auto_1fr]">
            <dt className="text-muted-foreground">{t("stm.telescope")}</dt>
            <dd>{MISSIONS[current.mission].label}</dd>
            <dt className="text-muted-foreground">{t("stm.band")}</dt>
            <dd>
              {current.wavelengthLabel}
              {frame.data?.wavelengthUm != null && <span className="font-mono"> · {t("stm.atPosition", { um: frame.data.wavelengthUm.toFixed(3) })}</span>}
            </dd>
            <dt className="text-muted-foreground">{t("stm.observationPeriod")}</dt>
            <dd className="font-mono">{formatPeriod(frame.data?.timeStart ?? current.timeStart, frame.data?.timeEnd ?? current.timeEnd)}</dd>
            <dt className="text-muted-foreground">{t("stm.sincePrevious")}</dt>
            <dd>{elapsed != null ? formatElapsed(elapsed, t) : "—"}</dd>
            <dt className="text-muted-foreground">{t("stm.image")}</dt>
            <dd>{frame.data?.combine ?? t("stm.toBeUsed", { n: current.exposures.length, total: current.totalExposures })}</dd>
            <dt className="text-muted-foreground">{t("stm.sourcePixel")}</dt>
            <dd>{frame.data ? t("stm.sourcePixelValue", { px: frame.data.sourcePixelArcsec.toFixed(2), grid: ((grid.fovArcmin * 60) / grid.n).toFixed(2) }) : "—"}</dd>
            <dt className="text-muted-foreground">{t("stm.validCoverage")}</dt>
            <dd>{frame.data ? `${(frame.data.coverage * 100).toFixed(0)}%` : "—"}</dd>
            {frame.data && frame.data.failed.length > 0 && (
              <>
                <dt className="text-muted-foreground">{t("stm.exposuresNotLoaded")}</dt>
                <dd>{frame.data.failed.length} ({frame.data.failed[0].reason})</dd>
              </>
            )}
          </dl>
        )}
      <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
        <Badge variant="outline">{t("stm.badgeBrightness")}</Badge>
        <Badge variant="outline">{t("stm.badgeGrid")}</Badge>
        <Badge variant="outline">{t("stm.badgeHatched")}</Badge>
      </div>
      </div>
    </div>
  );
}

