"use client";

import { ExternalLinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MISSION_ORDER, MISSIONS, PROCESSING_VERSION } from "@/app/_lib/sky/missions";
import { useT } from "@/app/_i18n/i18n-provider";
import type { MessageKey } from "@/app/_i18n/message-keys";
import { formatPeriod, useStm } from "./stm-state";
import { useEpochFrame, useLoadedFrames } from "./use-sky-data";

const LIMITATIONS: MessageKey[] = [
  "stm.limitWiseStack",
  "stm.limitWiseFlags",
  "stm.limitSpherexWavelength",
  "stm.limitSpherexOutlier",
  "stm.limitBrightnessScale",
  "stm.limitGrid",
  "stm.limitGaiaPath",
  "stm.limitMissing",
];

export function EvidenceTab() {
  const t = useT();
  const { epochs, current, grid, searches, target } = useStm();
  const frame = useEpochFrame(current, grid);
  const loadedFrames = useLoadedFrames(epochs, grid);

  return (
    <div className="grid gap-3 pt-2 text-xs">
      <section className="grid gap-2 rounded-md border p-3">
        <h3 className="text-sm font-medium">{t("stm.sectionField")}</h3>
        <p className="font-mono">
          {t("stm.fieldLine", { ra: target.ra.toFixed(5), dec: target.dec.toFixed(5), fov: target.fovArcmin, n: grid.n, source: target.source })}
        </p>
      </section>

      <section className="grid gap-2 rounded-md border p-3">
        <h3 className="text-sm font-medium">{t("stm.sectionSearch")}</h3>
        <ul className="grid gap-1">
          {MISSION_ORDER.map((m, i) => {
            const q = searches[i].data;
            return (
              <li key={m}>
                <span className="font-medium">{MISSIONS[m].label}</span> — {MISSIONS[m].product}
                {q ? (
                  <span className="text-muted-foreground"> · {t("stm.searchSummary", { exposures: q.exposureCount, visits: q.epochs.length, collections: q.collections.join(", ") })}</span>
                ) : (
                  <span className="text-muted-foreground"> · {searches[i].isError ? t("stm.searchFailed", { message: String(searches[i].error?.message) }) : t("analyses.stepSearching")}</span>
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
        <h3 className="text-sm font-medium">{t("stm.sectionSource")}</h3>
        {!current ? (
          "—"
        ) : !frame.data ? (
          <span className="text-muted-foreground">{t("stm.sourcePending")}</span>
        ) : (
          <>
            <p>
              {MISSIONS[current.mission].label} {current.wavelengthLabel} · {frame.data.combine} · {t("stm.exposureSpan")}{" "}
              <span className="font-mono">{formatPeriod(frame.data.timeStart, frame.data.timeEnd)}</span>
              {frame.data.wavelengthUm != null && <> · {t("stm.centerWavelength", { um: frame.data.wavelengthUm.toFixed(3) })}</>}
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
                <li key={f.id} className="truncate text-destructive">{t("stm.notLoadedItem", { id: f.id, reason: f.reason })}</li>
              ))}
            </ul>
            <p className="text-muted-foreground">{t("stm.processing", { version: frame.data.processingVersion })}</p>
          </>
        )}
      </section>

      <section className="grid gap-2 rounded-md border p-3">
        <h3 className="text-sm font-medium">{t("stm.sectionDates")}</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>frame_id</TableHead>
                <TableHead>mission · release</TableHead>
                <TableHead>band</TableHead>
                <TableHead>time_start ~ time_end</TableHead>
                <TableHead>{t("stm.colExposures")}</TableHead>
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
                    <TableCell>{f ? `${(f.coverage * 100).toFixed(0)}%` : <Badge variant="outline">{t("stm.notLoaded")}</Badge>}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <p className="text-muted-foreground">{t("stm.datesNote", { version: PROCESSING_VERSION })}</p>
      </section>

      <section className="grid gap-2 rounded-md border p-3">
        <h3 className="text-sm font-medium">{t("stm.sectionLimitations")}</h3>
        <ul className="list-disc pl-4 text-muted-foreground">
          {LIMITATIONS.map((l) => (
            <li key={l}>{t(l)}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
