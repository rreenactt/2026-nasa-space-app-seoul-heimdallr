"use client";

import { useMemo, useState } from "react";
import { CopyIcon, DownloadIcon, Trash2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CHECK_PARAMS, decodeBits } from "@/app/_lib/fpl/checks";
import { FLAG_CATEGORIES, MEASUREMENT_EXCLUDE } from "@/app/_lib/fpl/flags";
import { mjdIso, useFpl } from "./fpl-state";
import { toNative, useFrames } from "./use-fpl-data";

const ROLE_LABEL = { exclude: "Excluded from measurement", warning: "Contamination warning", context: "Look closer", info: "Informational", unknown: "Not interpreted" } as const;

/** Bit table read from the primary file's FLAGS header (MSKNnnnn / MSKDnnnn), with counts in the cutout. */
export function FlagGuideTab() {
  const { selected, target } = useFpl();
  const results = useFrames(selected.slice(0, 1), target.ra, target.dec);
  const frame = results[0]?.data ? toNative(results[0].data) : null;
  const rows = useMemo(() => {
    if (!frame) return [];
    return decodeBits(frame.payload.flagBits).map((b) => {
      let n = 0;
      for (const v of frame.flags) if ((v >>> 0) & b.mask) n++;
      return { ...b, count: n };
    });
  }, [frame]);
  if (!frame) return <p className="pt-2 text-sm text-muted-foreground">Load an observation in the Inspect tab first.</p>;
  return (
    <div className="grid gap-3 pt-2 text-xs">
      <p>
        FLAGS is a bit field: one pixel can carry several states at once. Bit numbers and names below come from this file&apos;s header (
        <span className="font-mono">{frame.payload.key}</span>, {frame.payload.release}), not from a hard-coded list. A flag means the pipeline marked an
        effect there; it is not a verdict that a dot is fake.
      </p>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bit</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Header description</TableHead>
              <TableHead>Layer</TableHead>
              <TableHead>How this tool uses it</TableHead>
              <TableHead className="text-right">Pixels in cutout</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((b) => (
              <TableRow key={b.bit}>
                <TableCell className="font-mono">{b.bit}</TableCell>
                <TableCell className="font-mono">{b.name}</TableCell>
                <TableCell className="whitespace-normal">{b.description}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm" style={{ background: `rgb(${b.category.color})` }} />
                    {b.category.label}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{MEASUREMENT_EXCLUDE.includes(b.name) ? "Excluded from S/N" : ROLE_LABEL[b.category.role]}</Badge>
                </TableCell>
                <TableCell className="text-right font-mono">{b.count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="grid gap-1">
        {FLAG_CATEGORIES.map((c) => (
          <li key={c.id}>
            <span className="font-medium">{c.label}</span> — {c.explain}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RecordsTab() {
  const { records, removeRecord } = useFpl();
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify({ tool: "Fake Planet Lab", rules: CHECK_PARAMS.version, exportedAt: new Date().toISOString(), records }, null, 2);
  const download = () => {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `fake-planet-lab-records-${new Date().toISOString().slice(0, 19).replace(/:/g, "")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="grid gap-3 pt-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={download} disabled={!records.length}>
          <DownloadIcon /> Download JSON
        </Button>
        <Button size="sm" variant="outline" onClick={copy} disabled={!records.length}>
          <CopyIcon /> {copied ? "Copied" : "Copy JSON"}
        </Button>
        <span className="text-muted-foreground">Records live only in this tab. Nothing is sent to a server. Each record holds coordinates, observation IDs, check results, your judgment and source URLs.</span>
      </div>
      {!records.length ? (
        <p className="text-muted-foreground">No records yet. Inspect a position and press “Save record”.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Saved</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Observation (★)</TableHead>
                <TableHead>Checks</TableHead>
                <TableHead>Your judgment</TableHead>
                <TableHead>Note</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.createdAt.slice(11, 19)}</TableCell>
                  <TableCell className="font-mono">{r.candidate.ra.toFixed(5)}, {r.candidate.dec.toFixed(5)}</TableCell>
                  <TableCell className="font-mono">{r.primaryKey}</TableCell>
                  <TableCell>{r.verdict}</TableCell>
                  <TableCell>{r.judgment.replace(/-/g, " ")}</TableCell>
                  <TableCell className="max-w-48 truncate">{r.note}</TableCell>
                  <TableCell>
                    <Button size="icon-xs" variant="ghost" onClick={() => removeRecord(r.id)} aria-label="Delete record">
                      <Trash2Icon />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

const LIMITATIONS = [
  "Flags catch many artifacts but not all. “No issue found” never means a real object or a planet.",
  "OUTLIER is not treated as an artifact: SPHEREx marks real moving or variable objects as outliers too.",
  "Checks use a 2-pixel aperture on native pixels (≈12″). SPHEREx pixels (≈6.2″) are close to the PSF width, so the shape check is rough.",
  "“Other observations” looks at the same sky position. A moving object is expected to be missing there — absence alone is not proof of an artifact.",
  "SPHEREx wavelength changes across the detector. Comparisons are flagged when detector or wavelength (within the bandwidth) differ.",
  "The bright-star check uses Gaia DR3 (G < 10 within 2′). Other ghost sources (off-field stars, other detectors) are only known through the GHOST flags.",
  "Images are shown on a common grid by nearest-pixel lookup; all numbers are computed on the original pixels.",
];

export function ProvenanceTab() {
  const { selected, target, search } = useFpl();
  const results = useFrames(selected, target.ra, target.dec);
  return (
    <div className="grid gap-3 pt-2 text-xs">
      <section className="grid gap-1 rounded-md border p-3">
        <h3 className="text-sm font-medium">Search</h3>
        <p className="font-mono">RA {target.ra.toFixed(5)} Dec {target.dec.toFixed(5)} · {target.name}</p>
        {search.data && (
          <p className="truncate font-mono text-muted-foreground">
            <a href={search.data.queryUrl} target="_blank" rel="noreferrer" className="hover:underline">{search.data.queryUrl}</a> · {search.data.exposures.length} exposures (DR1)
          </p>
        )}
      </section>
      <section className="grid gap-2 rounded-md border p-3">
        <h3 className="text-sm font-medium">Observations in use</h3>
        {selected.map((e, i) => {
          const p = results[i]?.data;
          return (
            <div key={e.key} className="grid gap-0.5">
              <span className="font-medium">{i === 0 ? "★ " : ""}{e.obsId} {e.detector} · {mjdIso(e.tStart)}</span>
              {p ? (
                <>
                  <span className="font-mono text-muted-foreground">{p.release} · L2 DQA {p.header.l2Dqa} · PSF {p.header.psfFwhmArcsec?.toFixed(1)}″ · {p.header.bunit}</span>
                  <a href={p.fileUrl} target="_blank" rel="noreferrer" className="truncate font-mono text-primary hover:underline">{p.fileUrl}</a>
                  <span className="truncate font-mono text-muted-foreground">{p.pixelSource}</span>
                </>
              ) : (
                <span className="text-muted-foreground">not loaded</span>
              )}
            </div>
          );
        })}
      </section>
      <section className="grid gap-1 rounded-md border p-3">
        <h3 className="text-sm font-medium">Policy ({CHECK_PARAMS.version})</h3>
        <p>Excluded from S/N: <span className="font-mono">{MEASUREMENT_EXCLUDE.join(", ")}</span>; the background ring also drops OUTLIER.</p>
        <p>
          Warning layers: {FLAG_CATEGORIES.filter((c) => c.role === "warning").map((c) => `${c.label} (${c.names.join(", ")})`).join("; ")}.
        </p>
        <p>Informational: {FLAG_CATEGORIES.filter((c) => c.role === "info").flatMap((c) => c.names).join(", ")}. Unknown bits are shown raw as “Not interpreted”.</p>
        <p className="font-mono text-muted-foreground">
          aperture {CHECK_PARAMS.apertureRadiusPx} px · ring {CHECK_PARAMS.annulusPx.join("–")} px · S/N detect ≥ {CHECK_PARAMS.snrDetect}, shape ≥ {CHECK_PARAMS.snrShape} · size warn × {CHECK_PARAMS.sizeRatioWarn} PSF · elongation warn {CHECK_PARAMS.elongationWarn} · detector edge {CHECK_PARAMS.detectorEdgeWarnPx} px
        </p>
      </section>
      <section className="grid gap-1 rounded-md border p-3">
        <h3 className="text-sm font-medium">Limitations</h3>
        <ul className="list-disc pl-4 text-muted-foreground">
          {LIMITATIONS.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
