"use client";

import { ExternalLinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MISSION_ORDER, MISSIONS, PROCESSING_VERSION } from "@/app/_lib/sky/missions";
import { formatPeriod, useStm } from "./stm-state";
import { useEpochFrame, useLoadedFrames } from "./use-sky-data";

const LIMITATIONS = [
  "Each WISE/NEOWISE date is a median stack, computed by this tool, of up to 5 single exposures from one visit (every ~6 months, lasting a few days). These are not the official unWISE time-resolved coadds (we could not find a public image path for them).",
  "Quality flags and mask files for WISE single exposures are not used. The median stack removes most cosmic rays and satellite trails, but they may remain in dates built from a single image.",
  "In SPHEREx, the wavelength at this position differs between exposures. The wavelength shown is for the field center, and it can differ between dates even for the same detector number.",
  "SPHEREx OUTLIER flags are not masked, because they can also mark moving objects.",
  "The brightness scale is set separately for each frame. Comparing brightness across missions cannot tell you about variability.",
  "A finer shared grid does not improve resolution (the original pixel size is shown for each date).",
  "The Gaia predicted path applies only linear proper motion from the 2016.0 position (parallax and radial velocity ignored). It may differ from the actual measured position.",
  "A missing object may reflect differences in sensitivity or wavelength; it does not mean the object was absent then and appeared later.",
];

export function EvidenceTab() {
  const { epochs, current, grid, searches, target } = useStm();
  const frame = useEpochFrame(current, grid);
  const loadedFrames = useLoadedFrames(epochs, grid);

  return (
    <div className="grid gap-3 pt-2 text-xs">
      <section className="grid gap-2 rounded-md border p-3">
        <h3 className="text-sm font-medium">① Field shown</h3>
        <p className="font-mono">
          Center RA {target.ra.toFixed(5)}° Dec {target.dec.toFixed(5)}° · Field {target.fovArcmin}′ · Grid {grid.n}×{grid.n} (TAN, north up) · Source {target.source}
        </p>
      </section>

      <section className="grid gap-2 rounded-md border p-3">
        <h3 className="text-sm font-medium">② Search (IRSA SIA2)</h3>
        <ul className="grid gap-1">
          {MISSION_ORDER.map((m, i) => {
            const q = searches[i].data;
            return (
              <li key={m}>
                <span className="font-medium">{MISSIONS[m].label}</span> — {MISSIONS[m].product}
                {q ? (
                  <span className="text-muted-foreground"> · {q.exposureCount} exposures → {q.epochs.length} visits (per band) · {q.collections.join(", ")}</span>
                ) : (
                  <span className="text-muted-foreground"> · {searches[i].isError ? `Failed: ${searches[i].error?.message}` : "Searching"}</span>
                )}
                {q?.queryUrls.map((u) => (
                  <div key={u} className="truncate font-mono text-muted-foreground">
                    <a href={u} target="_blank" rel="noreferrer" className="hover:underline">{u}</a>
                  </div>
                ))}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="grid gap-2 rounded-md border p-3">
        <h3 className="text-sm font-medium">③ Source data for the current date</h3>
        {!current ? (
          "—"
        ) : !frame.data ? (
          <span className="text-muted-foreground">The exposures used will be listed once the image is loaded.</span>
        ) : (
          <>
            <p>
              {MISSIONS[current.mission].label} {current.wavelengthLabel} · {frame.data.combine} · Time span of exposures used{" "}
              <span className="font-mono">{formatPeriod(frame.data.timeStart, frame.data.timeEnd)}</span>
              {frame.data.wavelengthUm != null && <> · Wavelength at field center {frame.data.wavelengthUm.toFixed(3)} µm</>}
            </p>
            <ul className="grid gap-0.5 font-mono">
              {frame.data.used.map((u) => (
                <li key={u.id} className="truncate">
                  MJD {u.mjd.toFixed(4)} ·{" "}
                  <a href={u.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    {u.url.split("/").pop()} <ExternalLinkIcon className="size-3" />
                  </a>
                </li>
              ))}
              {frame.data.failed.map((f) => (
                <li key={f.id} className="truncate text-destructive">Not loaded · {f.id} · {f.reason}</li>
              ))}
            </ul>
            <p className="text-muted-foreground">Processing: {frame.data.processingVersion}</p>
          </>
        )}
      </section>

      <section className="grid gap-2 rounded-md border p-3">
        <h3 className="text-sm font-medium">④ All dates (common format)</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>frame_id</TableHead>
                <TableHead>mission · release</TableHead>
                <TableHead>band</TableHead>
                <TableHead>time_start ~ time_end</TableHead>
                <TableHead>Exposures</TableHead>
                <TableHead>coverage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {epochs.map((e) => {
                const f = loadedFrames.get(e.id);
                return (
                  <TableRow key={e.id} className="font-mono text-[11px]">
                    <TableCell className="max-w-48 truncate">{e.id}</TableCell>
                    <TableCell className="font-sans">{MISSIONS[e.mission].label} · {e.collections.join(", ")}</TableCell>
                    <TableCell>{e.band}</TableCell>
                    <TableCell>{formatPeriod(e.timeStart, e.timeEnd)}</TableCell>
                    <TableCell>{f ? `${f.used.length}/${e.totalExposures}` : `${e.exposures.length}/${e.totalExposures}`}</TableCell>
                    <TableCell>{f ? `${(f.coverage * 100).toFixed(0)}%` : <Badge variant="outline">Not loaded</Badge>}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <p className="text-muted-foreground">time_start ~ time_end are the actual observation times (SIA2 t_min, t_max), not data release dates. Processing version: {PROCESSING_VERSION}</p>
      </section>

      <section className="grid gap-2 rounded-md border p-3">
        <h3 className="text-sm font-medium">⑤ Limitations</h3>
        <ul className="list-disc pl-4 text-muted-foreground">
          {LIMITATIONS.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
