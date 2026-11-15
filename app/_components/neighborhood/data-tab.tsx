"use client";

import { useMemo } from "react";
import { ExternalLinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useT } from "@/app/_i18n/i18n-provider";
import type { MessageKey } from "@/app/_i18n/message-keys";
import { closestApproach, modelStatus, percentile, sampleModels } from "@/app/_lib/nim/motion";
import type { Measured } from "@/app/_lib/nim/types";
import { richText } from "../fake-planet-lab/fpl-text";
import { formatYear, useNim } from "./nim-state";

const fmt = (m: Measured | null, notMeasured: string, digits = 3, unit = "") =>
  m ? `${m.value.toFixed(digits)}${m.error != null ? ` ± ${m.error.toFixed(digits)}` : ""}${unit}` : notMeasured;

/** Screen text for modelStatus() levels (the library's English text stays as data). */
const STATUS_TEXT: Record<ReturnType<typeof modelStatus>["level"], { badge: MessageKey; text: MessageKey }> = {
  "full-3d": { badge: "nim.statusFull3d", text: "nim.statusFull3dText" },
  "assumed-rv": { badge: "nim.statusAssumedRv", text: "nim.statusAssumedRvText" },
  "distance-uncertain": { badge: "nim.statusDistanceUncertain", text: "nim.statusDistanceUncertainText" },
};

