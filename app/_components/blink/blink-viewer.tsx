"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, PauseIcon, PlayIcon } from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { skyToGrid } from "@/app/_lib/sky/wcs";
import { useAnalyses } from "../analyses/analyses-context";
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

/** Keys that belong to the focused control, not to the viewer. */
function keyOwnedByControl(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return true;
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return false;
  if (target.closest("input, textarea, select, [contenteditable=''], [contenteditable='true'], [role=slider]")) return true;
  // Arrow keys move focus inside button groups and tab lists; Space presses a focused button.
  if (event.key.startsWith("Arrow") && target.closest("[role=group], [role=tablist], [role=radiogroup]")) return true;
  if (event.key === " " && target.closest("button, a, [role=tab]")) return true;
  return false;
}

const MODE_KEYS: Record<string, Mode> = { "1": "blink", "2": "difference", "3": "stack" };

export function BlinkViewer() {
  const { plan, usable, visits, grid, detector, setDetector, loadingFrames, frames, gaia } = useBlink();
  const visible = useAnalyses().view === "blink";
  const [mode, setMode] = useState<Mode>("blink");
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [fps, setFps] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [showGaia, setShowGaia] = useState(true);

  const count = usable.length;
  const at = Math.min(idx, Math.max(0, count - 1));
  const current: VisitFrame | undefined = usable[at];
  const canPlay = count > 1 && mode !== "stack";
  useEffect(() => {
    // Not while another tab covers the viewer: nobody is watching.
    if (!playing || !canPlay || !visible) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % count), 1000 / fps);
    return () => clearInterval(t);
  }, [playing, fps, count, canPlay, visible]);

  const step = useCallback(
    (delta: number) => {
      if (count < 2) return;
      setPlaying(false);
      setIdx((i) => (Math.min(i, count - 1) + delta + count) % count);
    },
    [count],
  );

  // Space play/pause, ←/→ previous/next visit, 1/2/3 view mode — only while the viewer is the visible tab.
  const keys = useRef({ step, count });
  useEffect(() => {
    keys.current = { step, count };
  }, [step, count]);
  useEffect(() => {
    if (!visible) return;
    const onKey = (event: KeyboardEvent) => {
      if (keyOwnedByControl(event)) return;
      const k = keys.current;
      if (event.key === " ") setPlaying((p) => !p);
      else if (event.key === "ArrowLeft") k.step(-1);
      else if (event.key === "ArrowRight") k.step(1);
      else if (MODE_KEYS[event.key] && !(MODE_KEYS[event.key] === "difference" && k.count < 2)) setMode(MODE_KEYS[event.key]);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible]);

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
  // Visit labels under the slider: all of them when they fit, otherwise about eight spread evenly.
  const labelEvery = Math.max(1, Math.ceil(count / 8));

  return (
    <div className="grid h-full min-h-0 w-full grid-rows-[auto_minmax(0,1fr)_auto] gap-2 text-xs">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Detector">
        <span className="mr-1 text-muted-foreground">Detector</span>
        {p.detectors.map((d) => {
          const few = d.visits < 2;
          return (
            <button
              key={d.detector}
              type="button"
              onClick={() => {
                setDetector(d.detector);
                setIdx(0);
              }}
              aria-pressed={d.detector === detector}
              title={`${d.exposures} exposures in ${d.visits} visit${d.visits === 1 ? "" : "s"}${few ? " · one visit cannot be blinked on its own" : ""}`}
              className={cn(
                "rounded border px-2 py-1",
                d.detector === detector ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                few && d.detector !== detector && "opacity-55",
              )}
            >
              <span className="font-medium">{d.detector}</span>{" "}
              <span className="opacity-75">
                {d.emMinUm.toFixed(2)}–{d.emMaxUm.toFixed(2)} µm · {d.visits} visit{d.visits === 1 ? "" : "s"}
              </span>
            </button>
          );
        })}
      </div>

      {/* The image is as large as the shorter side of this box allows (cqmin); zoom scrolls inside it. Hatching sits only
          behind the image, where it shows pixels without data; the space around the image stays plain. */}
      <div className="relative grid min-h-0 overflow-auto rounded-md bg-black/40 [container-type:size]">
        <div className="relative m-auto aspect-square shrink-0 bg-[repeating-linear-gradient(45deg,#2a2a2a_0_4px,#1c1c1c_4px_8px)]" style={{ width: `${zoom * 100}cqmin` }}>
          <GridCanvas data={data} n={grid.n} range={mode === "difference" ? diffRange : sharedRange} diverging={mode === "difference"} />
          <svg viewBox={`0 0 ${grid.n} ${grid.n}`} className="pointer-events-none absolute inset-0 size-full" aria-hidden>
            {center && (
              <g stroke={POINT_COLOR} strokeWidth={0.6}>
                <line x1={center.i + 0.5 - 7} x2={center.i + 0.5 - 3} y1={center.r + 0.5} y2={center.r + 0.5} />
                <line x1={center.i + 0.5 + 3} x2={center.i + 0.5 + 7} y1={center.r + 0.5} y2={center.r + 0.5} />
                <line y1={center.r + 0.5 - 7} y2={center.r + 0.5 - 3} x1={center.i + 0.5} x2={center.i + 0.5} />
                <line y1={center.r + 0.5 + 3} y2={center.r + 0.5 + 7} x1={center.i + 0.5} x2={center.i + 0.5} />
              </g>
            )}
            {showGaia &&
              gaiaNow?.map((s) => {
                const g = skyToGrid(grid, s.ra, s.dec);
                return g ? <circle key={s.sourceId} cx={g.i + 0.5} cy={g.r + 0.5} r={Math.max(2, 6 * pxPerArcsec)} fill="none" stroke={GAIA_COLOR} strokeWidth={0.5} /> : null;
              })}
            <text x={grid.n - 9} y={7} fill="#fff" fillOpacity={0.7} fontSize={5}>N↑</text>
            <text x={2} y={grid.n - 3} fill="#fff" fillOpacity={0.7} fontSize={5}>←E</text>
          </svg>
          <div className="absolute top-1.5 left-1.5 rounded bg-black/65 px-1.5 py-0.5 font-mono text-[11px] text-white">
            {mode === "stack"
              ? `Stack of ${count} visit(s)`
              : mode === "difference"
                ? `Visit ${current?.visit.index} − visit ${first?.visit.index}`
                : `Visit ${current?.visit.index} · ${current?.mid ? mjdDate(current.mid) : ""}`}
          </div>
        </div>
        {(loadingFrames || !count) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-white">
            {loadingFrames ? <Spinner /> : null}
            <span>{loadingFrames ? `Reading cutouts (${frames.filter((f) => !f.loading).length}/${frames.length})…` : "No frame passed the checks for this detector."}</span>
          </div>
        )}
      </div>

      <div className="grid gap-2">
        {mode !== "stack" && count > 1 && (
          <div className="flex items-start gap-2">
            <Button size="icon-sm" variant="outline" onClick={() => step(-1)} aria-label="Previous visit (←)" title="Previous visit (←)">
              <ChevronLeftIcon />
            </Button>
            <Button size="icon-sm" variant="outline" onClick={() => setPlaying(!playing)} aria-label={playing ? "Pause (Space)" : "Play (Space)"} title={playing ? "Pause (Space)" : "Play (Space)"}>
              {playing ? <PauseIcon /> : <PlayIcon />}
            </Button>
            <Button size="icon-sm" variant="outline" onClick={() => step(1)} aria-label="Next visit (→)" title="Next visit (→)">
              <ChevronRightIcon />
            </Button>
            {/* Position among the visits shown (usable); the visit number stays the plan's, as in the exposure list. */}
            <div className="grid min-w-0 flex-1 gap-1 pt-2">
              <Slider
                min={0}
                max={count - 1}
                step={1}
                value={[at]}
                onValueChange={(v) => {
                  setPlaying(false);
                  setIdx(Array.isArray(v) ? v[0] : v);
                }}
                aria-label="Visit"
              />
              <div className="relative h-4 font-mono text-[10px] text-muted-foreground">
                {usable.map((u, k) =>
                  k % labelEvery === 0 || k === count - 1 ? (
                    <span
                      key={u.visit.index}
                      className={cn("absolute -translate-x-1/2 whitespace-nowrap", k === at && "text-foreground")}
                      style={{ left: `calc(8px + (100% - 16px) * ${k / (count - 1)})` }}
                    >
                      {u.mid ? mjdMonth(u.mid) : `V${u.visit.index}`}
                    </span>
                  ) : null,
                )}
              </div>
            </div>
            <span
              className="w-24 shrink-0 pt-1.5 text-right"
              title={count < visits.length ? `${visits.length - count} of ${visits.length} visits have no frame within the wavelength tolerance` : undefined}
            >
              {at + 1} / {count} · Visit {current?.visit.index ?? 0}
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <ToggleGroup variant="outline" size="sm" spacing={0} value={[mode]} onValueChange={(v) => v[0] && setMode(v[0] as Mode)} aria-label="View mode">
            <ToggleGroupItem value="blink" title="Blink (1)">Blink</ToggleGroupItem>
            <ToggleGroupItem value="difference" disabled={count < 2} title={count < 2 ? "Needs two or more visits" : "Difference (2)"}>Difference</ToggleGroupItem>
            <ToggleGroupItem value="stack" title="Stack (3)">Stack</ToggleGroupItem>
          </ToggleGroup>
          <ControlGroup label="Speed" disabled={!canPlay}>
            <ToggleGroup variant="outline" size="sm" spacing={0} value={[String(fps)]} onValueChange={(v) => v[0] && setFps(Number(v[0]))} aria-label="Blink speed" disabled={!canPlay}>
              {[0.5, 1, 2].map((s) => (
                <ToggleGroupItem key={s} value={String(s)}>{s}/s</ToggleGroupItem>
              ))}
            </ToggleGroup>
          </ControlGroup>
          <ControlGroup label="Zoom">
            <ToggleGroup variant="outline" size="sm" spacing={0} value={[String(zoom)]} onValueChange={(v) => v[0] && setZoom(Number(v[0]))} aria-label="Zoom">
              {[1, 2, 4].map((z) => (
                <ToggleGroupItem key={z} value={String(z)}>{z}×</ToggleGroupItem>
              ))}
            </ToggleGroup>
          </ControlGroup>
          <Label className="flex items-center gap-1.5 text-xs font-normal">
            <Switch size="sm" checked={showGaia} onCheckedChange={setShowGaia} /> Gaia DR3 (G &lt; 16) at each visit&apos;s date
          </Label>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground" aria-label="Legend">
          <LegendItem swatch={<span className="text-sm leading-none" style={{ color: POINT_COLOR }}>⌖</span>}>Selected point</LegendItem>
          {showGaia && mode !== "stack" && (
            <LegendItem swatch={<span className="size-2.5 rounded-full border" style={{ borderColor: GAIA_COLOR }} />}>Gaia star at this date</LegendItem>
          )}
          {mode === "difference" && (
            <>
              <LegendItem swatch={<span className="size-2.5 rounded-sm bg-[#eb6834]" />}>Brighter than first visit</LegendItem>
              <LegendItem swatch={<span className="size-2.5 rounded-sm bg-[#2a78d6]" />}>Fainter</LegendItem>
            </>
          )}
          {count < 2 && <span>Difference needs two or more visits.</span>}
          <span className="ml-auto">
            <Kbd>Space</Kbd> play · <Kbd>←</Kbd> <Kbd>→</Kbd> step · <Kbd>1</Kbd>–<Kbd>3</Kbd> mode
          </span>
        </div>

        <p className="text-muted-foreground">
          {BLINK_FOV_ARCMIN}′ fixed sky grid centred on the point (not on any object) · same stretch for every visit · zodiacal light (ZODI) removed ·{" "}
          {mode === "difference" ? "PSF and background changes leave residuals too." : "screen brightness is for viewing only."}
        </p>
      </div>
    </div>
  );
}

const POINT_COLOR = "#38bdf8";
const GAIA_COLOR = "#a78bfa";

function ControlGroup({ label, disabled, children }: { label: string; disabled?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("flex items-center gap-1.5", disabled && "opacity-50")}>
      <span className="text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function LegendItem({ swatch, children }: { swatch: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      {swatch}
      {children}
    </span>
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
      {additional ? (
        <div className="grid gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
          <p className="text-sm font-medium">Additional analysis needed</p>
          <p>Only one SPHEREx visit, so SPHEREx images alone cannot be compared. Run an additional analysis to compare with earlier surveys.</p>
          <RecommendedAnalysis />
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Comparable</Badge>
          <span className="text-xs text-muted-foreground">Two or more SPHEREx visits on the same detector and wavelength.</span>
        </div>
      )}
      <p className="font-mono">
        {visitsWithData} visit{visitsWithData === 1 ? "" : "s"}
        {loaded && visits.length > visitsWithData && ` (${visits.length - visitsWithData} of ${visits.length} without a ${detector} frame in tolerance)`}
        {mids.length > 0 && ` · ${mjdMonth(mids[0])}${mids.length > 1 ? ` → ${mjdMonth(mids[mids.length - 1])}` : ""}`} · {detector}{" "}
        {p.referenceWavelengthUm != null && `${p.referenceWavelengthUm.toFixed(3)} µm`}
      </p>
      <details className="text-xs">
        <summary className="cursor-pointer select-none">How frames are matched</summary>
        <p className="mt-1 text-muted-foreground">
          Frames in a visit are combined only within {p.toleranceUm != null ? `±${p.toleranceUm.toFixed(3)} µm` : "the tolerance"} of {p.referenceWavelengthUm?.toFixed(3)} µm ({p.toleranceRule}); the wavelength is re-read from each file.
        </p>
      </details>
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

/** One-visit points: Sky Time Machine compares positions with 2MASS and WISE, so it is the first thing to try. */
function RecommendedAnalysis() {
  const { jobs, run } = useAnalyses();
  const job = jobs["sky-time-machine"];
  return (
    <Button size="sm" variant="secondary" className="w-fit" disabled={job.status === "running"} onClick={() => run("sky-time-machine")}>
      <PlayIcon />
      {job.status === "running" ? "Sky Time Machine downloading…" : "Compare with earlier surveys (Sky Time Machine)"}
    </Button>
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
