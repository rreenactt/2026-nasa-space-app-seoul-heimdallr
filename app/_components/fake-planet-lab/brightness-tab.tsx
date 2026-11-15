"use client";

import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { AlertCircleIcon, CopyIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  BRIGHTNESS_PARAMS,
  chooseMethod,
  matchVisits,
  measureBrightness,
  summarizeChange,
  valueOf,
  visitIndex,
  type BrightnessMethod,
  type BrightnessPoint,
  type ChangeSummary,
} from "@/app/_lib/fpl/brightness";
import { useT } from "@/app/_i18n/i18n-provider";
import type { MessageKey } from "@/app/_i18n/message-keys";
import { mjdIso, useFpl } from "./fpl-state";
import { richText } from "./fpl-text";
import { spherexFrameQuery, toNative } from "./use-fpl-data";

/** Exposures read at the same time. Each one is a byte-range read of a remote file that takes several seconds. */
const PARALLEL = 6;
const VISIT_COLORS = ["#38bdf8", "#f59e0b", "#a78bfa", "#34d399", "#f472b6", "#94a3b8"];
const P = BRIGHTNESS_PARAMS;

const VERDICT_TEXT: Record<ChangeSummary["verdict"], MessageKey> = {
  changed: "fpl.verdictChanged",
  "no-change-found": "fpl.verdictNoChange",
  "too-few-pairs": "fpl.verdictTooFew",
};

function describe(s: ChangeSummary) {
  const percent = (s.medianRatio - 1) * 100;
  return `${percent >= 0 ? "+" : "−"}${Math.abs(percent).toFixed(1)}% (${s.deltaMag >= 0 ? "+" : "−"}${Math.abs(s.deltaMag).toFixed(3)} ± ${s.deltaMagError.toFixed(3)} mag)`;
}

/**
 * Brightness of the position in every exposure of the chosen detectors: against wavelength (a spectrum), and visit
 * against visit at the same wavelength (a change in brightness). Measured on native pixels, on demand.
 */