export function DataTab() {
  const t = useT();
  const { selected, models, assumedRv, setAssumedRv, catalog } = useNim();
  const m = selected ? models.get(selected.id) : undefined;
  const spread = useMemo(() => {
    if (!selected) return null;
    const cs = sampleModels(selected, assumedRv[selected.id] ?? 0, 400).map(closestApproach);
    return {
      year: [percentile(cs.map((c) => c.year), 5), percentile(cs.map((c) => c.year), 95)],
      dist: [percentile(cs.map((c) => c.distancePc), 5), percentile(cs.map((c) => c.distancePc), 95)],
    };
  }, [selected, assumedRv]);
  if (!selected || !m) return <p className="pt-2 text-sm text-muted-foreground">{t("nim.selectObject")}</p>;
  const status = modelStatus(selected);
  const ca = closestApproach(m);
  const src = selected.source;
  const none = t("nim.notMeasured");

  return (
    <div className="grid gap-3 pt-2 text-xs">
      <section className="grid gap-2 rounded-md border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-medium">{selected.name}</h3>
          <Badge variant="outline">{selected.kind}</Badge>
          <Badge variant={status.level === "full-3d" ? "secondary" : "outline"}>{t(STATUS_TEXT[status.level].badge)}</Badge>
        </div>
        <p className="text-muted-foreground">{STATUS_TEXT[status.level] ? t(STATUS_TEXT[status.level].text) : status.text}</p>
        <p>
          {richText(t("nim.sourceLine", { basis: selected.nameBasis }), {
            source:
              src.catalog === "Gaia DR3" ? (
                <span className="font-mono">{t("nim.sourceGaia", { id: src.sourceId, service: src.service })}</span>
              ) : (
                <a href={src.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  {src.reference} <ExternalLinkIcon className="size-3" />
                </a>
              ),
          })}
        </p>
        {selected.notes.length > 0 && (
          <ul className="list-disc pl-4 text-amber-700 dark:text-amber-400">
            {selected.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-2 rounded-md border p-3">
        <h3 className="text-sm font-medium">{t("nim.measuredTitle")}</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("nim.colQuantity")}</TableHead>
                <TableHead>{t("nim.colValue")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="font-mono">
              <TableRow><TableCell className="font-sans">{t("nim.rowPosition", { epoch: selected.epoch.toFixed(2) })}</TableCell><TableCell>RA {selected.ra.toFixed(6)}°, Dec {selected.dec.toFixed(6)}°</TableCell></TableRow>
              <TableRow><TableCell className="font-sans">{t("nim.rowParallax")}</TableCell><TableCell>{fmt(selected.parallax, none, 3, " mas")} → {m.distancePc.toFixed(4)} pc</TableCell></TableRow>
              <TableRow><TableCell className="font-sans">{t("nim.rowPmra")}</TableCell><TableCell>{fmt(selected.pmra, none, 3, " mas/yr")}</TableCell></TableRow>
              <TableRow><TableCell className="font-sans">{t("nim.rowPmdec")}</TableCell><TableCell>{fmt(selected.pmdec, none, 3, " mas/yr")}</TableCell></TableRow>
              <TableRow><TableCell className="font-sans">{t("nim.rowRadialVelocity")}</TableCell><TableCell>{fmt(selected.radialVelocity, none, 2, " km/s")}</TableCell></TableRow>
              <TableRow><TableCell className="font-sans">RUWE</TableCell><TableCell>{selected.ruwe != null && selected.ruwe > 1.4 ? t("nim.ruweHigh", { ruwe: selected.ruwe.toFixed(2) }) : (selected.ruwe?.toFixed(2) ?? "—")}</TableCell></TableRow>
              <TableRow><TableCell className="font-sans">{t("nim.rowCorrelations")}</TableCell><TableCell>{selected.correlations ? `${selected.correlations.parallaxPmra.toFixed(2)}, ${selected.correlations.parallaxPmdec.toFixed(2)}, ${selected.correlations.pmraPmdec.toFixed(2)}` : t("nim.correlationsNone")}</TableCell></TableRow>
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="grid gap-2 rounded-md border p-3">
        <h3 className="text-sm font-medium">{t("nim.modelTitle")}</h3>
        <p>{t("nim.modelText")}</p>
        {!selected.radialVelocity && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2">
            <Label htmlFor="nim-rv" className="text-xs">{t("nim.assumedRvLabel")}</Label>
            <Input
              id="nim-rv"
              type="number"
              className="h-7 w-24 font-mono"
              value={assumedRv[selected.id] ?? 0}
              onChange={(e) => setAssumedRv(selected.id, Number(e.target.value) || 0)}
            />
            <span>{t("nim.assumedRvNote")}</span>
          </div>
        )}
        <dl className="grid gap-x-3 gap-y-1 font-mono [grid-template-columns:auto_1fr]">
          <dt className="font-sans text-muted-foreground">{t("nim.tangentialSpeed")}</dt>
          <dd>{m.vTan.toFixed(1)} km/s</dd>
          <dt className="font-sans text-muted-foreground">{t("nim.spaceVelocity")}</dt>
          <dd>{Math.hypot(...m.v).toFixed(1)} km/s {m.rvAssumed && t("nim.withAssumedRv")}</dd>
          <dt className="font-sans text-muted-foreground">{t("nim.closestApproach")}</dt>
          <dd>
            {formatYear(ca.year)}, {ca.distancePc.toFixed(3)} pc ({(ca.distancePc * 3.26156).toFixed(2)} ly)
          </dd>
          {spread && (
            <>
              <dt className="font-sans text-muted-foreground">{t("nim.spreadLabel")}</dt>
              <dd>
                {formatYear(spread.year[0])} – {formatYear(spread.year[1])}; {spread.dist[0].toFixed(3)}–{spread.dist[1].toFixed(3)} pc
                <span className="font-sans text-muted-foreground">
                  {" "}
                  {t(
                    selected.correlations
                      ? selected.radialVelocity ? "nim.spreadCorrelations" : "nim.spreadCorrelationsRvHeld"
                      : selected.radialVelocity ? "nim.spreadIndependent" : "nim.spreadIndependentRvHeld",
                  )}
                </span>
              </dd>
            </>
          )}
        </dl>
        <p className="text-muted-foreground">{t("nim.extrapolationNote")}</p>
      </section>

      {catalog.data && (
        <section className="grid gap-1 rounded-md border p-3 text-muted-foreground">
          <h3 className="text-sm font-medium text-foreground">{t("nim.queryTitle")}</h3>
          {catalog.data.queries.map((q) => (
            <p key={q.query} className="font-mono break-all">{q.service}: {q.query}</p>
          ))}
        </section>
      )}
    </div>
  );
}
