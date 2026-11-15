import type { SkyGrid } from "@/app/_lib/sky/types";
import { skyToGrid } from "@/app/_lib/sky/wcs";
import { eventFor, type SoundEvent, type SoundSettings } from "./mapping";
import type { SonataSource } from "./sources";

/**
 * Pairs the sources of two exposures by sky position, so the same source can be heard in A and then in B.
 * It reports what differs between the two source lists. It does not say why: a different wavelength, a
 * detector effect or a real change all look the same here.
 */
export const COMPARE = {
  /** Sources closer than this on the sky are the same source (1.5 SPHEREx pixels). */
  matchRadiusArcsec: 9.3,
  /** A saturated region is wide and its centre is poorly defined, so it is matched within 3 pixels. */
  saturatedRadiusArcsec: 18.5,
  /** A source must be this clear in one exposure before "missing in the other" is reported. */
  minSnr: 10,
  /** Brightness must differ by this factor, and by `sigma` combined errors, to be listed as different. */
  minRatio: 1.5,
  sigma: 5,
  /** Seconds between the A note and the B note of one source, and between sources. */
  gapSeconds: 0.45,
  stepSeconds: 1.15,
  version: "sonata-compare-1",
} as const;

export type PairKind = "same" | "brighter-in-b" | "fainter-in-b" | "only-a" | "only-b" | "saturated";

export interface SourcePair {
  id: string;
  a: SonataSource | null;
  b: SonataSource | null;
  kind: PairKind;
  /** B ÷ A, when both are measured. */
  ratio: number | null;
  /** Position in the shared grid, 0..1 (y = 0 at the top). */
  x: number;
  y: number;
  ra: number;
  dec: number;
}

const separationArcsec = (p: SonataSource, q: SonataSource) =>
  Math.hypot((p.ra - q.ra) * Math.cos((p.dec * Math.PI) / 180), p.dec - q.dec) * 3600;
const strong = (s: SonataSource) => s.quality === "saturated" || (s.snr ?? 0) >= COMPARE.minSnr;

/**
 * A saturated source with no partner is not reported as missing: whether a saturated region is picked up as a
 * source depends on how many of its pixels are flagged in that exposure, not on the sky.
 */
const unpaired = (s: SonataSource, kind: "only-a" | "only-b"): PairKind => (s.quality === "saturated" ? "saturated" : kind);

function classify(a: SonataSource, b: SonataSource): { kind: PairKind; ratio: number | null } {
  if (a.fluxMjy == null || b.fluxMjy == null || !a.snr || !b.snr) return { kind: "saturated", ratio: null };
  const ratio = b.fluxMjy / a.fluxMjy;
  const error = Math.hypot(a.fluxMjy / a.snr, b.fluxMjy / b.snr);
  const differs = (ratio >= COMPARE.minRatio || ratio <= 1 / COMPARE.minRatio) && Math.abs(b.fluxMjy - a.fluxMjy) >= COMPARE.sigma * error;
  return { kind: differs ? (ratio > 1 ? "brighter-in-b" : "fainter-in-b") : "same", ratio };
}

/** Pairs inside the grid, left to right. */
export function matchSources(a: SonataSource[], b: SonataSource[], grid: SkyGrid): SourcePair[] {
  const usedB = new Set<string>();
  const out: Omit<SourcePair, "id" | "x" | "y">[] = [];
  const nearest = (s: SonataSource, list: SonataSource[], skip?: Set<string>) => {
    let best: SonataSource | null = null;
    let bestD = Infinity;
    for (const q of list) {
      if (skip?.has(q.id)) continue;
      const d = separationArcsec(s, q);
      const radius = s.quality === "saturated" || q.quality === "saturated" ? COMPARE.saturatedRadiusArcsec : COMPARE.matchRadiusArcsec;
      if (d <= radius && d < bestD) {
        best = q;
        bestD = d;
      }
    }
    return best;
  };
  for (const s of a) {
    const partner = nearest(s, b, usedB);
    if (partner) {
      usedB.add(partner.id);
      if (strong(s) || strong(partner)) out.push({ a: s, b: partner, ...classify(s, partner), ra: s.ra, dec: s.dec });
    } else if (strong(s)) out.push({ a: s, b: null, kind: unpaired(s, "only-a"), ratio: null, ra: s.ra, dec: s.dec });
  }
  for (const s of b) {
    if (usedB.has(s.id) || !strong(s)) continue;
    out.push({ a: null, b: s, kind: unpaired(s, "only-b"), ratio: null, ra: s.ra, dec: s.dec });
  }
  return out
    .map((p) => ({ p, g: skyToGrid(grid, p.ra, p.dec) }))
    .filter((e) => e.g && e.g.i >= 0 && e.g.r >= 0 && e.g.i <= grid.n - 1 && e.g.r <= grid.n - 1)
    .sort((p, q) => p.g!.i - q.g!.i)
    .map(({ p, g }, k) => ({ ...p, id: `p${k + 1}`, x: g!.i / (grid.n - 1), y: g!.r / (grid.n - 1) }));
}

export const isDifference = (p: SourcePair) => p.kind !== "same" && p.kind !== "saturated";

/** A short low tick that stands for "nothing found here in this exposure". */
const missingCue = (x: number, start: number, s: SoundSettings): SoundEvent => ({
  sourceId: null,
  x,
  y: 1,
  start,
  duration: 0.07,
  frequency: 110,
  pan: s.mono ? 0 : 2 * x - 1,
  gain: 0.12,
  wave: "square",
});

/** The A note, then the B note of one pair, at the same pitch and side. Only the loudness can differ. */
export function pairEvents(pair: SourcePair, s: SoundSettings, start = 0): SoundEvent[] {
  const side = (src: SonataSource | null, t: number) => (src ? eventFor(src, pair.x, pair.y, src.fluxMjy, s, t) : missingCue(pair.x, t, s));
  return [side(pair.a, start), side(pair.b, start + COMPARE.gapSeconds)];
}

/** Up to `max` pairs for a run: every difference first, then the brightest unchanged ones, played left to right. */
export function pairsForRun(pairs: SourcePair[], max: number, differencesOnly: boolean): SourcePair[] {
  const brightness = (p: SourcePair) => Math.max(p.a?.fluxMjy ?? Infinity, p.b?.fluxMjy ?? Infinity);
  const differences = pairs.filter(isDifference);
  const rest = differencesOnly ? [] : pairs.filter((p) => !isDifference(p)).sort((p, q) => brightness(q) - brightness(p));
  return [...differences, ...rest].slice(0, max).sort((p, q) => p.x - q.x);
}

export function describePair(p: SourcePair): string {
  switch (p.kind) {
    case "same":
      return "About the same";
    case "brighter-in-b":
      return `Brighter in B (×${p.ratio!.toFixed(1)})`;
    case "fainter-in-b":
      return `Fainter in B (×${p.ratio!.toFixed(2)})`;
    case "only-a":
      return "Only found in A";
    case "only-b":
      return "Only found in B";
    case "saturated":
      return "Saturated: brightness cannot be compared";
  }
}
