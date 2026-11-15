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
        : "Could not find a centroid. The star's center may be saturated (hatched) or there are too few bright pixels nearby. Your marked position is used as is.",
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
            <li>Pick a date on the timeline, then click an object in the image.</li>
            <li>If needed, use &lsquo;Measure center&rsquo; to compute the brightness centroid.</li>
            <li>Click the same object at another date to compute how far it moved.</li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={measure} disabled={!currentMark || !frame.data}>
              <CrosshairIcon /> Measure center
            </Button>
            <Button size="sm" variant="outline" onClick={() => current && removeMark(current.id)} disabled={!currentMark}>
              Clear mark for this date
            </Button>
            <Button size="sm" variant="ghost" onClick={clearMarks} disabled={!marks.length}>
              <Trash2Icon /> Clear all
            </Button>
          </div>
          {note && <p className="text-amber-600 dark:text-amber-400">{note}</p>}
          <Label className="flex items-center gap-2 font-normal">
            <Switch size="sm" checked={showGaia} onCheckedChange={setShowGaia} />
            Gaia predicted paths (proper motion ≥ 50 mas/yr)
            {showGaia && gaia.isPending && <Spinner className="size-3" />}
          </Label>
          {showGaia && gaia.data && (
            <p className="text-muted-foreground">
              {gaia.data.stars.length
                ? `${gaia.data.stars.length} stars: Gaia DR3 2016.0 position + linear proper motion (parallax and radial velocity ignored). Fastest star ${(Math.hypot(gaia.data.stars[0].pmra, gaia.data.stars[0].pmdec) / 1000).toFixed(2)}″/yr`
                : "No Gaia stars in the field meet this criterion."}
            </p>
          )}
          {showGaia && gaia.isError && <p className="text-destructive">Gaia query failed: {gaia.error.message}</p>}
          <ul className="space-y-1">
            <li className="flex items-center gap-2"><span className="size-3 rounded-full border-2 border-sky-400" /> Your marked position</li>
            <li className="flex items-center gap-2"><span className="font-bold text-yellow-400">+</span> Measured position (brightness centroid)</li>
            <li className="flex items-center gap-2"><span className="size-2.5 rotate-45 border-2 border-violet-400" /> Predicted position / <span className="h-0.5 w-4 bg-violet-400" /> Predicted path</li>
            <li className="flex items-center gap-2"><span className="w-4 border-t-2 border-dashed border-sky-400" /> Line joining marks: unobserved interval, not the actual path</li>
          </ul>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Telescope</TableHead>
                <TableHead>Position (RA, Dec)</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Distance from previous mark</TableHead>
                <TableHead className="text-right">Time between</TableHead>
                <TableHead className="text-right">Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ m, pos, sep, dtYears, epoch }) => (
                <TableRow key={m.epochId} className="font-mono text-xs">
                  <TableCell>{formatDate(m.mjd)}</TableCell>
                  <TableCell className="font-sans">{epoch ? `${MISSIONS[epoch.mission].label} ${epoch.band}` : "—"}</TableCell>
                  <TableCell>{pos.ra.toFixed(5)}, {pos.dec.toFixed(5)}</TableCell>
                  <TableCell className="font-sans">{m.measured ? "Measured" : "Marked"}</TableCell>
                  <TableCell className="text-right">{sep != null ? `${sep.toFixed(1)}″` : "—"}</TableCell>
                  <TableCell className="text-right">{dtYears != null ? `${dtYears.toFixed(2)} yr` : "—"}</TableCell>
                  <TableCell className="text-right">{sep != null && dtYears ? `${(sep / dtYears).toFixed(2)}″/yr` : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {totalSep != null && totalYears > 0 && (
            <p className="mt-2 text-xs">
              First to last: <span className="font-mono">{totalSep.toFixed(1)}″ / {totalYears.toFixed(2)} yr = {(totalSep / totalYears).toFixed(2)}″/yr</span>
              <span className="text-muted-foreground"> · One display grid cell is {scaleArcsec.toFixed(2)}″; the original resolution may be coarser · A position difference alone does not establish a new object, a distance or an orbit.</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
