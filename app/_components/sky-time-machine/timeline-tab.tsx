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
import { FrameView } from "./frame-view";
import { formatElapsed, formatPeriod, MISSION_COLOR, useStm } from "./stm-state";
import { fetchEpochFrame, frameKey, useEpochFrame, useLoadedFrames, usePrefetchFrames } from "./use-sky-data";

/** Time-proportional lanes, one per mission; a stop's width spans its real observing window. */
export function TimelineStrip({ value, onSelect, highlight }: { value?: string | null; onSelect: (e: Epoch) => void; highlight?: string[] }) {
  const { epochs, grid } = useStm();
  const loadedFrames = useLoadedFrames(epochs, grid);
  const lanes = MISSION_ORDER.filter((m) => epochs.some((e) => e.mission === m));
  if (!epochs.length) return <p className="text-xs text-muted-foreground">검색이 끝나면 실제 관측이 있는 시점만 표시됩니다.</p>;
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
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]" role="group" aria-label="관측 타임라인">
        {ticks.map((t) => {
          const tx = left + ((t - y0) / (y1 - y0)) * (W - left - 8);
          return (
            <g key={t}>
              <line x1={tx} x2={tx} y1={0} y2={H - 18} className="stroke-border" />
              <text x={tx} y={H - 5} textAnchor="middle" className="fill-muted-foreground text-[11px]">{t}</text>
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
                    <title>{`${MISSIONS[m].label} ${e.band} · ${formatPeriod(e.timeStart, e.timeEnd)} · 노출 ${e.totalExposures}장`}</title>
                  </rect>
                );
              })}
          </g>
        ))}
      </svg>
      <p className="text-[11px] text-muted-foreground">막대 = 실제 관측 기간(관측이 없는 해는 비어 있음) · 진한 막대 = 영상 받음 · 연한 막대 = 아직 받지 않음</p>
    </div>
  );
}

export function TimelineTab() {
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
    const t = setTimeout(() => {
      const nxt = epochs[(idx + 1) % epochs.length];
      if (nxt) setCurrentId(nxt.id);
    }, interval);
    return () => clearTimeout(t);
  }, [playing, frame.isPending, idx, epochs, interval, setCurrentId]);

  const elapsed = useMemo(() => (current && prev ? current.timeStart - prev.timeStart : null), [current, prev]);

  return (
    <div className="grid gap-3 pt-2">
      <TimelineStrip value={current?.id} onSelect={(e) => setCurrentId(e.id)} />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="icon-sm" variant="outline" disabled={idx <= 0} onClick={() => prev && setCurrentId(prev.id)} aria-label="이전 시점">
          <ChevronLeftIcon />
        </Button>
        <Button size="sm" onClick={() => setPlaying(!playing)} disabled={epochs.length < 2}>
          {playing ? <PauseIcon /> : <PlayIcon />} {playing ? "정지" : "시간순 재생"}
        </Button>
        <Button size="icon-sm" variant="outline" disabled={idx >= epochs.length - 1} onClick={() => setCurrentId(epochs[idx + 1].id)} aria-label="다음 시점">
          <ChevronRightIcon />
        </Button>
        <NativeSelect size="sm" value={String(interval)} onChange={(e) => setIntervalMs(Number(e.target.value))} aria-label="재생 간격">
          <NativeSelectOption value="700">빠르게 (0.7초)</NativeSelectOption>
          <NativeSelectOption value="1500">보통 (1.5초)</NativeSelectOption>
          <NativeSelectOption value="3000">느리게 (3초)</NativeSelectOption>
        </NativeSelect>
        {prefetch.running ? (
          <Button size="sm" variant="outline" onClick={prefetch.stop}>미리 받기 중지</Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => prefetch.start(epochs)} disabled={!epochs.length}>
            <DownloadCloudIcon /> 모든 시점 미리 받기
          </Button>
        )}
        <span className="text-xs text-muted-foreground">
          {idx + 1} / {epochs.length}
        </span>
      </div>
      {prefetch.total > 0 && (
        <div className="grid gap-1">
          <Progress value={(prefetch.done / prefetch.total) * 100} />
          <span className="text-xs text-muted-foreground">영상 준비 {prefetch.done}/{prefetch.total} (시점당 수 초 — IRSA에서 매번 새로 받습니다)</span>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_16rem]">
        <FrameView epoch={current} />
        {current && (
          <dl className="grid content-start gap-x-3 gap-y-1 text-xs [grid-template-columns:auto_1fr]">
            <dt className="text-muted-foreground">망원경</dt>
            <dd>{MISSIONS[current.mission].label}</dd>
            <dt className="text-muted-foreground">대역</dt>
            <dd>
              {current.wavelengthLabel}
              {frame.data?.wavelengthUm != null && <span className="font-mono"> · 이 위치 {frame.data.wavelengthUm.toFixed(3)} µm</span>}
            </dd>
            <dt className="text-muted-foreground">관측 기간</dt>
            <dd className="font-mono">{formatPeriod(frame.data?.timeStart ?? current.timeStart, frame.data?.timeEnd ?? current.timeEnd)}</dd>
            <dt className="text-muted-foreground">이전 시점부터</dt>
            <dd>{elapsed != null ? formatElapsed(elapsed) : "—"}</dd>
            <dt className="text-muted-foreground">영상</dt>
            <dd>{frame.data?.combine ?? `${current.exposures.length}장 사용 예정 (통과 내 ${current.totalExposures}장)`}</dd>
            <dt className="text-muted-foreground">원본 픽셀</dt>
            <dd>{frame.data ? `${frame.data.sourcePixelArcsec.toFixed(2)}″ (표시 격자 ${((grid.fovArcmin * 60) / grid.n).toFixed(2)}″)` : "—"}</dd>
            <dt className="text-muted-foreground">유효 영역</dt>
            <dd>{frame.data ? `${(frame.data.coverage * 100).toFixed(0)}%` : "—"}</dd>
            {frame.data && frame.data.failed.length > 0 && (
              <>
                <dt className="text-muted-foreground">받지 못한 노출</dt>
                <dd>{frame.data.failed.length}장 ({frame.data.failed[0].reason})</dd>
              </>
            )}
          </dl>
        )}
      </div>
      <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
        <Badge variant="outline">밝기는 프레임마다 따로 맞춤 — 미션 간 밝기 비교 불가</Badge>
        <Badge variant="outline">모든 프레임이 같은 하늘 좌표 · 북쪽 위 · 동쪽 왼쪽</Badge>
        <Badge variant="outline">빗금 = 자료 없음</Badge>
      </div>
    </div>
  );
}

