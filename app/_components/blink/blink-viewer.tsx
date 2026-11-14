"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PauseIcon, PlayIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { skyToGrid } from "@/app/_lib/sky/wcs";
import { BLINK_FOV_ARCMIN, mjdDate, mjdMonth, useBlink, type VisitFrame } from "./blink-context";

type Mode = "blink" | "difference" | "stack";

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor((p / 100) * (s.length - 1))))];
}

function meanStack(frames: Float32Array[]) {
  const n = frames[0].length;
  const out = new Float32Array(n).fill(NaN);
  for (let k = 0; k < n; k++) {
    let s = 0, c = 0;
    for (const f of frames) if (Number.isFinite(f[k])) { s += f[k]; c++; }
    if (c) out[k] = s / c;
  }
  return out;
}

/** Grid image: grey asinh stretch, or a diverging blue–grey–orange map for differences. Missing data is transparent. */
function GridCanvas({ data, n, range, diverging }: { data: Float32Array | null; n: number; range: { lo: number; hi: number }; diverging: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(n, n);
    if (data) {
      for (let k = 0; k < data.length; k++) {
        const v = data[k];
        const p = k * 4;
        if (!Number.isFinite(v)) continue;
        if (diverging) {
          const t = Math.max(-1, Math.min(1, v / range.hi));
          const a = Math.abs(t);
          const [r, g, b] = t < 0 ? [42, 120, 214] : [235, 104, 52]; // blue (fainter) / orange (brighter)
          img.data[p] = Math.round(128 + (r - 128) * a);
          img.data[p + 1] = Math.round(128 + (g - 128) * a);
          img.data[p + 2] = Math.round(128 + (b - 128) * a);
        } else {
          const t = Math.max(0, Math.min(1, (v - range.lo) / (range.hi - range.lo || 1)));
          const g = Math.round((255 * Math.asinh(8 * t)) / Math.asinh(8));
          img.data[p] = g;
          img.data[p + 1] = g;
          img.data[p + 2] = g;
        }
        img.data[p + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [data, n, range, diverging]);
  return <canvas ref={ref} width={n} height={n} className="absolute inset-0 size-full [image-rendering:pixelated]" />;
}

export function BlinkViewer() {
  const { plan, usable, visits, grid, detector, setDetector, loadingFrames, frames, gaia } = useBlink();
  const [mode, setMode] = useState<Mode>("blink");
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [fps, setFps] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [showGaia, setShowGaia] = useState(true);

  const current: VisitFrame | undefined = usable[Math.min(idx, Math.max(0, usable.length - 1))];
  useEffect(() => {
    if (!playing || mode !== "blink" && mode !== "difference") return;
    if (usable.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % usable.length), 1000 / fps);
    return () => clearInterval(t);
  }, [playing, fps, usable.length, mode]);

  // One stretch for every visit (PLAN.md ch. 4), from all visit frames together.
  const sharedRange = useMemo(() => {
    const v: number[] = [];
    for (const u of usable) for (let k = 0; k < u.data!.length; k += 3) if (Number.isFinite(u.data![k])) v.push(u.data![k]);
    return { lo: percentile(v, 1), hi: percentile(v, 99.5) };
  }, [usable]);
  const first = usable[0];
  const diffData = useMemo(() => {
    if (!current?.data || !first?.data) return null;
    const out = new Float32Array(current.data.length);
    for (let k = 0; k < out.length; k++) out[k] = current.data[k] - first.data[k];
    return out;
  }, [current, first]);
  const diffRange = useMemo(() => {
    const v: number[] = [];
    for (const u of usable.slice(1)) for (let k = 0; k < u.data!.length; k += 3) {
      const d = u.data![k] - first!.data![k];
      if (Number.isFinite(d)) v.push(Math.abs(d));
    }
    return { lo: 0, hi: percentile(v, 99) || 1 };
  }, [usable, first]);
  const stackData = useMemo(() => (usable.length ? meanStack(usable.map((u) => u.data!)) : null), [usable]);

  // Gaia DR3 stars (G < 16) moved to the shown visit's date.
  const gaiaNow = mode === "stack" || !current ? null : gaia.get(current.visit.index);

  if (plan.isPending) return <Status text="Finding observations → reading cutouts → matching wavelength → aligning…" spinner />;
  if (plan.isError) {
    return (
      <Status text={`Could not build the comparison: ${plan.error.message}`}>
        <Button size="sm" variant="outline" onClick={() => plan.refetch()}>Try again</Button>
      </Status>
    );
  }
  const p = plan.data;
  if (p.status === "no-observations") return <Status text="No SPHEREx DR1 observation covers this point yet." />;

  const data = mode === "stack" ? stackData : mode === "difference" ? diffData : current?.data ?? null;
  const center = skyToGrid(grid, grid.ra, grid.dec);
  const pxPerArcsec = grid.n / (grid.fovArcmin * 60);

  return (
    <div className="grid h-full min-h-0 w-full grid-rows-[auto_minmax(0,1fr)_auto] gap-2 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        {p.detectors.map((d) => (
          <button
            key={d.detector}
            type="button"
            onClick={() => {
              setDetector(d.detector);
              setIdx(0);
            }}
            aria-pressed={d.detector === detector}
            title={`${d.exposures} exposures, ${d.visits} visits`}
            className={`rounded border px-2 py-1 ${d.detector === detector ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            <span className="font-medium">{d.detector}</span> <span className="opacity-75">{d.emMinUm.toFixed(2)}–{d.emMaxUm.toFixed(2)} µm · {d.visits}v</span>
          </button>
        ))}
      </div>

      <div className="relative min-h-0 overflow-auto rounded-md bg-[repeating-linear-gradient(45deg,#2a2a2a_0_4px,#1c1c1c_4px_8px)]">
        <div className="relative mx-auto aspect-square" style={{ width: `${zoom * 100}%`, maxWidth: zoom === 1 ? "min(100%, 62dvh)" : undefined }}>
          <GridCanvas data={data} n={grid.n} range={mode === "difference" ? diffRange : sharedRange} diverging={mode === "difference"} />
          <svg viewBox={`0 0 ${grid.n} ${grid.n}`} className="pointer-events-none absolute inset-0 size-full" aria-hidden>
            {center && (
              <g stroke="#38bdf8" strokeWidth={0.6}>
                <line x1={center.i + 0.5 - 7} x2={center.i + 0.5 - 3} y1={center.r + 0.5} y2={center.r + 0.5} />
                <line x1={center.i + 0.5 + 3} x2={center.i + 0.5 + 7} y1={center.r + 0.5} y2={center.r + 0.5} />
                <line y1={center.r + 0.5 - 7} y2={center.r + 0.5 - 3} x1={center.i + 0.5} x2={center.i + 0.5} />
                <line y1={center.r + 0.5 + 3} y2={center.r + 0.5 + 7} x1={center.i + 0.5} x2={center.i + 0.5} />
              </g>
            )}
            {showGaia &&
              gaiaNow?.map((s) => {
                const g = skyToGrid(grid, s.ra, s.dec);
                return g ? <circle key={s.sourceId} cx={g.i + 0.5} cy={g.r + 0.5} r={Math.max(2, 6 * pxPerArcsec)} fill="none" stroke="#a78bfa" strokeWidth={0.5} /> : null;
              })}
            <text x={grid.n - 9} y={7} fill="#fff" fillOpacity={0.7} fontSize={5}>N↑</text>
            <text x={2} y={grid.n - 3} fill="#fff" fillOpacity={0.7} fontSize={5}>←E</text>
          </svg>
          <div className="absolute top-1.5 left-1.5 rounded bg-black/65 px-1.5 py-0.5 font-mono text-[11px] text-white">
            {mode === "stack"
              ? `Stack of ${usable.length} visit(s)`
              : mode === "difference"
                ? `Visit ${current?.visit.index} − visit ${first?.visit.index}`
                : `Visit ${current?.visit.index} · ${current?.mid ? mjdDate(current.mid) : ""}`}
          </div>
        </div>
        {(loadingFrames || !usable.length) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-white">
            {loadingFrames ? <Spinner /> : null}
            <span>{loadingFrames ? `Reading cutouts (${frames.filter((f) => !f.loading).length}/${frames.length})…` : "No frame passed the checks for this detector."}</span>
          </div>
        )}
      </div>

      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup variant="outline" size="sm" spacing={0} value={[mode]} onValueChange={(v) => v[0] && setMode(v[0] as Mode)} aria-label="View mode">
            <ToggleGroupItem value="blink">Blink</ToggleGroupItem>
            <ToggleGroupItem value="difference" disabled={usable.length < 2}>Difference</ToggleGroupItem>
            <ToggleGroupItem value="stack">Stack</ToggleGroupItem>
          </ToggleGroup>
          <Button size="icon-sm" variant="outline" onClick={() => setPlaying(!playing)} aria-label={playing ? "Pause" : "Play"} disabled={usable.length < 2 || mode === "stack"}>
            {playing ? <PauseIcon /> : <PlayIcon />}
          </Button>
          <label className="flex items-center gap-1">
            Speed
            <select className="rounded border bg-transparent px-1 py-0.5" value={fps} onChange={(e) => setFps(Number(e.target.value))}>
              <option value={0.5}>0.5 / s</option>
              <option value={1}>1 / s</option>
              <option value={2}>2 / s</option>
            </select>
          </label>
          <label className="flex items-center gap-1">
            Zoom
            <select className="rounded border bg-transparent px-1 py-0.5" value={zoom} onChange={(e) => setZoom(Number(e.target.value))}>
              <option value={1}>1×</option>
              <option value={2}>2×</option>
              <option value={4}>4×</option>
            </select>
          </label>
          <Label className="flex items-center gap-1.5 text-xs font-normal">
            <Switch size="sm" checked={showGaia} onCheckedChange={setShowGaia} /> Gaia DR3 (G &lt; 16) at each visit&apos;s date
          </Label>
        </div>
        {mode !== "stack" && usable.length > 1 && (
          <label className="flex items-center gap-2">
            {/* Position among the visits shown (usable); the visit number stays the plan's, as in the exposure list. */}
            <span className="w-36 shrink-0" title={usable.length < visits.length ? `${visits.length - usable.length} of ${visits.length} visits have no frame within the wavelength tolerance` : undefined}>
              {Math.min(idx, usable.length - 1) + 1} / {usable.length} · Visit {current?.visit.index ?? 0}
            </span>
            <input
              type="range"
              min={0}
              max={usable.length - 1}
              value={Math.min(idx, usable.length - 1)}
              onChange={(e) => {
                setPlaying(false);
                setIdx(Number(e.target.value));
              }}
              aria-valuetext={current?.mid ? `${Math.min(idx, usable.length - 1) + 1} of ${usable.length} shown: visit ${current.visit.index}, ${mjdMonth(current.mid)}` : undefined}
              className="w-full"
            />
          </label>
        )}
        <p className="text-muted-foreground">
          {BLINK_FOV_ARCMIN}′ fixed sky grid centred on the point (not on any object) · same stretch for every visit · zodiacal light (ZODI) removed ·{" "}
          {mode === "difference" ? "orange = brighter, blue = fainter than the first visit; PSF and background changes leave residuals too." : "screen brightness is for viewing only."}
        </p>
      </div>
    </div>
  );
}

function Status({ text, spinner, children }: { text: string; spinner?: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex aspect-square h-full max-h-full max-w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm">
      {spinner && <Spinner />}
      <p className="max-w-xs text-muted-foreground">{text}</p>
      {children}
    </div>
  );
}

/** Right-panel summary (PLAN.md ch. 5): visits, period, detector and wavelength, status, and per-visit details. */
export function BlinkSummary() {
  const { plan, usable, visits, detector, frames } = useBlink();
  if (plan.isPending) return <p className="text-muted-foreground">Finding SPHEREx observations…</p>;
  if (plan.isError) return <p className="text-destructive">{plan.error.message}</p>;
  const p = plan.data;
  if (p.status === "no-observations") return <p className="text-muted-foreground">No SPHEREx DR1 observation covers this point.</p>;
  const mids = usable.map((u) => u.mid!).sort((a, b) => a - b);
  const loaded = !frames.some((f) => f.loading);
  const visitsWithData = loaded ? usable.length : visits.filter((v) => v.visit.exposures.some((e) => !e.excluded)).length;
  const additional = loaded ? usable.length < 2 : p.status === "additional-analysis-needed";

  return (
    <div className="grid gap-2">
      <p className="font-mono">
        {visitsWithData} visit{visitsWithData === 1 ? "" : "s"}
        {loaded && visits.length > visitsWithData && ` (${visits.length - visitsWithData} of ${visits.length} without a ${detector} frame in tolerance)`}
        {mids.length > 0 && ` · ${mjdMonth(mids[0])}${mids.length > 1 ? ` → ${mjdMonth(mids[mids.length - 1])}` : ""}`} · {detector}{" "}
        {p.referenceWavelengthUm != null && `${p.referenceWavelengthUm.toFixed(3)} µm`}
      </p>
      {additional ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
          <p className="font-medium">Additional analysis needed</p>
          <p>Only one SPHEREx visit, so SPHEREx images alone cannot be compared. Run an additional analysis to compare with earlier surveys.</p>
        </div>
      ) : (
        <Badge variant="secondary" className="w-fit">Comparable</Badge>
      )}
      <p className="text-xs text-muted-foreground">
        Frames in a visit are combined only within {p.toleranceUm != null ? `±${p.toleranceUm.toFixed(3)} µm` : "the tolerance"} of {p.referenceWavelengthUm?.toFixed(3)} µm ({p.toleranceRule}); the wavelength is re-read from each file.
      </p>
      <details className="text-xs">
        <summary className="cursor-pointer select-none">Observations ({frames.length} frames used, {visits.reduce((n, v) => n + v.visit.exposures.filter((e) => e.excluded).length, 0)} skipped)</summary>
        <ul className="mt-1 grid gap-1">
          {visits.map((v) => (
            <li key={v.visit.index}>
              <span className="font-medium">Visit {v.visit.index}</span> · {mjdDate(v.visit.start)} → {mjdDate(v.visit.end)}
              {v.frames.length === 0 && <span className="text-muted-foreground"> · no {detector} frame within the wavelength tolerance</span>}
              <ul className="pl-3">
                {v.frames.map((f) => (
                  <li key={f.exposure.key} className="font-mono">
                    {f.exposure.obsId} · {f.wavelengthUm != null ? `${f.wavelengthUm.toFixed(3)} µm` : f.loading ? "reading…" : "—"}
                    {f.flagsAtTarget.length > 0 && ` · flags at point: ${f.flagsAtTarget.join("+")}`}
                    {f.dropped && <span className="text-amber-600"> · dropped: {f.dropped}</span>}
                    {f.error && <span className="text-destructive"> · {f.error}</span>}{" "}
                    {f.frame && <a href={f.frame.payload.fileUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">IRSA</a>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

/** Shown instead of the panel until every image the blink viewer needs has arrived. */
export function BlinkLoading() {
  const { progress } = useBlink();
  const pct = Math.round((progress.done / Math.max(1, progress.total)) * 100);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center" aria-live="polite">
      <Spinner />
      <div className="grid w-full max-w-md gap-2">
        <Progress value={pct} aria-label="Loading the SPHEREx images for this point" />
        <p className="text-sm">{progress.step}</p>
        <p className="text-xs text-muted-foreground">
          {progress.done} / {progress.total} done · {progress.total - progress.done} left. Everything is downloaded first so the blink plays without waiting.
        </p>
      </div>
    </div>
  );
}

/** Renders the panel once the blink data is complete. */
export function BlinkGate({ children }: { children: React.ReactNode }) {
  const { ready } = useBlink();
  return ready ? <>{children}</> : <BlinkLoading />;
}
