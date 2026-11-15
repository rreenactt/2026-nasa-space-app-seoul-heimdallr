"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, PauseIcon, PlayIcon } from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { type Translate, useT } from "@/app/_i18n/i18n-provider";
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
  const t = useT();
  const { plan, usable, visits, grid, detector, setDetector, loadingFrames, frames, gaia } = useBlink();
  const visible = useAnalyses().view === "blink";
  const [mode, setMode] = useState<Mode>("blink");
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [fps, setFps] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [showGaia, setShowGaia] = useState(true);

  const count = usable.length;
  // In Difference the first visit is the reference, so only later visits are shown (visit 1 − visit 1 is blank).
  const lo = mode === "difference" && count > 1 ? 1 : 0;
  const clampIdx = useCallback((i: number) => Math.max(lo, Math.min(i, count - 1)), [lo, count]);
  const at = count ? clampIdx(idx) : 0;
  const current: VisitFrame | undefined = usable[at];
  const canPlay = count > 1 && mode !== "stack";
  useEffect(() => {
    // Not while another tab covers the viewer: nobody is watching.
    if (!playing || !canPlay || !visible) return;
    const timer = setInterval(() => setIdx((i) => (clampIdx(i) + 1 > count - 1 ? lo : clampIdx(i) + 1)), 1000 / fps);
    return () => clearInterval(timer);
  }, [playing, fps, count, canPlay, visible, clampIdx, lo]);

  const step = useCallback(
    (delta: number) => {
      if (count < 2) return;
      setPlaying(false);
      const n = count - lo;
      setIdx((i) => lo + ((clampIdx(i) - lo + delta + n) % n));
    },
    [count, lo, clampIdx],
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

  if (plan.isPending) return <Status text={t("blink.planning")} spinner />;
  if (plan.isError) {
    return (
      <Status text={t("blink.planFailed", { message: plan.error.message })}>
        <Button size="sm" variant="outline" onClick={() => plan.refetch()}>{t("analyses.tryAgain")}</Button>
      </Status>
    );
  }
  const p = plan.data;
  if (p.status === "no-observations") return <Status text={t("blink.noObservationsYet")} />;

  const data = mode === "stack" ? stackData : mode === "difference" ? diffData : current?.data ?? null;
  const center = skyToGrid(grid, grid.ra, grid.dec);
  const pxPerArcsec = grid.n / (grid.fovArcmin * 60);

  return (
    <div className="grid h-full min-h-0 w-full grid-rows-[auto_minmax(0,1fr)_auto] gap-2 text-xs">
      <div className="grid gap-1">
        {/* On a phone the six bands stay on one line and scroll sideways, so the image keeps its room. */}
        <div className="flex items-center gap-1.5 max-sm:-mx-4 max-sm:overflow-x-auto max-sm:px-4 max-sm:pb-1 sm:flex-wrap" role="group" aria-label={t("blink.bandGroup")}>
          <span className="mr-1 shrink-0 text-muted-foreground">{t("blink.band")}</span>
          {p.detectors.map((d) => {
            const few = d.visits < 2;
            const on = d.detector === detector;
            return (
              <button
                key={d.detector}
                type="button"
                onClick={() => {
                  setDetector(d.detector);
                  setIdx(0);
                }}
                aria-pressed={on}
                title={t(few ? "blink.detectorTitleFew" : "blink.detectorTitle", { detector: d.detector, exposures: d.exposures, visits: d.visits })}
                className={cn(
                  "flex shrink-0 items-baseline gap-1.5 rounded border px-2 py-1",
                  on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                  few && !on && "opacity-55",
                )}
              >
                <span className="font-medium">
                  {d.emMinUm.toFixed(2)}–{d.emMaxUm.toFixed(2)} µm
                </span>
                <span className="text-[10px] opacity-70">
                  {t(d.visits === 1 ? "blink.detectorVisitsOne" : "blink.detectorVisitsOther", { detector: d.detector, n: d.visits })}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">{t("blink.bandNote")}</p>
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
          <div className="absolute top-2 left-2 grid gap-0.5 rounded bg-black/70 px-2 py-1 text-white">
            <span className="font-mono text-sm font-medium">
              {mode === "stack"
                ? t(count === 1 ? "blink.meanOne" : "blink.meanOther", { n: count })
                : mode === "difference"
                  ? `${fmtDate(current?.mid)} − ${fmtDate(first?.mid)}`
                  : fmtDate(current?.mid)}
            </span>
            <span className="text-[11px] text-white/75">
              {mode === "stack"
                ? `${fmtDate(first?.mid)} → ${fmtDate(usable[count - 1]?.mid)}`
                : mode === "difference"
                  ? t("blink.diffCaption", { a: current?.visit.index ?? "", b: first?.visit.index ?? "", elapsed: fmtElapsed(current?.mid, first?.mid, t) })
                  : at > 0
                    ? t("blink.visitSince", { n: at + 1, count, elapsed: fmtElapsed(current?.mid, first?.mid, t) })
                    : t("blink.visitFirst", { n: at + 1, count })}
            </span>
          </div>
        </div>
        {(loadingFrames || !count) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-white">
            {loadingFrames ? <Spinner /> : null}
            <span>{loadingFrames ? t("blink.readingCutouts", { done: frames.filter((f) => !f.loading).length, total: frames.length }) : t("blink.noFrame")}</span>
          </div>
        )}
      </div>

      <div className="grid gap-2">
        {mode !== "stack" && count > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="icon-sm" variant="outline" onClick={() => step(-1)} aria-label={t("blink.prevVisit")} title={t("blink.prevVisit")}>
              <ChevronLeftIcon />
            </Button>
            <Button size="icon-sm" variant="outline" onClick={() => setPlaying(!playing)} aria-label={t(playing ? "blink.pause" : "blink.play")} title={t(playing ? "blink.pause" : "blink.play")}>
              {playing ? <PauseIcon /> : <PlayIcon />}
            </Button>
            <Button size="icon-sm" variant="outline" onClick={() => step(1)} aria-label={t("blink.nextVisit")} title={t("blink.nextVisit")}>
              <ChevronRightIcon />
            </Button>
            <VisitTimeline
              visits={usable}
              at={at}
              onPick={(k) => {
                setPlaying(false);
                setIdx(k);
              }}
            />
            <ExposureSpan visit={current} total={visits.length} shown={count} />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <ToggleGroup variant="outline" size="sm" spacing={0} value={[mode]} onValueChange={(v) => v[0] && setMode(v[0] as Mode)} aria-label={t("blink.viewMode")}>
            <ToggleGroupItem value="blink" title={t("blink.blinkTitle")}>{t("blink.blink")}</ToggleGroupItem>
            <ToggleGroupItem value="difference" disabled={count < 2} title={t(count < 2 ? "blink.needsTwoVisits" : "blink.differenceTitle")}>
              {t("blink.difference")}
            </ToggleGroupItem>
            <ToggleGroupItem value="stack" title={t("blink.stackTitle")}>{t("blink.stack")}</ToggleGroupItem>
          </ToggleGroup>
          <ControlGroup label={t("blink.speed")} disabled={!canPlay}>
            <ToggleGroup variant="outline" size="sm" spacing={0} value={[String(fps)]} onValueChange={(v) => v[0] && setFps(Number(v[0]))} aria-label={t("blink.speedLabel")} disabled={!canPlay}>
              {[0.5, 1, 2].map((s) => (
                <ToggleGroupItem key={s} value={String(s)}>{s}/s</ToggleGroupItem>
              ))}
            </ToggleGroup>
          </ControlGroup>
          <ControlGroup label={t("blink.zoom")}>
            <ToggleGroup variant="outline" size="sm" spacing={0} value={[String(zoom)]} onValueChange={(v) => v[0] && setZoom(Number(v[0]))} aria-label={t("blink.zoom")}>
              {[1, 2, 4].map((z) => (
                <ToggleGroupItem key={z} value={String(z)}>{z}×</ToggleGroupItem>
              ))}
            </ToggleGroup>
          </ControlGroup>
          <Label className="flex items-center gap-1.5 text-xs font-normal">
            <Switch size="sm" checked={showGaia} onCheckedChange={setShowGaia} /> {t("blink.gaiaToggle")}
          </Label>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground" aria-label={t("blink.legend")}>
          <LegendItem swatch={<span className="text-sm leading-none" style={{ color: POINT_COLOR }}>⌖</span>}>{t("blink.legendPoint")}</LegendItem>
          {showGaia && mode !== "stack" && (
            <LegendItem swatch={<span className="size-2.5 rounded-full border" style={{ borderColor: GAIA_COLOR }} />}>{t("blink.legendGaia")}</LegendItem>
          )}
          {mode === "difference" && (
            <>
              <LegendItem swatch={<span className="size-2.5 rounded-sm bg-[#eb6834]" />}>{t("blink.legendBrighter")}</LegendItem>
              <LegendItem swatch={<span className="size-2.5 rounded-sm bg-[#2a78d6]" />}>{t("blink.legendFainter")}</LegendItem>
            </>
          )}
          {count < 2 && <span>{t("blink.differenceNeedsTwo")}</span>}
          {/* Keys mean nothing on a touch screen. */}
          <span className="ml-auto max-sm:hidden">
            <Kbd>Space</Kbd> {t("blink.keyPlay")} · <Kbd>←</Kbd> <Kbd>→</Kbd> {t("blink.keyStep")} · <Kbd>1</Kbd>–<Kbd>3</Kbd> {t("blink.keyMode")}
          </span>
        </div>

        <p className="text-muted-foreground">
          {t(mode === "difference" ? "blink.footnoteDifference" : "blink.footnote", { fov: BLINK_FOV_ARCMIN })}
        </p>
      </div>
    </div>
  );
}

/** UTC date of an MJD, or a dash when the visit has no usable frame time. */
function fmtDate(mjd: number | null | undefined) {
  return mjd == null ? "—" : mjdDate(mjd);
}

/** Time between two MJDs in the unit a reader thinks in: hours, days, months or years. */
function fmtElapsed(a: number | null | undefined, b: number | null | undefined, t: Translate) {
  if (a == null || b == null) return "—";
  const days = Math.abs(a - b);
  if (days < 1) return t("blink.elapsedHours", { n: Math.round(days * 24) });
  if (days < 60) return t("blink.elapsedDays", { n: Math.round(days) });
  if (days < 730) return t("blink.elapsedMonths", { n: (days / 30.44).toFixed(1) });
  return t("blink.elapsedYears", { n: (days / 365.25).toFixed(1) });
}

/**
 * Visits placed by their real observation time, so a one-month gap and a five-month gap look different. Each dot is
 * the mean time of the exposures combined into that visit's frame.
 */
function VisitTimeline({ visits, at, onPick }: { visits: VisitFrame[]; at: number; onPick: (k: number) => void }) {
  const t = useT();
  const mids = visits.map((v) => v.mid);
  const t0 = mids[0] ?? 0;
  const t1 = mids[mids.length - 1] ?? t0;
  const span = t1 - t0 || 1;
  const pos = (k: number) => (mids[k] == null ? k / Math.max(1, visits.length - 1) : (mids[k]! - t0) / span);
  // Date labels are about 64px wide: keep the shown visit, then the ends, then the rest, skipping any that would touch.
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const gap = width ? 80 / width : 1;
  const kept: number[] = [];
  for (const k of [at, 0, visits.length - 1, ...visits.map((_, i) => i)]) {
    if (!kept.includes(k) && kept.every((j) => Math.abs(pos(j) - pos(k)) >= gap)) kept.push(k);
  }
  const labelled = (k: number) => kept.includes(k);
  return (
    <div ref={ref} className="relative h-10 min-w-40 flex-1" role="group" aria-label={t("blink.timeline")}>
      <div className="absolute inset-x-2 top-2.5 h-px bg-border" />
      {visits.map((v, k) => {
        const on = k === at;
        const left = `calc(8px + (100% - 16px) * ${pos(k)})`;
        return (
          <div key={v.visit.index}>
            <button
              type="button"
              onClick={() => onPick(k)}
              aria-pressed={on}
              aria-label={t("blink.visitAria", { n: k + 1, total: visits.length, date: fmtDate(v.mid) })}
              title={t("blink.visitTitle", { n: k + 1, date: fmtDate(v.mid) })}
              className={cn(
                "absolute top-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all",
                on ? "size-3.5 bg-primary ring-4 ring-primary/25" : "size-2.5 bg-muted-foreground hover:bg-foreground",
              )}
              style={{ left }}
            />
            {labelled(k) && (
              <span
                className={cn(
                  "absolute top-5 font-mono text-[10px] whitespace-nowrap",
                  k === 0 || k === visits.length - 1 ? "" : "-translate-x-1/2",
                  on ? "text-foreground" : "text-muted-foreground",
                )}
                style={k === 0 ? { left: 0 } : k === visits.length - 1 ? { right: 0 } : { left }}
              >
                {fmtDate(v.mid)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** What the shown frame is made of: how many exposures, taken over which days (UTC). */
function ExposureSpan({ visit, total, shown }: { visit: VisitFrame | undefined; total: number; shown: number }) {
  const t = useT();
  const used = visit?.frames.filter((f) => f.grid) ?? [];
  const start = used.length ? Math.min(...used.map((f) => f.exposure.tStart)) : null;
  const end = used.length ? Math.max(...used.map((f) => f.exposure.tEnd)) : null;
  const sameDay = start != null && end != null && fmtDate(start) === fmtDate(end);
  return (
    <div
      className="w-full shrink-0 leading-tight sm:w-44 sm:text-right"
      title={shown < total ? t("blink.visitsHidden", { n: total - shown, total }) : undefined}
    >
      <p className="font-medium">
        {t(used.length === 1 ? "blink.exposuresOne" : "blink.exposuresOther", { n: used.length })}
      </p>
      <p className="font-mono text-[10px] text-muted-foreground">
        {start == null ? "—" : sameDay ? fmtDate(start) : `${fmtDate(start)} → ${fmtDate(end).slice(5)}`}
      </p>
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
  const t = useT();
  const { plan, usable, visits, detector, frames } = useBlink();
  if (plan.isPending) return <p className="text-muted-foreground">{t("blink.findingObservations")}</p>;
  if (plan.isError) return <p className="text-destructive">{plan.error.message}</p>;
  const p = plan.data;
  if (p.status === "no-observations") return <p className="text-muted-foreground">{t("blink.noObservations")}</p>;
  const mids = usable.map((u) => u.mid!).sort((a, b) => a - b);
  const loaded = !frames.some((f) => f.loading);
  const visitsWithData = loaded ? usable.length : visits.filter((v) => v.visit.exposures.some((e) => !e.excluded)).length;
  const additional = loaded ? usable.length < 2 : p.status === "additional-analysis-needed";

  return (
    <div className="grid gap-2">
      {additional ? (
        <div className="grid gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
          <p className="text-sm font-medium">{t("blink.additionalNeeded")}</p>
          <p>{t("blink.additionalNeededBody")}</p>
          <RecommendedAnalysis />
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{t("blink.comparable")}</Badge>
          <span className="text-xs text-muted-foreground">{t("blink.comparableNote")}</span>
        </div>
      )}
      <p className="font-mono">
        {t(visitsWithData === 1 ? "blink.visitsOne" : "blink.visitsOther", { n: visitsWithData })}
        {loaded &&
          visits.length > visitsWithData &&
          ` ${t("blink.visitsMissing", { missing: visits.length - visitsWithData, total: visits.length, detector: detector ?? "" })}`}
        {mids.length > 0 && ` · ${mjdMonth(mids[0])}${mids.length > 1 ? ` → ${mjdMonth(mids[mids.length - 1])}` : ""}`} · {detector}{" "}
        {p.referenceWavelengthUm != null && `${p.referenceWavelengthUm.toFixed(3)} µm`}
      </p>
      <details className="text-xs">
        <summary className="cursor-pointer select-none">{t("blink.howMatched")}</summary>
        <p className="mt-1 text-muted-foreground">
          {p.toleranceUm != null
            ? t("blink.matchedRule", { tolerance: `±${p.toleranceUm.toFixed(3)} µm`, ref: p.referenceWavelengthUm?.toFixed(3) ?? "", rule: p.toleranceRule })
            : t("blink.matchedRuleNoTolerance", { ref: p.referenceWavelengthUm?.toFixed(3) ?? "", rule: p.toleranceRule })}
        </p>
      </details>
      <details className="text-xs">
        <summary className="cursor-pointer select-none">
          {t("blink.observations", { used: frames.length, skipped: visits.reduce((n, v) => n + v.visit.exposures.filter((e) => e.excluded).length, 0) })}
        </summary>
        <ul className="mt-1 grid gap-1">
          {visits.map((v) => (
            <li key={v.visit.index}>
              <span className="font-medium">{t("blink.visit", { n: v.visit.index })}</span> · {mjdDate(v.visit.start)} → {mjdDate(v.visit.end)}
              {v.frames.length === 0 && <span className="text-muted-foreground"> · {t("blink.noFrameInTolerance", { detector: detector ?? "" })}</span>}
              <ul className="pl-3">
                {v.frames.map((f) => (
                  <li key={f.exposure.key} className="font-mono">
                    {f.exposure.obsId} · {f.wavelengthUm != null ? `${f.wavelengthUm.toFixed(3)} µm` : f.loading ? t("blink.reading") : "—"}
                    {f.flagsAtTarget.length > 0 && ` · ${t("blink.flagsAtPoint", { flags: f.flagsAtTarget.join("+") })}`}
                    {f.dropped && <span className="text-amber-600"> · {t("blink.dropped", { reason: t(f.dropped.key, f.dropped.values) })}</span>}
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
  const t = useT();
  const { jobs, run } = useAnalyses();
  const job = jobs["sky-time-machine"];
  return (
    <Button size="sm" variant="secondary" className="w-fit" disabled={job.status === "running"} onClick={() => run("sky-time-machine")}>
      <PlayIcon />
      {t(job.status === "running" ? "blink.stmDownloading" : "blink.compareEarlier")}
    </Button>
  );
}

/** Shown instead of the panel until every image the blink viewer needs has arrived. */
export function BlinkLoading() {
  const t = useT();
  const { progress } = useBlink();
  const pct = Math.round((progress.done / Math.max(1, progress.total)) * 100);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center" aria-live="polite">
      <Spinner />
      <div className="grid w-full max-w-md gap-2">
        <Progress value={pct} aria-label={t("blink.loadingLabel")} />
        <p className="text-sm">{t(progress.step.key, progress.step.values)}</p>
        <p className="text-xs text-muted-foreground">
          {t("blink.loadingProgress", { done: progress.done, total: progress.total, left: progress.total - progress.done })}
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
