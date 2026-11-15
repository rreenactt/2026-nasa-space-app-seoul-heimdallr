"use client";

import { useMemo, useState } from "react";
import { CopyIcon, DownloadIcon, Trash2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useT } from "@/app/_i18n/i18n-provider";
import type { MessageKey } from "@/app/_i18n/message-keys";
import { CHECK_PARAMS, decodeBits } from "@/app/_lib/fpl/checks";
import { FLAG_CATEGORIES, MEASUREMENT_EXCLUDE } from "@/app/_lib/fpl/flags";
import { mjdIso, useFpl } from "./fpl-state";
import { flagExplain, flagLabel, JUDGMENT_CELL, richText, storedVerdictText, targetName } from "./fpl-text";
import { toNative, useFrames } from "./use-fpl-data";

const ROLE_LABEL: Record<"exclude" | "warning" | "context" | "info" | "unknown", MessageKey> = {
  exclude: "fpl.roleExclude",
  warning: "fpl.roleWarning",
  context: "fpl.roleContext",
  info: "fpl.roleInfo",
  unknown: "fpl.roleUnknown",
};

/** Bit table read from the primary file's FLAGS header (MSKNnnnn / MSKDnnnn), with counts in the cutout. */
export function FlagGuideTab() {
  const t = useT();
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
  if (!frame) return <p className="pt-2 text-sm text-muted-foreground">{t("fpl.loadFirst")}</p>;
  return (
    <div className="grid gap-3 pt-2 text-xs">
      <p>{richText(t("fpl.flagsIntro", { release: frame.payload.release }), { file: <span className="font-mono">{frame.payload.key}</span> })}</p>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("fpl.colBit")}</TableHead>
              <TableHead>{t("fpl.colName")}</TableHead>
              <TableHead>{t("fpl.colHeaderDescription")}</TableHead>
              <TableHead>{t("fpl.colLayer")}</TableHead>
              <TableHead>{t("fpl.colUse")}</TableHead>
              <TableHead className="text-right">{t("fpl.colPixels")}</TableHead>
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
                    {flagLabel(t, b.category)}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{MEASUREMENT_EXCLUDE.includes(b.name) ? t("fpl.excludedFromSnr") : t(ROLE_LABEL[b.category.role])}</Badge>
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
            <span className="font-medium">{flagLabel(t, c)}</span> — {flagExplain(t, c)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RecordsTab() {
  const t = useT();
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
          <DownloadIcon /> {t("fpl.downloadJson")}
        </Button>
        <Button size="sm" variant="outline" onClick={copy} disabled={!records.length}>
          <CopyIcon /> {copied ? t("common.copied") : t("fpl.copyJson")}
        </Button>
        <span className="text-muted-foreground">{t("fpl.recordsNote")}</span>
      </div>
      {!records.length ? (
        <p className="text-muted-foreground">{t("fpl.noRecords")}</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("fpl.colSaved")}</TableHead>
                <TableHead>{t("fpl.colPosition")}</TableHead>
                <TableHead>{t("fpl.colObservation")}</TableHead>
                <TableHead>{t("fpl.colChecks")}</TableHead>
                <TableHead>{t("fpl.yourJudgment")}</TableHead>
                <TableHead>{t("fpl.colNote")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.createdAt.slice(11, 19)}</TableCell>
                  <TableCell className="font-mono">{r.candidate.ra.toFixed(5)}, {r.candidate.dec.toFixed(5)}</TableCell>
                  <TableCell className="font-mono">{r.primaryKey}</TableCell>
                  <TableCell>{storedVerdictText(t, r.verdict)}</TableCell>
                  <TableCell>{JUDGMENT_CELL[r.judgment] ? t(JUDGMENT_CELL[r.judgment]) : r.judgment.replace(/-/g, " ")}</TableCell>
                  <TableCell className="max-w-48 truncate">{r.note}</TableCell>
                  <TableCell>
                    <Button size="icon-xs" variant="ghost" onClick={() => removeRecord(r.id)} aria-label={t("fpl.deleteRecord")}>
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

const LIMITATIONS: MessageKey[] = [
  "fpl.limitFlags",
  "fpl.limitOutlier",
  "fpl.limitAperture",
  "fpl.limitOtherObservations",
  "fpl.limitWavelength",
  "fpl.limitBrightStars",
  "fpl.limitGrid",
];

export function ProvenanceTab() {
  const t = useT();
  const { selected, target, search } = useFpl();
  const results = useFrames(selected, target.ra, target.dec);
  return (
    <div className="grid gap-3 pt-2 text-xs">
      <section className="grid gap-1 rounded-md border p-3">
        <h3 className="text-sm font-medium">{t("fpl.provSearch")}</h3>
        <p className="font-mono">RA {target.ra.toFixed(5)} Dec {target.dec.toFixed(5)} · {targetName(t, target.name)}</p>
        {search.data && (
          <p className="truncate font-mono text-muted-foreground">
            <a href={search.data.queryUrl} target="_blank" rel="noreferrer" className="hover:underline">{search.data.queryUrl}</a> · {t("fpl.exposuresDr1", { n: search.data.exposures.length })}
          </p>
        )}
      </section>
      <section className="grid gap-2 rounded-md border p-3">
        <h3 className="text-sm font-medium">{t("fpl.provObservations")}</h3>
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
                <span className="text-muted-foreground">{t("fpl.notLoaded")}</span>
              )}
            </div>
          );
        })}
      </section>
      <section className="grid gap-1 rounded-md border p-3">
        <h3 className="text-sm font-medium">{t("fpl.provPolicy", { version: CHECK_PARAMS.version })}</h3>
        <p>{richText(t("fpl.policyExcluded"), { names: <span className="font-mono">{MEASUREMENT_EXCLUDE.join(", ")}</span> })}</p>
        <p>
          {t("fpl.policyWarning", {
            list: FLAG_CATEGORIES.filter((c) => c.role === "warning").map((c) => `${flagLabel(t, c)} (${c.names.join(", ")})`).join("; "),
          })}
        </p>
        <p>{t("fpl.policyInfo", { names: FLAG_CATEGORIES.filter((c) => c.role === "info").flatMap((c) => c.names).join(", ") })}</p>
        <p className="font-mono text-muted-foreground">
          {t("fpl.policyParams", {
            aperture: CHECK_PARAMS.apertureRadiusPx,
            ring: CHECK_PARAMS.annulusPx.join("–"),
            detect: CHECK_PARAMS.snrDetect,
            shape: CHECK_PARAMS.snrShape,
            size: CHECK_PARAMS.sizeRatioWarn,
            elongation: CHECK_PARAMS.elongationWarn,
            edge: CHECK_PARAMS.detectorEdgeWarnPx,
          })}
        </p>
      </section>
      <section className="grid gap-1 rounded-md border p-3">
        <h3 className="text-sm font-medium">{t("fpl.provLimitations")}</h3>
        <ul className="list-disc pl-4 text-muted-foreground">
          {LIMITATIONS.map((l) => (
            <li key={l}>{t(l)}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
