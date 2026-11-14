"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PlayIcon, SquareIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ARCSEC2_TO_SR } from "@/app/_lib/comet/photometry";
import type { NativeFrame } from "@/app/_lib/fpl/checks";
import { decodeBits } from "@/app/_lib/fpl/flags";
import type { FplExposure } from "@/app/_lib/fpl/types";
import { eventFor, frequencyFor, gainFor, panFor, scanEvents, selectSources, type SoundSettings } from "@/app/_lib/sonata/mapping";
import { skyLevel, type SonataSource } from "@/app/_lib/sonata/sources";
import type { SkyGrid } from "@/app/_lib/sky/types";
import { gridToSky } from "@/app/_lib/sky/wcs";
import { mjdIso } from "../fake-planet-lab/fpl-state";
import { LayeredCanvas, useIndexMap } from "../fake-planet-lab/layered-canvas";
import { sharedDisplayRange } from "../fake-planet-lab/use-fpl-data";
import type { SonataAudio } from "./audio";

type Tag = "A" | "B";
type ByTag<T> = Record<Tag, T>;

const UNUSABLE = ["NONFUNC", "MISSING_DATA", "HOT", "COLD", "SUR_ERROR"];

interface Props {
  audio: () => SonataAudio;
  audioOn: boolean;
  grid: SkyGrid;
  frames: ByTag<NativeFrame | null>;
  loading: ByTag<boolean>;
  errors: ByTag<string | null>;
  exposures: ByTag<FplExposure | undefined>;
  sources: ByTag<SonataSource[]>;
  settings: SoundSettings;
  onSettings: (p: Partial<SoundSettings>) => void;
  rangeAuto: boolean;
  changedAt: string | null;
}

const fmtPan = (p: number) => (Math.abs(p) < 0.1 ? "centre" : p < 0 ? `${Math.round(-p * 100)}% left` : `${Math.round(p * 100)}% right`);

