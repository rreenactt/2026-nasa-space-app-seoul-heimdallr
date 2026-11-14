import type { SkyGrid } from "@/app/_lib/sky/types";
import { skyToGrid } from "@/app/_lib/sky/wcs";
import type { SonataSource } from "./sources";

/**
 * The fixed sound rules. Measured values never change when these settings change.
 *   pan  = 2x − 1                       (left … right)
 *   f(y) = fMin · (fMax / fMin)^(1 − y) (top = high, y = 0 at the top)
 *   t    = x · scanSeconds              (scan from left to right)
 *   gain = gMin + (gMax − gMin) · clamp(log(F / Flo) / log(Fhi / Flo))  (brighter = louder, log-compressed)
 */
export interface SoundSettings {
  fMin: number;
  fMax: number;
  scanSeconds: number;
  noteSeconds: number;
  mono: boolean;
  /** Shared brightness range (mJy) — the same for A and B, never normalised per image. */
  fluxLo: number;
  fluxHi: number;
  maxSources: number;
}

export const DEFAULT_SETTINGS: SoundSettings = {
  fMin: 220,
  fMax: 1760,
  scanSeconds: 6,
  noteSeconds: 0.35,
  mono: false,
  fluxLo: 0.5,
  fluxHi: 200,
  maxSources: 15,
};

export const RULES_VERSION = "sonata-rules-1";
const G_MIN = 0.04;
const G_MAX = 0.3;

export interface SoundEvent {
  sourceId: string | null;
  /** Position in the shared grid, 0..1 (y = 0 at the top). */
  x: number;
  y: number;
  start: number; // s from scan start
  duration: number;
  frequency: number;
  pan: number;
  gain: number;
  /** "square" marks brightness that cannot be trusted (saturated); "sine" otherwise. */
  wave: "sine" | "square";
}

export const panFor = (x: number, s: SoundSettings) => (s.mono ? 0 : Math.max(-1, Math.min(1, 2 * x - 1)));
export const frequencyFor = (y: number, s: SoundSettings) => s.fMin * (s.fMax / s.fMin) ** (1 - Math.max(0, Math.min(1, y)));

export function gainFor(fluxMjy: number | null, s: SoundSettings) {
  if (fluxMjy == null) return G_MAX; // saturated: brighter than the range, played at the cap
  if (!(fluxMjy > 0)) return G_MIN;
  const t = Math.log(fluxMjy / s.fluxLo) / Math.log(s.fluxHi / s.fluxLo);
  return G_MIN + (G_MAX - G_MIN) * Math.max(0, Math.min(1, t));
}

/** Sources inside the grid, brightest first (saturated count as brightest), capped at maxSources. */
export function selectSources(sources: SonataSource[], grid: SkyGrid, s: SoundSettings) {
  const inside = sources
    .map((src) => ({ src, g: skyToGrid(grid, src.ra, src.dec) }))
    .filter((e) => e.g && e.g.i >= 0 && e.g.r >= 0 && e.g.i <= grid.n - 1 && e.g.r <= grid.n - 1);
  inside.sort((a, b) => (b.src.fluxMjy ?? Infinity) - (a.src.fluxMjy ?? Infinity));
  return { played: inside.slice(0, s.maxSources), total: inside.length };
}

export function eventFor(src: SonataSource | null, x: number, y: number, fluxMjy: number | null, s: SoundSettings, start = 0): SoundEvent {
  return {
    sourceId: src?.id ?? null,
    x,
    y,
    start,
    duration: s.noteSeconds,
    frequency: frequencyFor(y, s),
    pan: panFor(x, s),
    gain: gainFor(fluxMjy, s),
    wave: src?.quality === "saturated" ? "square" : "sine",
  };
}

export function scanEvents(sources: SonataSource[], grid: SkyGrid, s: SoundSettings): SoundEvent[] {
  const { played } = selectSources(sources, grid, s);
  return played
    .map(({ src, g }) => {
      const x = g!.i / (grid.n - 1);
      const y = g!.r / (grid.n - 1);
      return eventFor(src, x, y, src.fluxMjy, s, x * s.scanSeconds);
    })
    .sort((a, b) => a.start - b.start);
}

/** Shared brightness range for A and B: from the faintest to the brightest measured source of both. */
export function sharedFluxRange(lists: SonataSource[][]): { lo: number; hi: number } | null {
  const f = lists.flat().map((s) => s.fluxMjy).filter((v): v is number => v != null && v > 0);
  if (f.length < 2) return null;
  f.sort((a, b) => a - b);
  return { lo: f[0], hi: f[f.length - 1] };
}
