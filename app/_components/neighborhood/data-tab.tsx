"use client";

import { useMemo } from "react";
import { ExternalLinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { closestApproach, modelStatus, percentile, sampleModels } from "@/app/_lib/nim/motion";
import type { Measured } from "@/app/_lib/nim/types";
import { formatYear, useNim } from "./nim-state";

const fmt = (m: Measured | null, digits = 3, unit = "") =>
  m ? `${m.value.toFixed(digits)}${m.error != null ? ` ± ${m.error.toFixed(digits)}` : ""}${unit}` : "not measured";

export function DataTab() {
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
  if (!selected || !m) return <p className="pt-2 text-sm text-muted-foreground">Select an object.</p>;
  const status = modelStatus(selected);
  const ca = closestApproach(m);
  const src = selected.source;

  return (
    <div className="grid gap-3 pt-2 text-xs">
      <section className="grid gap-2 rounded-md border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-medium">{selected.name}</h3>
          <Badge variant="outline">{selected.kind}</Badge>
          <Badge variant={status.level === "full-3d" ? "secondary" : "outline"}>{status.level === "full-3d" ? "Full 3D model" : status.level === "assumed-rv" ? "Assumed radial velocity" : "Distance uncertain"}</Badge>
        </div>
        <p className="text-muted-foreground">{status.text}</p>
        <p>
          Source:{" "}
          {src.catalog === "Gaia DR3" ? (
            <span className="font-mono">Gaia DR3 {src.sourceId} (via {src.service})</span>
          ) : (
            <a href={src.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              {src.reference} <ExternalLinkIcon className="size-3" />
            </a>
          )}
          {" · "}name: {selected.nameBasis}
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
        <h3 className="text-sm font-medium">Measured values (as published)</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quantity</TableHead>
                <TableHead>Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="font-mono">
              <TableRow><TableCell className="font-sans">Position (epoch {selected.epoch.toFixed(2)})</TableCell><TableCell>RA {selected.ra.toFixed(6)}°, Dec {selected.dec.toFixed(6)}°</TableCell></TableRow>
              <TableRow><TableCell className="font-sans">Parallax</TableCell><TableCell>{fmt(selected.parallax, 3, " mas")} → {m.distancePc.toFixed(4)} pc</TableCell></TableRow>
              <TableRow><TableCell className="font-sans">Proper motion RA·cosδ</TableCell><TableCell>{fmt(selected.pmra, 3, " mas/yr")}</TableCell></TableRow>
              <TableRow><TableCell className="font-sans">Proper motion Dec</TableCell><TableCell>{fmt(selected.pmdec, 3, " mas/yr")}</TableCell></TableRow>
              <TableRow><TableCell className="font-sans">Radial velocity</TableCell><TableCell>{fmt(selected.radialVelocity, 2, " km/s")}</TableCell></TableRow>
              <TableRow><TableCell className="font-sans">RUWE</TableCell><TableCell>{selected.ruwe?.toFixed(2) ?? "—"}{selected.ruwe != null && selected.ruwe > 1.4 ? " (above 1.4: astrometry may be disturbed)" : ""}</TableCell></TableRow>
              <TableRow><TableCell className="font-sans">Correlations (ϖ–μα, ϖ–μδ, μα–μδ)</TableCell><TableCell>{selected.correlations ? `${selected.correlations.parallaxPmra.toFixed(2)}, ${selected.correlations.parallaxPmdec.toFixed(2)}, ${selected.correlations.pmraPmdec.toFixed(2)}` : "not given (treated as independent)"}</TableCell></TableRow>
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="grid gap-2 rounded-md border p-3">
        <h3 className="text-sm font-medium">Model (computed, not observed)</h3>
        <p>Straight-line motion in the barycentric ICRS frame: r(t) = r(t₀) + v·(t − t₀). No Galactic potential, no binary orbits, distance = 1000/ϖ.</p>
        {!selected.radialVelocity && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2">
            <Label htmlFor="nim-rv" className="text-xs">Assumed radial velocity (km/s)</Label>
            <Input
              id="nim-rv"
              type="number"
              className="h-7 w-24 font-mono"
              value={assumedRv[selected.id] ?? 0}
              onChange={(e) => setAssumedRv(selected.id, Number(e.target.value) || 0)}
            />
            <span>Not measured. The current path uses this assumption; it is never stored as a measurement.</span>
          </div>
        )}
        <dl className="grid gap-x-3 gap-y-1 font-mono [grid-template-columns:auto_1fr]">
          <dt className="font-sans text-muted-foreground">Tangential speed</dt>
          <dd>{m.vTan.toFixed(1)} km/s</dd>
          <dt className="font-sans text-muted-foreground">Space velocity</dt>
          <dd>{Math.hypot(...m.v).toFixed(1)} km/s {m.rvAssumed && "(with assumed radial velocity)"}</dd>
          <dt className="font-sans text-muted-foreground">Closest approach</dt>
          <dd>
            {formatYear(ca.year)}, {ca.distancePc.toFixed(3)} pc ({(ca.distancePc * 3.26156).toFixed(2)} ly)
          </dd>
          {spread && (
            <>
              <dt className="font-sans text-muted-foreground">5–95% from errors</dt>
              <dd>
                {formatYear(spread.year[0])} – {formatYear(spread.year[1])}; {spread.dist[0].toFixed(3)}–{spread.dist[1].toFixed(3)} pc
                <span className="font-sans text-muted-foreground"> ({selected.correlations ? "Gaia correlations used" : "errors treated as independent"}{selected.radialVelocity ? "" : "; radial velocity held at the assumption"})</span>
              </dd>
            </>
          )}
        </dl>
        <p className="text-muted-foreground">Thousands of years out, this is an educational extrapolation: real paths bend under the Galaxy&apos;s gravity and companions.</p>
      </section>

      {catalog.data && (
        <section className="grid gap-1 rounded-md border p-3 text-muted-foreground">
          <h3 className="text-sm font-medium text-foreground">Query</h3>
          {catalog.data.queries.map((q) => (
            <p key={q.query} className="font-mono break-all">{q.service}: {q.query}</p>
          ))}
        </section>
      )}
    </div>
  );
}
