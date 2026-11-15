"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRightIcon, PlayIcon, SquareIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ARCSEC2_TO_SR } from "@/app/_lib/comet/photometry";
import type { NativeFrame } from "@/app/_lib/fpl/checks";
import { decodeBits } from "@/app/_lib/fpl/flags";
import type { FplExposure } from "@/app/_lib/fpl/types";
import { COMPARE, describePair, isDifference, matchSources, pairEvents, pairsForRun, type SourcePair } from "@/app/_lib/sonata/compare";
import { eventFor, frequencyFor, gainFor, panFor, scanEvents, selectSources, type SoundEvent, type SoundSettings } from "@/app/_lib/sonata/mapping";
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
  /** Turns the sound on if it is off (every caller is a click or a key press, which browsers accept). */
  ensureAudio: () => Promise<void>;
  /** A and B see this position at wavelengths further apart than the bandwidth. */
  waveMismatch: boolean;
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
const fmtFlux = (s: SonataSource | null) => (!s ? "not found" : s.quality === "saturated" ? "saturated" : `${s.fluxMjy!.toFixed(2)} mJy`);

/** Pairs played in one comparison run (the audio engine holds 24 notes, two per pair). */
const MAX_RUN_PAIRS = 12;
const PAIR_COLOR: Record<SourcePair["kind"], string> = {
  same: "#facc15",
  saturated: "#f97316",
  "brighter-in-b": "#e879f9",
  "fainter-in-b": "#e879f9",
  "only-a": "#22d3ee",
  "only-b": "#22d3ee",
};