export function ListenPanel(props: Props) {
  const { audio, audioOn, grid, frames, sources, settings } = props;
  const [view, setView] = useState<Tag>("A");
  const frame = frames[view] ?? frames.A;
  const tag: Tag = frames[view] ? view : "A";
  const [cursor, setCursor] = useState({ i: Math.round((grid.n - 1) / 2), r: Math.round((grid.n - 1) / 2) });
  const [announce, setAnnounce] = useState("Press Start sound, then focus the image and use the arrow keys.");
  const [playhead, setPlayhead] = useState<number | null>(null);
  const [srcIdx, setSrcIdx] = useState(-1);
  const timers = useRef<number[]>([]);
  const raf = useRef<number | null>(null);

  const map = useIndexMap(frame ?? undefined, grid);
  const sky = useMemo(() => (frame ? skyLevel(frame) : null), [frame]);
  const range = useMemo(() => sharedDisplayRange([frames.A, frames.B].filter((f): f is NativeFrame => Boolean(f))), [frames.A, frames.B]);
  const played = useMemo(() => selectSources(sources[tag], grid, settings), [sources, tag, grid, settings]);
  const ordered = useMemo(() => [...played.played].sort((a, b) => a.g!.i - b.g!.i), [played]);

  const clearSchedules = useCallback(() => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    setPlayhead(null);
  }, []);
  const stop = useCallback(() => {
    clearSchedules();
    audio().stop();
  }, [audio, clearSchedules]);
  useEffect(() => () => clearSchedules(), [clearSchedules]);

  const needAudio = () => {
    if (!audioOn) {
      setAnnounce("Sound is off. Press Start sound first.");
      return true;
    }
    return false;
  };

  /** Brightness at the cursor: 3×3 native-pixel sum above the sky, mJy (same definition as sources). */
  const probe = (i: number, r: number) => {
    if (!frame || !map || !sky) return null;
    const src = map[Math.round(r) * grid.n + Math.round(i)];
    const { ra, dec } = gridToSky(grid, i, r);
    if (src == null || src < 0) return { ra, dec, flux: null as number | null, reason: "outside this exposure" };
    const p = frame.payload;
    const W = p.width;
    const x = src % W;
    const y = Math.floor(src / W);
    const bits = decodeBits(p.flagBits);
    const bad = bits.filter((b) => UNUSABLE.includes(b.name)).reduce((m, b) => m | b.mask, 0) >>> 0;
    let sum = 0;
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= p.height) continue;
      const k = yy * W + xx;
      if ((frame.flags[k] >>> 0) & bad || !Number.isFinite(frame.image[k])) continue;
      sum += frame.image[k] - frame.zodi[k] - sky.median;
      n++;
    }
    if (n < 5) return { ra, dec, flux: null, reason: "unusable pixels (flagged or saturated)" };
    const omega = (p.header.omegaMedianArcsec2 ?? 37.8) * ARCSEC2_TO_SR;
    return { ra, dec, flux: sum * (9 / n) * 1e9 * omega, reason: null as string | null };
  };

  const playPoint = (i: number, r: number) => {
    if (needAudio()) return;
    const pr = probe(i, r);
    if (!pr) return;
    const x = i / (grid.n - 1);
    const y = r / (grid.n - 1);
    if (pr.flux == null) {
      audio().noDataCue();
      setAnnounce(`No usable data here: ${pr.reason}. RA ${pr.ra.toFixed(4)}, Dec ${pr.dec.toFixed(4)}.`);
      return;
    }
    audio().play([eventFor(null, x, y, pr.flux, settings)]);
    setAnnounce(
      `Observation ${tag}. RA ${pr.ra.toFixed(4)}, Dec ${pr.dec.toFixed(4)}. ${pr.flux.toFixed(2)} mJy above the sky. ${Math.round(frequencyFor(y, settings))} Hz, ${fmtPan(panFor(x, settings))}, loudness ${Math.round(gainFor(pr.flux, settings) * 100)}%.`,
    );
  };

  const playSource = (k: number) => {
    const e = ordered[k];
    if (!e || needAudio()) return;
    setSrcIdx(k);
    setCursor({ i: Math.round(e.g!.i), r: Math.round(e.g!.r) });
    const x = e.g!.i / (grid.n - 1);
    const y = e.g!.r / (grid.n - 1);
    audio().play([eventFor(e.src, x, y, e.src.fluxMjy, settings)]);
    setAnnounce(
      `Source ${k + 1} of ${ordered.length}. ${e.src.quality === "saturated" ? "Saturated, brightness unreliable (buzzy tone)" : `${e.src.fluxMjy!.toFixed(2)} mJy, S/N ${e.src.snr!.toFixed(0)}`}. ${fmtPan(panFor(x, settings))}, ${Math.round(frequencyFor(y, settings))} Hz.`,
    );
  };

  const runPlayhead = () => {
    const tick = () => {
      const el = audio().elapsed();
      if (el > settings.scanSeconds + settings.noteSeconds) {
        setPlayhead(null);
        raf.current = null;
        return;
      }
      setPlayhead(Math.max(0, el / settings.scanSeconds));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  const scan = (which: Tag) => {
    if (needAudio()) return;
    stop();
    setView(which);
    const ev = scanEvents(sources[which], grid, settings);
    audio().play(ev);
    runPlayhead();
    const sel = selectSources(sources[which], grid, settings);
    setAnnounce(`Scanning observation ${which}, left to right over ${settings.scanSeconds} seconds: ${sel.played.length} of ${sel.total} detected sources (brightest first).`);
  };

  const scanAB = () => {
    if (needAudio() || !frames.B) return;
    scan("A");
    timers.current.push(window.setTimeout(() => scan("B"), (settings.scanSeconds + 1.2) * 1000));
  };

  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 1 : 4;
    const move = (di: number, dr: number) => {
      e.preventDefault();
      const next = { i: Math.min(grid.n - 1, Math.max(0, cursor.i + di)), r: Math.min(grid.n - 1, Math.max(0, cursor.r + dr)) };
      setCursor(next);
      playPoint(next.i, next.r);
    };
    switch (e.key) {
      case "ArrowLeft": return move(-step, 0);
      case "ArrowRight": return move(step, 0);
      case "ArrowUp": return move(0, -step);
      case "ArrowDown": return move(0, step);
      case "Enter":
      case " ":
        e.preventDefault();
        return playPoint(cursor.i, cursor.r);
      case "n":
      case "N":
        e.preventDefault();
        return playSource(Math.min(ordered.length - 1, srcIdx + 1));
      case "p":
      case "P":
        e.preventDefault();
        return playSource(Math.max(0, srcIdx - 1));
    }
  };

  const cursorSky = gridToSky(grid, cursor.i, cursor.r);
  const exp = props.exposures[tag];

  return (
    <div className="grid gap-3 pt-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => scan("A")} disabled={!frames.A}><PlayIcon /> Scan A</Button>
        <Button size="sm" onClick={() => scan("B")} disabled={!frames.B}><PlayIcon /> Scan B</Button>
        <Button size="sm" variant="secondary" onClick={scanAB} disabled={!frames.B}><PlayIcon /> A then B</Button>
        <Button size="sm" variant="outline" onClick={stop}><SquareIcon /> Stop</Button>
        <Button size="sm" variant="outline" onClick={() => playSource(Math.max(0, srcIdx - 1))} disabled={!ordered.length}>Previous source</Button>
        <Button size="sm" variant="outline" onClick={() => playSource(Math.min(ordered.length - 1, srcIdx + 1))} disabled={!ordered.length}>Next source</Button>
        <span className="text-xs text-muted-foreground">Showing {tag}{exp ? ` · ${mjdIso(exp.tStart)}` : ""}</span>
        <Button size="xs" variant="ghost" onClick={() => setView(view === "A" ? "B" : "A")} disabled={!frames.B}>Show {view === "A" ? "B" : "A"}</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,26rem)_1fr]">
        <div className="grid gap-1">
          {props.loading[tag] ? (
            <div className="flex aspect-square items-center justify-center gap-2 rounded-md border border-dashed text-xs text-muted-foreground"><Spinner /> Reading the exposure…</div>
          ) : frame ? (
            <div
              tabIndex={0}
              role="application"
              aria-roledescription="sky sound explorer"
              aria-label="Sky explorer. Arrow keys move the cursor and play the sky under it (Shift for small steps). Enter plays the cursor again. N and P go to the next or previous source."
              onKeyDown={onKey}
              className="relative rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring"
            >
              <LayeredCanvas
                frame={frame}
                grid={grid}
                layers={{ unusable: true }}
                opacity={0.45}
                candidate={cursorSky}
                apertureArcsec={9}
                range={range}
                label={`${tag} · ${exp?.detector ?? ""}`}
                markers={played.played.map((e) => ({ ra: e.src.ra, dec: e.src.dec, color: e.src.quality === "saturated" ? "#f97316" : "#facc15", shape: "x" as const }))}
                onPick={({ ra, dec }) => {
                  const c = gridIndex(grid, ra, dec);
                  if (!c) return;
                  setCursor(c);
                  playPoint(c.i, c.r);
                }}
              />
              {playhead != null && (
                <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-sky-400/80" style={{ left: `${playhead * 100}%` }} aria-hidden />
              )}
            </div>
          ) : (
            <div className="flex aspect-square items-center justify-center rounded-md border border-dashed p-3 text-center text-xs text-destructive">{props.errors[tag] ?? "Choose an observation."}</div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Yellow ×: sources that are played. Orange ×: saturated (buzzy tone, brightness unreliable). Red tint: unusable pixels. The blue line is the scan position — scan time, not observing time.
          </p>
        </div>

        <div className="grid content-start gap-3">
          <p aria-live="polite" className="min-h-10 rounded-md border bg-muted/40 p-2 text-xs">{announce}</p>
          <p className="text-xs text-muted-foreground">
            Only the {played.played.length} brightest of {played.total} detected sources (≥ 5σ) in the {grid.fovArcmin}′ field are played. Silence does not mean empty sky — fainter objects are not in the scan. Use the arrow keys to listen to any point.
          </p>
          <SettingsForm {...props} />
        </div>
      </div>

      <details className="rounded-md border p-2 text-xs" open>
        <summary className="cursor-pointer select-none font-medium">Sources in {tag} as text ({ordered.length})</summary>
        <div className="mt-2 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>RA, Dec</TableHead>
                <TableHead className="text-right">Brightness</TableHead>
                <TableHead>Sound</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordered.map((e, k) => {
                const x = e.g!.i / (grid.n - 1);
                const y = e.g!.r / (grid.n - 1);
                return (
                  <TableRow key={e.src.id} className={k === srcIdx ? "bg-muted" : undefined}>
                    <TableCell>{k + 1}</TableCell>
                    <TableCell className="font-mono">{e.src.ra.toFixed(5)}, {e.src.dec.toFixed(5)}</TableCell>
                    <TableCell className="text-right font-mono">{e.src.quality === "saturated" ? "saturated" : `${e.src.fluxMjy!.toFixed(2)} mJy (S/N ${e.src.snr!.toFixed(0)})`}</TableCell>
                    <TableCell className="font-mono">{Math.round(frequencyFor(y, settings))} Hz · {fmtPan(panFor(x, settings))} · at {(x * settings.scanSeconds).toFixed(1)} s</TableCell>
                    <TableCell><Button size="xs" variant="outline" onClick={() => playSource(k)} aria-label={`Play source ${k + 1}`}>Play</Button></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </details>
    </div>
  );
}

function gridIndex(grid: SkyGrid, ra: number, dec: number) {
  // Inverse of gridToSky for the click handler.
  const D2R = Math.PI / 180;
  const a0 = grid.ra * D2R, d0 = grid.dec * D2R, a = ra * D2R, d = dec * D2R;
  const cosc = Math.sin(d0) * Math.sin(d) + Math.cos(d0) * Math.cos(d) * Math.cos(a - a0);
  if (cosc <= 0) return null;
  const xi = (Math.cos(d) * Math.sin(a - a0)) / cosc;
  const eta = (Math.cos(d0) * Math.sin(d) - Math.sin(d0) * Math.cos(d) * Math.cos(a - a0)) / cosc;
  const s = (grid.fovArcmin / 60 / grid.n) * D2R;
  const c = (grid.n - 1) / 2;
  return { i: Math.round(Math.min(grid.n - 1, Math.max(0, c - xi / s))), r: Math.round(Math.min(grid.n - 1, Math.max(0, c - eta / s))) };
}

function RangeInput({ id, label, min, max, step, value, text, onChange }: { id: string; label: string; min: number; max: number; step: number; value: number; text: string; onChange: (v: number) => void }) {
  return (
    <label htmlFor={id} className="grid gap-1 text-xs">
      <span>{label}: <span className="font-mono">{text}</span></span>
      <input id={id} type="range" min={min} max={max} step={step} value={value} aria-valuetext={text} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function SettingsForm({ settings, onSettings, rangeAuto, changedAt }: Props) {
  return (
    <fieldset className="grid gap-2 rounded-md border p-3 text-xs">
      <legend className="px-1 font-medium">Sound rules (same for A and B)</legend>
      <RangeInput id="ss-scan" label="Scan length" min={3} max={15} step={1} value={settings.scanSeconds} text={`${settings.scanSeconds} seconds`} onChange={(v) => onSettings({ scanSeconds: v })} />
      <RangeInput id="ss-fmin" label="Lowest pitch (bottom edge)" min={110} max={440} step={10} value={settings.fMin} text={`${settings.fMin} Hz`} onChange={(v) => onSettings({ fMin: v })} />
      <RangeInput id="ss-fmax" label="Highest pitch (top edge)" min={880} max={2640} step={20} value={settings.fMax} text={`${settings.fMax} Hz`} onChange={(v) => onSettings({ fMax: v })} />
      <RangeInput id="ss-max" label="Sources per scan" min={5} max={40} step={1} value={settings.maxSources} text={`${settings.maxSources} brightest`} onChange={(v) => onSettings({ maxSources: v })} />
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={settings.mono} onChange={(e) => onSettings({ mono: e.target.checked })} />
        Mono (no left/right; use the scan timing and the text instead)
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <span>Brightness range</span>
        <input aria-label="Faintest brightness, mJy (quietest)" type="number" step="any" className="h-7 w-20 rounded border bg-transparent px-1 font-mono" value={Number(settings.fluxLo.toPrecision(3))} onChange={(e) => Number(e.target.value) > 0 && onSettings({ fluxLo: Number(e.target.value) })} />
        <span>–</span>
        <input aria-label="Brightest brightness, mJy (loudest)" type="number" step="any" className="h-7 w-20 rounded border bg-transparent px-1 font-mono" value={Number(settings.fluxHi.toPrecision(3))} onChange={(e) => Number(e.target.value) > 0 && onSettings({ fluxHi: Number(e.target.value) })} />
        <span>mJy</span>
      </div>
      <p className="text-muted-foreground">
        {rangeAuto ? "Set automatically from the faintest and brightest sources of A and B together — never per image." : "Set by you; A and B still share it."} Loudness is log-compressed for listening; twice the brightness does not sound twice as loud. Exact values are in the text list.
      </p>
      {changedAt && <p className="text-amber-700 dark:text-amber-400">Rules changed at {changedAt}. Replay both A and B before comparing them.</p>}
    </fieldset>
  );
}