export function BrightnessTab() {
  const t = useT();
  const { target, candidate, search } = useFpl();
  const at = candidate ?? target;
  const [detectors, setDetectors] = useState<string[]>([]);
  const [methodChoice, setMethodChoice] = useState<BrightnessMethod | "auto">("auto");

  const exposures = useMemo(() => search.data?.exposures ?? [], [search.data]);
  const available = useMemo(() => {
    const out = new Map<string, { n: number; lo: number; hi: number }>();
    for (const e of exposures) {
      const d = out.get(e.detector) ?? { n: 0, lo: e.emMinUm, hi: e.emMaxUm };
      out.set(e.detector, { n: d.n + 1, lo: Math.min(d.lo, e.emMinUm), hi: Math.max(d.hi, e.emMaxUm) });
    }
    return [...out.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [exposures]);
  const wanted = useMemo(() => exposures.filter((e) => detectors.includes(e.detector)), [exposures, detectors]);

  // Only a few reads run at once: the window moves forward as reads finish.
  const [windowEnd, setWindowEnd] = useState(PARALLEL);
  const results = useQueries({
    queries: wanted.map((e, i) => ({ ...spherexFrameQuery(e, at.ra, at.dec), retry: 2, retryDelay: 1500, enabled: i < windowEnd })),
  });
  const settled = results.filter((r) => r.isSuccess || r.isError).length;
  if (settled + PARALLEL > windowEnd && windowEnd < wanted.length) setWindowEnd(settled + PARALLEL);
  const failed = results.filter((r) => r.isError);
  const loading = settled < wanted.length;

  const frames = results.map((r) => r.data);
  const loadedKey = wanted.map((e, i) => (frames[i] ? e.key : "")).join();
  const points = useMemo(() => {
    const out: BrightnessPoint[] = [];
    for (const data of frames) {
      const p = data ? measureBrightness(toNative(data), at.ra, at.dec) : null;
      if (p) out.push(p);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- frames is a new array each render; which exposures are loaded and the position decide the result
  }, [loadedKey, at.ra, at.dec]);

  const auto = useMemo(() => chooseMethod(points), [points]);
  // With nothing measurable the core is still shown, marked as a lower limit.
  const method: BrightnessMethod = methodChoice === "auto" ? (auto ?? "core") : methodChoice;
  const ringText = method === "core" ? "" : `${P.rings[method][0]}–${P.rings[method][1]} px`;
  const visits = useMemo(() => visitIndex(points), [points]);
  const visitStarts = useMemo(() => {
    const out: number[] = [];
    for (const p of points) {
      const v = visits.get(p.key)!;
      out[v] = Math.min(out[v] ?? Infinity, p.mjd);
    }
    return out;
  }, [points, visits]);
  const comparisons = useMemo(() => {
    const out: { a: number; b: number; pairs: ReturnType<typeof matchVisits> }[] = [];
    for (let a = 0; a < visitStarts.length; a++) for (let b = a + 1; b < visitStarts.length; b++) out.push({ a, b, pairs: matchVisits(points, method, a, b) });
    return out;
  }, [points, method, visitStarts.length]);
  const saturated = points.filter((p) => p.coreExcludedPixels > 0 || !p.core).length;
  const unmeasured = points.filter((p) => !valueOf(p, method)).length;

  if (search.isPending) return <p className="flex items-center gap-2 pt-2 text-sm text-muted-foreground"><Spinner /> {t("fpl.searching")}</p>;
  if (search.isError) return <p className="pt-2 text-sm text-destructive">{t("fpl.searchFailed", { message: search.error.message })}</p>;
  if (!exposures.length) return <p className="pt-2 text-sm text-muted-foreground">{t("fpl.noObservation")}</p>;

  return (
    <div className="grid gap-4 pt-2 text-xs">
      <p>{t(candidate ? "fpl.brightnessIntroPicked" : "fpl.brightnessIntro", { ra: at.ra.toFixed(5), dec: at.dec.toFixed(5) })}</p>

      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">{t("fpl.detectorsToMeasure")}</span>
          <ToggleGroup multiple variant="outline" size="sm" value={detectors} onValueChange={(v: string[]) => { setDetectors([...v].sort()); setWindowEnd(PARALLEL); }}>
            {available.map(([d, info]) => (
              <ToggleGroupItem key={d} value={d} className="font-mono text-xs">
                {d} · {info.lo.toFixed(1)}–{info.hi.toFixed(1)} µm · {info.n}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <p className="text-muted-foreground">{t("fpl.detectorsHint")}</p>
        {wanted.length > 0 && (
          <p className="flex flex-wrap items-center gap-2" aria-live="polite">
            {loading && <Spinner className="size-3" />}
            {failed.length
              ? t("fpl.readProgressFailed", { settled, total: wanted.length, failed: failed.length, measured: points.length })
              : t("fpl.readProgress", { settled, total: wanted.length, measured: points.length })}
            {failed.length > 0 && !loading && (
              <Button size="xs" variant="outline" onClick={() => failed.forEach((r) => r.refetch())}>{t("fpl.retryFailed")}</Button>
            )}
          </p>
        )}
      </div>

      {points.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">{t("fpl.measurement")}</span>
            <ToggleGroup variant="outline" size="sm" value={[String(methodChoice)]} onValueChange={(v: string[]) => v[0] && setMethodChoice(v[0] === "auto" || v[0] === "core" ? v[0] : Number(v[0]))}>
              <ToggleGroupItem value="auto" className="text-xs">
                {auto === null ? t("fpl.autoNone") : auto === "core" ? t("fpl.autoCore") : t("fpl.autoRing", { inner: P.rings[auto][0], outer: P.rings[auto][1] })}
              </ToggleGroupItem>
              <ToggleGroupItem value="core" className="text-xs">{t("fpl.methodCore", { r: P.coreRadiusPx })}</ToggleGroupItem>
              {P.rings.map(([rIn, rOut], i) => (
                <ToggleGroupItem key={i} value={String(i)} className="text-xs">{t("fpl.methodRing", { inner: rIn, outer: rOut })}</ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          {saturated > 0 && (
            <Alert>
              <AlertCircleIcon />
              <AlertDescription>
                {t("fpl.saturatedLead", { n: saturated, total: points.length })}{" "}
                {auto === null && methodChoice === "auto"
                  ? t("fpl.saturatedNoRing")
                  : method !== "core"
                    ? t("fpl.saturatedRing", { ring: ringText })
                    : t("fpl.saturatedSwitch")}
              </AlertDescription>
            </Alert>
          )}
          {unmeasured > 0 && (
            <p className="text-amber-600 dark:text-amber-400">
              {t("fpl.unmeasured", { n: unmeasured })}
            </p>
          )}

          <section className="grid gap-2 rounded-md border p-3">
            <h3 className="text-sm font-medium">{t("fpl.changeTitle")}</h3>
            {visitStarts.length < 2 ? (
              <p className="text-muted-foreground">{t("fpl.oneVisitMeasured")}</p>
            ) : (
              comparisons.map(({ a, b, pairs }) => <Comparison key={`${a}-${b}`} a={a} b={b} starts={visitStarts} pairs={pairs} />)
            )}
            <p className="text-muted-foreground">
              {t("fpl.pairsNote", { fraction: P.matchBandwidthFraction, minPairs: P.minPairs, minChange: P.minChangeMag, sigma: P.sigma, version: P.version })}
            </p>
          </section>

          <section className="grid gap-2 rounded-md border p-3">
            <h3 className="text-sm font-medium">{t("fpl.spectrumTitle")}</h3>
            <SpectrumPlot points={points} method={method} visits={visits} />
            <div className="flex flex-wrap gap-3 text-muted-foreground">
              {visitStarts.map((mjd, v) => (
                <span key={v} className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ background: VISIT_COLORS[v % VISIT_COLORS.length] }} />
                  {t("fpl.visitFrom", { n: v + 1, date: mjdIso(mjd).slice(0, 10) })}
                </span>
              ))}
              {method === "core" && saturated > 0 && <span>{t("fpl.lowerLimitLegend")}</span>}
            </div>
            <p className="text-muted-foreground">
              {method === "core"
                ? t("fpl.coreNote", { r: P.coreRadiusPx, inner: P.backgroundPx[0], outer: P.backgroundPx[1] })
                : t("fpl.ringNote")}
            </p>
          </section>

          <div>
            <Button
              size="xs"
              variant="outline"
              onClick={() =>
                navigator.clipboard.writeText(
                  JSON.stringify({ position: { ra: at.ra, dec: at.dec }, method, rules: P, points, comparisons: comparisons.map((c) => ({ visitA: c.a + 1, visitB: c.b + 1, summary: summarizeChange(c.pairs), pairs: c.pairs.map((p) => ({ detector: p.detector, a: p.a.key, b: p.b.key, wavelengthUm: p.a.wavelengthUm, ratio: p.ratio, ratioError: p.ratioError })) })) }, null, 2),
                )
              }
            >
              <CopyIcon /> {t("fpl.copyMeasurements")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function Comparison({ a, b, starts, pairs }: { a: number; b: number; starts: number[]; pairs: ReturnType<typeof matchVisits> }) {
  const t = useT();
  const all = summarizeChange(pairs);
  const days = starts[b] - starts[a];
  const title = t("fpl.comparisonTitle", { a: a + 1, dateA: mjdIso(starts[a]).slice(0, 10), b: b + 1, dateB: mjdIso(starts[b]).slice(0, 10), days: days.toFixed(0) });
  if (!all) return <p>{richText(t("fpl.comparisonNone"), { title: <span className="font-medium">{title}:</span> })}</p>;
  const detectors = [...new Set(pairs.map((p) => p.detector))].sort();
  return (
    <div className="grid gap-1">
      <p>
        {richText(t("fpl.comparisonSummary", { change: describe(all), n: all.pairs }), {
          title: <span className="font-medium">{title}:</span>,
          verdict: <span className={all.verdict === "changed" ? "font-medium text-amber-600 dark:text-amber-400" : ""}>{t(VERDICT_TEXT[all.verdict])}</span>,
        })}
      </p>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("fpl.detector")}</TableHead>
              <TableHead>{t("fpl.colWavelengths")}</TableHead>
              <TableHead className="text-right">{t("fpl.colPairs")}</TableHead>
              <TableHead className="text-right">{t("fpl.colRatio")}</TableHead>
              <TableHead className="text-right">{t("fpl.colChange")}</TableHead>
              <TableHead>{t("fpl.colResult")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detectors.map((d) => {
              const ps = pairs.filter((p) => p.detector === d);
              const s = summarizeChange(ps)!;
              return (
                <TableRow key={d}>
                  <TableCell className="font-mono">{d}</TableCell>
                  <TableCell className="font-mono">{ps[0].a.wavelengthUm.toFixed(2)}–{ps[ps.length - 1].a.wavelengthUm.toFixed(2)} µm</TableCell>
                  <TableCell className="text-right font-mono">{s.pairs}</TableCell>
                  <TableCell className="text-right font-mono">{s.medianRatio.toFixed(3)}</TableCell>
                  <TableCell className="text-right font-mono">{s.deltaMag >= 0 ? "+" : "−"}{Math.abs(s.deltaMag).toFixed(3)} ± {s.deltaMagError.toFixed(3)}</TableCell>
                  <TableCell>{t(VERDICT_TEXT[s.verdict])}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <details>
        <summary className="cursor-pointer text-muted-foreground">{t("fpl.everyPair")}</summary>
        <div className="grid gap-0.5 pt-1 font-mono">
          {pairs.map((p) => (
            <span key={p.a.key + p.b.key}>
              {t("fpl.pairLine", { detector: p.detector, a: p.a.wavelengthUm.toFixed(3), b: p.b.wavelengthUm.toFixed(3), ratio: p.ratio.toFixed(3), error: p.ratioError.toFixed(3) })}
            </span>
          ))}
        </div>
      </details>
    </div>
  );
}

const W = 640;
const H = 260;
const M = { l: 56, r: 12, t: 10, b: 34 };

function SpectrumPlot({ points, method, visits }: { points: BrightnessPoint[]; method: BrightnessMethod; visits: Map<string, number> }) {
  const t = useT();
  const data = points
    .map((p) => ({ p, v: valueOf(p, method) }))
    .filter((d): d is { p: BrightnessPoint; v: NonNullable<ReturnType<typeof valueOf>> } => d.v !== null && d.v.fluxMjy > 0);
  if (!data.length) return <p className="text-muted-foreground">{t("fpl.noPositive")}</p>;
  const xs = data.map((d) => d.p.wavelengthUm);
  const ys = data.map((d) => Math.log10(d.v.fluxMjy));
  const pad = (lo: number, hi: number, share: number) => [lo - Math.max(1e-3, (hi - lo) * share), hi + Math.max(1e-3, (hi - lo) * share)] as const;
  const [x0, x1] = pad(Math.min(...xs), Math.max(...xs), 0.04);
  const [y0, y1] = pad(Math.min(...ys), Math.max(...ys), 0.1);
  const sx = (x: number) => M.l + ((x - x0) / (x1 - x0)) * (W - M.l - M.r);
  const sy = (logF: number) => H - M.b - ((logF - y0) / (y1 - y0)) * (H - M.t - M.b);
  const xTicks = Array.from({ length: 6 }, (_, i) => x0 + ((x1 - x0) * i) / 5);
  const yTicks = Array.from({ length: 5 }, (_, i) => y0 + ((y1 - y0) * i) / 4);
  const label = (logF: number) => {
    const f = 10 ** logF;
    return f >= 100 ? f.toFixed(0) : f >= 1 ? f.toFixed(1) : f.toPrecision(2);
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-3xl" role="img" aria-label={t("fpl.spectrumAria", { n: data.length })}>
      {xTicks.map((tick) => (
        <g key={tick}>
          <line x1={sx(tick)} x2={sx(tick)} y1={M.t} y2={H - M.b} className="stroke-border" strokeWidth={0.5} />
          <text x={sx(tick)} y={H - M.b + 14} textAnchor="middle" className="fill-muted-foreground" fontSize={10}>{tick.toFixed(2)}</text>
        </g>
      ))}
      {yTicks.map((tick) => (
        <g key={tick}>
          <line x1={M.l} x2={W - M.r} y1={sy(tick)} y2={sy(tick)} className="stroke-border" strokeWidth={0.5} />
          <text x={M.l - 6} y={sy(tick) + 3} textAnchor="end" className="fill-muted-foreground" fontSize={10}>{label(tick)}</text>
        </g>
      ))}
      <text x={(M.l + W - M.r) / 2} y={H - 4} textAnchor="middle" className="fill-muted-foreground" fontSize={10}>{t("fpl.axisWavelength")}</text>
      <text x={12} y={(M.t + H - M.b) / 2} textAnchor="middle" transform={`rotate(-90 12 ${(M.t + H - M.b) / 2})`} className="fill-muted-foreground" fontSize={10}>
        {method === "core" ? t("fpl.axisFlux") : t("fpl.axisRing")}
      </text>
      {data.map(({ p, v }) => {
        const color = VISIT_COLORS[(visits.get(p.key) ?? 0) % VISIT_COLORS.length];
        const x = sx(p.wavelengthUm);
        const y = sy(Math.log10(v.fluxMjy));
        const lowerLimit = method === "core" && p.coreExcludedPixels > 0;
        const title = t(lowerLimit ? "fpl.pointTitleLower" : "fpl.pointTitle", { key: p.key, wavelength: p.wavelengthUm.toFixed(3), flux: v.fluxMjy.toPrecision(4), error: v.errorMjy.toPrecision(2), date: mjdIso(p.mjd) });
        return lowerLimit ? (
          <path key={p.key} d={`M ${x - 3.5} ${y + 3} L ${x + 3.5} ${y + 3} L ${x} ${y - 4} Z`} fill="none" stroke={color} strokeWidth={1.2}><title>{title}</title></path>
        ) : (
          <circle key={p.key} cx={x} cy={y} r={2.6} fill={color} fillOpacity={0.85}><title>{title}</title></circle>
        );
      })}
    </svg>
  );
}
