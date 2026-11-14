"use client";

import { useEffect, useMemo, useRef } from "react";
import { FLAG_CATEGORIES } from "@/app/_lib/fpl/flags";
import { decodeBits, type NativeFrame } from "@/app/_lib/fpl/checks";
import { nearestIndexMap } from "@/app/_lib/sky/reproject";
import { gridScaleDeg, gridToSky, skyToGrid } from "@/app/_lib/sky/wcs";
import type { CelestialWcs, SkyGrid } from "@/app/_lib/sky/types";

export interface PixelProbe {
  ra: number;
  dec: number;
  /** Original (native) pixel, cutout and detector coordinates. */
  x: number;
  y: number;
  detX: number;
  detY: number;
  value: number;
  sigma: number;
  flagValue: number;
  flagNames: string[];
}

function wcsOf(frame: NativeFrame): CelestialWcs {
  return { projection: "TAN", ...frame.payload.wcs, a: {}, b: {} };
}

/** Grid → native pixel index map, memoised per frame and grid. */
export function useIndexMap(frame: NativeFrame | undefined, grid: SkyGrid) {
  return useMemo(
    () => (frame ? nearestIndexMap(frame.payload.width, frame.payload.height, wcsOf(frame), grid) : null),
    [frame, grid],
  );
}

interface Props {
  frame: NativeFrame;
  grid: SkyGrid;
  layers: Record<string, boolean>;
  opacity: number;
  candidate: { ra: number; dec: number } | null;
  apertureArcsec: number;
  /** Shared display range (IMAGE − ZODI, MJy/sr) so visits are stretched identically. */
  range: { lo: number; hi: number };
  label: string;
  /** Extra point markers (sky positions) drawn on top, e.g. a measured centroid. */
  markers?: { ra: number; dec: number; color: string; shape: "plus" | "x" }[];
  onPick?: (p: { ra: number; dec: number }) => void;
  onProbe?: (p: PixelProbe | null) => void;
}

/**
 * Native pixels shown on the common sky grid by nearest-neighbour lookup (no interpolation), so every
 * displayed pixel and every flag value is an original one. Display = IMAGE − ZODI with one shared stretch. Flag layers never hide the image: they are
 * drawn as a translucent tint and can be switched off to see the masked signal.
 */
