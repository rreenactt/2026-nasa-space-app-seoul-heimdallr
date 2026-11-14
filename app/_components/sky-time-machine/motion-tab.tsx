"use client";

import { useState } from "react";
import { CrosshairIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MISSIONS } from "@/app/_lib/sky/missions";
import { gridScaleDeg, separationArcsec, skyToGrid } from "@/app/_lib/sky/wcs";
import { centroidNear } from "./sky-canvas";
import { FrameView } from "./frame-view";
import { formatDate, useStm } from "./stm-state";
import { TimelineStrip } from "./timeline-tab";
import { frameData, useEpochFrame, useGaia } from "./use-sky-data";

export function MotionTab() {
  const { current, setCurrentId, grid, marks, setMark, removeMark, clearMarks, showGaia, setShowGaia, epochs } = useStm();
  const frame = useEpochFrame(current, grid);
  const gaia = useGaia(grid, showGaia);
  const currentMark = marks.find((m) => m.epochId === current?.id);
  const scaleArcsec = gridScaleDeg(grid) * 3600;
  const [note, setNote] = useState<string | null>(null);

  const measure = () => {
    if (!currentMark || !frame.data) return;
    const data = frameData(frame.data);
    const g = skyToGrid(grid, currentMark.user.ra, currentMark.user.dec);
    if (!g) return;
    // Search radius: ~1.5 source pixels, at least 3 grid pixels.
    const radius = Math.max(3, Math.round((1.5 * frame.data.sourcePixelArcsec) / scaleArcsec));
    const c = centroidNear(grid, data, g.i, g.r, radius);
    setMark({ ...currentMark, measured: c });
    setNote(
      c
        ? null
        : "중심을 찾지 못했습니다. 별 중심이 포화로 가려졌거나(빗금) 주변에 밝은 픽셀이 부족합니다. 사용자 표시 위치를 그대로 씁니다.",
    );
  };

  const rows = marks.map((m, k) => {
    const pos = m.measured ?? m.user;
    const prev = k > 0 ? marks[k - 1] : null;
    const prevPos = prev ? prev.measured ?? prev.user : null;
    const sep = prevPos ? separationArcsec(prevPos.ra, prevPos.dec, pos.ra, pos.dec) : null;
    const dtYears = prev ? (m.mjd - prev.mjd) / 365.25 : null;
    const epoch = epochs.find((e) => e.id === m.epochId);
    return { m, pos, sep, dtYears, epoch };
  });
  const first = rows[0];
  const last = rows[rows.length - 1];
  const totalSep = first && last && first !== last ? separationArcsec(first.pos.ra, first.pos.dec, last.pos.ra, last.pos.dec) : null;
  const totalYears = first && last ? (last.m.mjd - first.m.mjd) / 365.25 : 0;

  return (
    <div className="grid gap-3 pt-2">
      <TimelineStrip value={current?.id} highlight={marks.map((m) => m.epochId)} onSelect={(e) => setCurrentId(e.id)} />
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_18rem]">
        <FrameView
          epoch={current}
          onPick={(p) => {
            if (!current || !frame.data) return;
            setMark({ epochId: current.id, mjd: (frame.data.timeStart + frame.data.timeEnd) / 2, user: { ra: p.ra, dec: p.dec }, measured: null });
            setNote(null);
          }}
        />
        <div className="grid content-start gap-3 text-xs">
          <ol className="list-decimal space-y-1 pl-4 text-muted-foreground">
            <li>타임라인에서 시점을 고르고, 영상에서 천체를 누르세요.</li>
            <li>필요하면 &lsquo;중심 측정&rsquo;으로 밝기 중심을 계산합니다.</li>
            <li>다른 시점에서 같은 천체를 다시 누르면 이동 거리가 계산됩니다.</li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={measure} disabled={!currentMark || !frame.data}>
              <CrosshairIcon /> 중심 측정
            </Button>
            <Button size="sm" variant="outline" onClick={() => current && removeMark(current.id)} disabled={!currentMark}>
              이 시점 표시 지우기
            </Button>
            <Button size="sm" variant="ghost" onClick={clearMarks} disabled={!marks.length}>
              <Trash2Icon /> 전체 지우기
            </Button>
          </div>
          {note && <p className="text-amber-600 dark:text-amber-400">{note}</p>}
          <Label className="flex items-center gap-2 font-normal">
            <Switch size="sm" checked={showGaia} onCheckedChange={setShowGaia} />
            Gaia 예상 경로 (고유운동 ≥ 50 mas/년)
            {showGaia && gaia.isPending && <Spinner className="size-3" />}
          </Label>
          {showGaia && gaia.data && (
            <p className="text-muted-foreground">
              {gaia.data.stars.length
                ? `${gaia.data.stars.length}개 별: Gaia DR3 2016.0 위치 + 선형 고유운동 (시차·시선속도 무시). 가장 빠른 별 ${(Math.hypot(gaia.data.stars[0].pmra, gaia.data.stars[0].pmdec) / 1000).toFixed(2)}″/년`
                : "시야에 조건을 만족하는 Gaia 별이 없습니다."}
            </p>
          )}
          {showGaia && gaia.isError && <p className="text-destructive">Gaia 조회 실패: {gaia.error.message}</p>}
          <ul className="space-y-1">
            <li className="flex items-center gap-2"><span className="size-3 rounded-full border-2 border-sky-400" /> 사용자 표시 위치</li>
            <li className="flex items-center gap-2"><span className="font-bold text-yellow-400">+</span> 측정 위치 (밝기 중심)</li>
            <li className="flex items-center gap-2"><span className="size-2.5 rotate-45 border-2 border-violet-400" /> 예상 위치 / <span className="h-0.5 w-4 bg-violet-400" /> 예상 경로</li>
            <li className="flex items-center gap-2"><span className="w-4 border-t-2 border-dashed border-sky-400" /> 표시 위치 연결 — 관측되지 않은 구간이며 실제 경로가 아님</li>
          </ul>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>시점</TableHead>
                <TableHead>망원경</TableHead>
                <TableHead>위치 (RA, Dec)</TableHead>
                <TableHead>종류</TableHead>
                <TableHead className="text-right">이전 표시와 거리</TableHead>
                <TableHead className="text-right">시간 간격</TableHead>
                <TableHead className="text-right">속도</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ m, pos, sep, dtYears, epoch }) => (
                <TableRow key={m.epochId} className="font-mono text-xs">
                  <TableCell>{formatDate(m.mjd)}</TableCell>
                  <TableCell className="font-sans">{epoch ? `${MISSIONS[epoch.mission].label} ${epoch.band}` : "—"}</TableCell>
                  <TableCell>{pos.ra.toFixed(5)}, {pos.dec.toFixed(5)}</TableCell>
                  <TableCell className="font-sans">{m.measured ? "측정 위치" : "사용자 표시"}</TableCell>
                  <TableCell className="text-right">{sep != null ? `${sep.toFixed(1)}″` : "—"}</TableCell>
                  <TableCell className="text-right">{dtYears != null ? `${dtYears.toFixed(2)}년` : "—"}</TableCell>
                  <TableCell className="text-right">{sep != null && dtYears ? `${(sep / dtYears).toFixed(2)}″/년` : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {totalSep != null && totalYears > 0 && (
            <p className="mt-2 text-xs">
              처음–마지막: <span className="font-mono">{totalSep.toFixed(1)}″ / {totalYears.toFixed(2)}년 = {(totalSep / totalYears).toFixed(2)}″/년</span>
              <span className="text-muted-foreground"> · 표시 격자 한 칸 {scaleArcsec.toFixed(2)}″, 원본 해상도가 더 거칠 수 있음 · 위치 차이만으로 새 천체·거리·궤도를 판정하지 않습니다.</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