export function ListenPanel(props: Props) {
  const { audio, ensureAudio, grid, frames, sources, settings } = props;
  const hasB = Boolean(frames.B);
  const [cursor, setCursor] = useState({ i: Math.round((grid.n - 1) / 2), r: Math.round((grid.n - 1) / 2) });
  const [announce, setAnnounce] = useState("Press a play button, or click a star in either image.");
  const [playhead, setPlayhead] = useState<{ tag: Tag; at: number } | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  const raf = useRef<number | null>(null);

  const mapA = useIndexMap(frames.A ?? undefined, grid);
  const mapB = useIndexMap(frames.B ?? undefined, grid);
  const skyA = useMemo(() => (frames.A ? skyLevel(frames.A) : null), [frames.A]);
  const skyB = useMemo(() => (frames.B ? skyLevel(frames.B) : null), [frames.B]);
  const range = useMemo(() => sharedDisplayRange([frames.A, frames.B].filter((f): f is NativeFrame => Boolean(f))), [frames.A, frames.B]);
  const pairs = useMemo(() => (hasB ? matchSources(sources.A, sources.B, grid) : []), [hasB, sources.A, sources.B, grid]);
  const differences = pairs.filter(isDifference);
  const count = (kind: SourcePair["kind"]) => pairs.filter((p) => p.kind === kind).length;
  // With one exposure there is nothing to pair: its own sources are listed and played instead.
  const single = useMemo(() => [...selectSources(sources.A, grid, settings).played].sort((p, q) => p.g!.i - q.g!.i), [sources.A, grid, settings]);

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
  // "Stop all sound", or leaving the tab, also cancels a run that is still scheduled.
  useEffect(() => audio().onStop(clearSchedules), [audio, clearSchedules]);

  /** Brightness at a grid cell of one exposure: 3×3 native-pixel sum above the sky, mJy (same definition as sources). */
  const probe = (tag: Tag, i: number, r: number) => {
    const frame = frames[tag];
    const map = tag === "A" ? mapA : mapB;
    const sky = tag === "A" ? skyA : skyB;
    if (!frame || !map || !sky) return null;
    const src = map[Math.round(r) * grid.n + Math.round(i)];
    if (src == null || src < 0) return { flux: null as number | null, reason: "outside this exposure" };
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
    if (n < 5) return { flux: null, reason: "unusable pixels (flagged or saturated)" };
    const omega = (p.header.omegaMedianArcsec2 ?? 37.8) * ARCSEC2_TO_SR;
    return { flux: sum * (9 / n) * 1e9 * omega, reason: null as string | null };
  };

  /** Plays the sky under a point: A, then B at the same pitch and side, so only the loudness can differ. */
  const playPoint = async (i: number, r: number) => {
    await ensureAudio();
    const x = i / (grid.n - 1);
    const y = r / (grid.n - 1);
    const { ra, dec } = gridToSky(grid, i, r);
    const tags: Tag[] = hasB ? ["A", "B"] : ["A"];
    const parts: string[] = [];
    const events: SoundEvent[] = [];
    for (const [k, tag] of tags.entries()) {
      const pr = probe(tag, i, r);
      if (!pr) continue;
      const start = k * COMPARE.gapSeconds;
      if (pr.flux == null) {
        events.push({ sourceId: null, x, y: 1, start, duration: 0.07, frequency: 110, pan: 0, gain: 0.2, wave: "square" });
        parts.push(`${tag}: no usable data (${pr.reason})`);
      } else {
        events.push(eventFor(null, x, y, pr.flux, settings, start));
        parts.push(`${tag}: ${pr.flux.toFixed(2)} mJy, loudness ${Math.round(gainFor(pr.flux, settings) * 100)}%`);
      }
    }
    stop();
    audio().play(events);
    setAnnounce(`RA ${ra.toFixed(4)}, Dec ${dec.toFixed(4)} · ${Math.round(frequencyFor(y, settings))} Hz, ${fmtPan(panFor(x, settings))}. ${parts.join(" · ")}.`);
  };

  const pairSentence = (p: SourcePair, k: number, n: number) =>
    `Source ${k + 1} of ${n}: ${describePair(p)}. A: ${fmtFlux(p.a)} · B: ${fmtFlux(p.b)}. ${Math.round(frequencyFor(p.y, settings))} Hz, ${fmtPan(panFor(p.x, settings))}.`;

  const playPair = async (p: SourcePair) => {
    await ensureAudio();
    stop();
    setCurrent(p.id);
    setCursor({ i: Math.round(p.x * (grid.n - 1)), r: Math.round(p.y * (grid.n - 1)) });
    audio().play(pairEvents(p, settings));
    setAnnounce(pairSentence(p, pairs.indexOf(p), pairs.length));
  };

  /** Source by source: the A note, then the B note, then the next source. */
  const comparePairs = async (differencesOnly: boolean) => {
    await ensureAudio();
    stop();
    const run = pairsForRun(pairs, MAX_RUN_PAIRS, differencesOnly);
    if (!run.length) return;
    audio().play(run.flatMap((p, k) => pairEvents(p, settings, k * COMPARE.stepSeconds)));
    for (const [k, p] of run.entries()) {
      timers.current.push(
        window.setTimeout(() => {
          setCurrent(p.id);
          setCursor({ i: Math.round(p.x * (grid.n - 1)), r: Math.round(p.y * (grid.n - 1)) });
          setAnnounce(pairSentence(p, k, run.length));
        }, k * COMPARE.stepSeconds * 1000),
      );
    }
    setAnnounce(`Comparing ${run.length} source(s), left to right. Each one plays twice: first as in A, then as in B. A low tick means it was not found.`);
  };

  const scan = async (which: Tag) => {
    await ensureAudio();
    stop();
    audio().play(scanEvents(sources[which], grid, settings));
    const tick = () => {
      const el = audio().elapsed();
      if (el > settings.scanSeconds + settings.noteSeconds) {
        setPlayhead(null);
        raf.current = null;
        return;
      }
      setPlayhead({ tag: which, at: Math.max(0, el / settings.scanSeconds) });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    const sel = selectSources(sources[which], grid, settings);
    setAnnounce(`Playing all of ${which}, left to right over ${settings.scanSeconds} seconds: the ${sel.played.length} brightest of ${sel.total} detected sources.`);
  };

  const playSingle = async (k: number) => {
    const e = single[k];
    if (!e) return;
    await ensureAudio();
    const x = e.g!.i / (grid.n - 1);
    const y = e.g!.r / (grid.n - 1);
    setCurrent(e.src.id);
    setCursor({ i: Math.round(e.g!.i), r: Math.round(e.g!.r) });
    audio().play([eventFor(e.src, x, y, e.src.fluxMjy, settings)]);
    setAnnounce(`Source ${k + 1} of ${single.length}: ${fmtFlux(e.src)}. ${Math.round(frequencyFor(y, settings))} Hz, ${fmtPan(panFor(x, settings))}.`);
  };

  const step = (by: number) => {
    if (hasB) {
      if (!pairs.length) return;
      const k = pairs.findIndex((p) => p.id === current);
      void playPair(pairs[Math.min(pairs.length - 1, Math.max(0, k + by))]);
    } else {
      const k = single.findIndex((e) => e.src.id === current);
      void playSingle(Math.min(single.length - 1, Math.max(0, k + by)));
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    const size = e.shiftKey ? 1 : 4;
    const move = (di: number, dr: number) => {
      e.preventDefault();
      const next = { i: Math.min(grid.n - 1, Math.max(0, cursor.i + di)), r: Math.min(grid.n - 1, Math.max(0, cursor.r + dr)) };
      setCursor(next);
      void playPoint(next.i, next.r);
    };
    switch (e.key) {
      case "ArrowLeft": return move(-size, 0);
      case "ArrowRight": return move(size, 0);
      case "ArrowUp": return move(0, -size);
      case "ArrowDown": return move(0, size);
      case "Enter":
      case " ":
        e.preventDefault();
        return void playPoint(cursor.i, cursor.r);
      case "n":
      case "N":
        e.preventDefault();
        return step(1);
      case "p":
      case "P":
        e.preventDefault();
        return step(-1);
    }
  };

  const cursorSky = gridToSky(grid, cursor.i, cursor.r);
  const markersFor = (tag: Tag) =>
    hasB
      ? pairs
          .filter((p) => (tag === "A" ? p.a : p.b))
          .map((p) => {
            const s = (tag === "A" ? p.a : p.b)!;
            return { ra: s.ra, dec: s.dec, color: PAIR_COLOR[p.kind], shape: "x" as const };
          })
      : single.map((e) => ({ ra: e.src.ra, dec: e.src.dec, color: e.src.quality === "saturated" ? "#f97316" : "#facc15", shape: "x" as const }));

  const image = (tag: Tag) => {
    const frame = frames[tag];
    const exp = props.exposures[tag];
    return (
      <div key={tag} className="grid content-start gap-1">
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="font-medium">Observation {tag}</span>
          <span className="text-muted-foreground">{exp ? mjdIso(exp.tStart).slice(0, 10) : ""}</span>
        </div>
        {props.loading[tag] ? (
          <div className="flex aspect-square items-center justify-center gap-2 rounded-md border border-dashed text-xs text-muted-foreground"><Spinner /> Reading the exposure…</div>
        ) : frame ? (
          <div
            tabIndex={0}
            role="application"
            aria-roledescription="sky sound explorer"
            aria-label={`Observation ${tag}. Arrow keys move the cursor and play the sky under it${hasB ? ", first in A and then in B" : ""} (Shift for small steps). Enter plays it again. N and P go to the next or previous source.`}
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
              markers={markersFor(tag)}
              onPick={({ ra, dec }) => {
                const c = gridIndex(grid, ra, dec);
                if (!c) return;
                setCursor(c);
                void playPoint(c.i, c.r);
              }}
            />
            {playhead?.tag === tag && (
              <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-sky-400/80" style={{ left: `${playhead.at * 100}%` }} aria-hidden />
            )}
          </div>
        ) : (
          <div className="flex aspect-square items-center justify-center rounded-md border border-dashed p-3 text-center text-xs text-destructive">{props.errors[tag] ?? "Choose an observation."}</div>
        )}
      </div>
    );
  };

  return (
    <div className="grid gap-4 pt-2 text-sm">
      <section className="grid gap-2 rounded-lg border p-3">
        <h3 className="text-sm font-medium">{hasB ? "Hear what differs between A and B" : "Listen to this observation"}</h3>
        {hasB ? (
          <>
            <p className="text-xs text-muted-foreground">
              Each source plays twice in a row: first as it is in A, then as it is in B, at the same pitch and on the same side. If the second note is
              louder, it is brighter in B. A low tick means it was not found.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => comparePairs(false)} disabled={!pairs.length}>
                <ArrowLeftRightIcon /> Compare source by source
              </Button>
              <Button size="sm" variant="secondary" onClick={() => comparePairs(true)} disabled={!differences.length}>
                <PlayIcon /> Only the differences ({differences.length})
              </Button>
              <Button size="sm" variant="outline" onClick={stop}><SquareIcon /> Stop</Button>
            </div>
            <p className="text-xs">
              {pairs.length === 0
                ? "No source is clear enough in either exposure to compare (S/N 10 or more is needed)."
                : `${count("same")} about the same · ${count("brighter-in-b")} brighter in B · ${count("fainter-in-b")} fainter in B · ${count("only-a")} only in A · ${count("only-b")} only in B${count("saturated") ? ` · ${count("saturated")} saturated` : ""}.`}
            </p>
            {props.waveMismatch && differences.length > 0 && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                A and B see this field at different wavelengths, so these differences can come from the colour of the sources, not from a change in the sky.
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Additional analysis needed: there is no second observation to compare with here. Higher in the image is a higher note, brighter is louder, left and right follow the image.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => scan("A")} disabled={!frames.A}><PlayIcon /> Play left to right</Button>
              <Button size="sm" variant="outline" onClick={stop}><SquareIcon /> Stop</Button>
            </div>
          </>
        )}
        <p aria-live="polite" className="min-h-9 rounded-md border bg-muted/40 p-2 text-xs">{announce}</p>
      </section>

      <div className={hasB ? "grid gap-3 sm:grid-cols-2" : "grid max-w-md gap-3"}>
        {image("A")}
        {hasB && image("B")}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Click anywhere in an image to hear that spot{hasB ? " in A and then in B" : ""}. × marks:{" "}
        <span style={{ color: PAIR_COLOR.same }}>yellow</span> about the same,{" "}
        {hasB && (
          <>
            <span style={{ color: PAIR_COLOR["brighter-in-b"] }}>pink</span> brighter or fainter, <span style={{ color: PAIR_COLOR["only-a"] }}>cyan</span> found in one only,{" "}
          </>
        )}
        <span style={{ color: PAIR_COLOR.saturated }}>orange</span> saturated (buzzy tone, brightness unreliable). Red tint: unusable pixels.
      </p>

      {hasB && pairs.length > 0 && (
        <section className="grid gap-2 rounded-lg border p-3 text-xs">
          <h3 className="text-sm font-medium">Sources, A against B</h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead className="text-right">A</TableHead>
                  <TableHead className="text-right">B</TableHead>
                  <TableHead>Where</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...pairs].sort((p, q) => Number(isDifference(q)) - Number(isDifference(p))).map((p) => (
                  <TableRow key={p.id} className={p.id === current ? "bg-muted" : undefined}>
                    <TableCell>{pairs.indexOf(p) + 1}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2 rounded-full" style={{ background: PAIR_COLOR[p.kind] }} />
                        <span className={isDifference(p) ? "font-medium" : undefined}>{describePair(p)}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">{fmtFlux(p.a)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtFlux(p.b)}</TableCell>
                    <TableCell className="font-mono">{Math.round(frequencyFor(p.y, settings))} Hz · {fmtPan(panFor(p.x, settings))}</TableCell>
                    <TableCell><Button size="xs" variant="outline" onClick={() => playPair(p)} aria-label={`Play source ${pairs.indexOf(p) + 1} in A, then in B`}><PlayIcon /> A → B</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-muted-foreground">
            A source is listed when it reaches S/N {COMPARE.minSnr} in A or B. &quot;Brighter&quot; or &quot;fainter&quot; needs a factor of {COMPARE.minRatio} and {COMPARE.sigma}σ.
            &quot;Only found&quot; means nothing above 5σ within {COMPARE.matchRadiusArcsec}″ in the other exposure. This is a list of differences to look at, not a detection
            (rules {COMPARE.version}).
          </p>
        </section>
      )}

      <details className="rounded-lg border p-3 text-xs">
        <summary className="cursor-pointer text-sm font-medium select-none">Play a whole image, and sound settings</summary>
        <div className="mt-3 grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => scan("A")} disabled={!frames.A}><PlayIcon /> Play all of A</Button>
            {hasB && <Button size="sm" variant="outline" onClick={() => scan("B")}><PlayIcon /> Play all of B</Button>}
            <span className="text-muted-foreground">
              Plays the {settings.maxSources} brightest sources from left to right. The blue line is the scan position: scan time, not observing time. Silence does not mean empty sky.
            </span>
          </div>
          <SettingsForm {...props} />
        </div>
      </details>

      {!hasB && (
        <details className="rounded-lg border p-3 text-xs">
          <summary className="cursor-pointer text-sm font-medium select-none">Sources as text ({single.length})</summary>
          <div className="mt-2 overflow-x-auto">
            <Table>
              <TableBody>
                {single.map((e, k) => (
                  <TableRow key={e.src.id} className={e.src.id === current ? "bg-muted" : undefined}>
                    <TableCell>{k + 1}</TableCell>
                    <TableCell className="font-mono">{e.src.ra.toFixed(5)}, {e.src.dec.toFixed(5)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtFlux(e.src)}{e.src.snr ? ` (S/N ${e.src.snr.toFixed(0)})` : ""}</TableCell>
                    <TableCell><Button size="xs" variant="outline" onClick={() => playSingle(k)} aria-label={`Play source ${k + 1}`}><PlayIcon /> Play</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </details>
      )}
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