export function LayeredCanvas({ frame, grid, layers, opacity, candidate, apertureArcsec, range, label, markers, onPick, onProbe }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const map = useIndexMap(frame, grid);
  const bits = useMemo(() => decodeBits(frame.payload.flagBits), [frame.payload.flagBits]);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx || !map) return;
    const enabled = FLAG_CATEGORIES.filter((c) => layers[c.id]).map((c) => ({
      mask: bits.filter((b) => b.category.id === c.id).reduce((m, b) => m | b.mask, 0) >>> 0,
      rgb: c.color.split(",").map(Number),
    }));
    const img = ctx.createImageData(grid.n, grid.n);
    const span = range.hi - range.lo || 1;
    for (let k = 0; k < map.length; k++) {
      const src = map[k];
      const p = k * 4;
      if (src < 0) {
        img.data[p + 3] = 0;
        continue;
      }
      const v = frame.image[src] - frame.zodi[src];
      const t = Number.isFinite(v) ? Math.min(1, Math.max(0, (v - range.lo) / span)) : 0;
      let r = Math.round((255 * Math.asinh(8 * t)) / Math.asinh(8));
      let g = r;
      let b = r;
      const f = frame.flags[src] >>> 0;
      for (const e of enabled) {
        if (f & e.mask) {
          r = Math.round(r * (1 - opacity) + e.rgb[0] * opacity);
          g = Math.round(g * (1 - opacity) + e.rgb[1] * opacity);
          b = Math.round(b * (1 - opacity) + e.rgb[2] * opacity);
          break; // first matching layer in priority order
        }
      }
      img.data[p] = r;
      img.data[p + 1] = g;
      img.data[p + 2] = b;
      img.data[p + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [map, frame, grid.n, layers, opacity, bits, range]);

  const toGrid = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = ((e.clientX - rect.left) / rect.width) * grid.n - 0.5;
    const r = ((e.clientY - rect.top) / rect.height) * grid.n - 0.5;
    return { i, r };
  };
  const probe = (e: React.MouseEvent<HTMLDivElement>): PixelProbe | null => {
    if (!map) return null;
    const { i, r } = toGrid(e);
    const k = Math.round(r) * grid.n + Math.round(i);
    const src = map[k];
    const sky = gridToSky(grid, i, r);
    if (src == null || src < 0) return null;
    const w = frame.payload.width;
    const x = src % w;
    const y = Math.floor(src / w);
    const fv = frame.flags[src] >>> 0;
    return {
      ...sky,
      x,
      y,
      detX: frame.payload.origin[0] + x,
      detY: frame.payload.origin[1] + y,
      value: frame.image[src],
      sigma: Math.sqrt(Math.max(0, frame.variance[src])),
      flagValue: fv,
      flagNames: bits.filter((b) => (fv & b.mask) !== 0).map((b) => b.name),
    };
  };

  const c = candidate ? skyToGrid(grid, candidate.ra, candidate.dec) : null;
  const rGrid = apertureArcsec / (gridScaleDeg(grid) * 3600);

  return (
    <div
      className="relative aspect-square w-full cursor-crosshair overflow-hidden rounded-md bg-[repeating-linear-gradient(45deg,#3a3a3a_0_4px,#262626_4px_8px)]"
      onClick={onPick ? (e) => onPick(gridToSky(grid, toGrid(e).i, toGrid(e).r)) : undefined}
      onMouseMove={onProbe ? (e) => onProbe(probe(e)) : undefined}
      onMouseLeave={onProbe ? () => onProbe(null) : undefined}
    >
      <canvas ref={ref} width={grid.n} height={grid.n} className="absolute inset-0 size-full [image-rendering:pixelated]" />
      <svg viewBox={`0 0 ${grid.n} ${grid.n}`} className="pointer-events-none absolute inset-0 size-full" aria-hidden>
        {c && (
          <g fill="none" stroke="#38bdf8" strokeWidth={0.8}>
            <circle cx={c.i + 0.5} cy={c.r + 0.5} r={rGrid} />
            <line x1={c.i + 0.5 - rGrid - 6} x2={c.i + 0.5 - rGrid - 1} y1={c.r + 0.5} y2={c.r + 0.5} />
            <line x1={c.i + 0.5 + rGrid + 1} x2={c.i + 0.5 + rGrid + 6} y1={c.r + 0.5} y2={c.r + 0.5} />
            <line y1={c.r + 0.5 - rGrid - 6} y2={c.r + 0.5 - rGrid - 1} x1={c.i + 0.5} x2={c.i + 0.5} />
            <line y1={c.r + 0.5 + rGrid + 1} y2={c.r + 0.5 + rGrid + 6} x1={c.i + 0.5} x2={c.i + 0.5} />
          </g>
        )}
        {markers?.map((mk, i) => {
          const g = skyToGrid(grid, mk.ra, mk.dec);
          if (!g) return null;
          const cx = g.i + 0.5;
          const cy = g.r + 0.5;
          return mk.shape === "plus" ? (
            <g key={i} stroke={mk.color} strokeWidth={0.9}>
              <line x1={cx - 4} x2={cx + 4} y1={cy} y2={cy} />
              <line x1={cx} x2={cx} y1={cy - 4} y2={cy + 4} />
            </g>
          ) : (
            <g key={i} stroke={mk.color} strokeWidth={0.9}>
              <line x1={cx - 3} x2={cx + 3} y1={cy - 3} y2={cy + 3} />
              <line x1={cx - 3} x2={cx + 3} y1={cy + 3} y2={cy - 3} />
            </g>
          );
        })}
        <g fill="#fff" fillOpacity={0.75} fontSize={7}>
          <text x={grid.n - 12} y={9}>N↑</text>
          <text x={3} y={grid.n - 4}>←E</text>
        </g>
      </svg>
      <div className="absolute top-1.5 left-1.5 rounded bg-black/65 px-1.5 py-0.5 font-mono text-[11px] text-white">{label}</div>
    </div>
  );
}
