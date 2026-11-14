"use client";

import { useEffect, useMemo, useRef } from "react";
import { gridToSky, mjdToYear, propagate, skyToGrid } from "@/app/_lib/sky/wcs";
import type { GaiaStar, SkyGrid } from "@/app/_lib/sky/types";
import type { Mark } from "./stm-state";

/** Display-only stretch range (1st–99.5th percentile of the frame's valid pixels). */
export function displayRange(data: Float32Array): { lo: number; hi: number } {
  const v: number[] = [];
  for (let k = 0; k < data.length; k += 2) if (Number.isFinite(data[k])) v.push(data[k]);
  if (!v.length) return { lo: 0, hi: 1 };
  v.sort((a, b) => a - b);
  const lo = v[Math.floor(v.length * 0.01)];
  const hi = v[Math.floor(v.length * 0.995)];
  return { lo, hi: hi > lo ? hi : lo + 1 };
}

export interface CanvasOverlay {
  marks: Mark[];
  currentEpochId?: string;
  /** Year of the frame, for Gaia predicted positions. */
  year?: number;
  gaia?: GaiaStar[];
  /** Years at which to draw the Gaia path (timeline stops). */
  gaiaPathYears?: number[];
  crosshair?: { ra: number; dec: number } | null;
}

interface Props {
  grid: SkyGrid;
  data: Float32Array | null;
  label?: string;
  overlay: CanvasOverlay;
  onPick?: (p: { ra: number; dec: number; i: number; r: number }) => void;
  onHover?: (p: { ra: number; dec: number } | null) => void;
  children?: React.ReactNode;
}

/**
 * The common sky grid (north up, east left). Pixels without data are transparent over a hatch pattern,
 * so missing coverage is never mistaken for dark sky.
 */
export function SkyCanvas({ grid, data, label, overlay, onPick, onHover, children }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const range = useMemo(() => (data ? displayRange(data) : null), [data]);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(grid.n, grid.n);
    if (data && range) {
      const span = range.hi - range.lo;
      for (let k = 0; k < data.length; k++) {
        const v = data[k];
        const p = k * 4;
        if (!Number.isFinite(v)) {
          img.data[p + 3] = 0;
          continue;
        }
        const t = Math.min(1, Math.max(0, (v - range.lo) / span));
        const g = Math.round((255 * Math.asinh(8 * t)) / Math.asinh(8));
        img.data[p] = g;
        img.data[p + 1] = g;
        img.data[p + 2] = g;
        img.data[p + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [data, range, grid.n]);

  const toSvg = (ra: number, dec: number) => {
    const g = skyToGrid(grid, ra, dec);
    return g ? { x: g.i + 0.5, y: g.r + 0.5 } : null;
  };
  const eventToGrid = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = ((e.clientX - rect.left) / rect.width) * grid.n - 0.5;
    const r = ((e.clientY - rect.top) / rect.height) * grid.n - 0.5;
    return { i, r, ...gridToSky(grid, i, r) };
  };

  const sorted = [...overlay.marks].sort((a, b) => a.mjd - b.mjd);
  const pathPoints = sorted.map((m) => toSvg((m.measured ?? m.user).ra, (m.measured ?? m.user).dec)).filter(Boolean) as { x: number; y: number }[];
  const unit = grid.n / 256;

  return (
    <div
      className="relative aspect-square w-full cursor-crosshair overflow-hidden rounded-md bg-[repeating-linear-gradient(45deg,#3a3a3a_0_4px,#262626_4px_8px)]"
      onClick={onPick ? (e) => onPick(eventToGrid(e)) : undefined}
      onMouseMove={onHover ? (e) => onHover(eventToGrid(e)) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
    >
      <canvas ref={ref} width={grid.n} height={grid.n} className="absolute inset-0 size-full [image-rendering:pixelated]" />
      <svg viewBox={`0 0 ${grid.n} ${grid.n}`} className="pointer-events-none absolute inset-0 size-full" aria-hidden>
        {/* Gaia predicted path (linear proper motion) */}
        {overlay.gaia?.map((s) => {
          const pts = (overlay.gaiaPathYears ?? [])
            .map((y) => propagate(s.ra, s.dec, s.pmra, s.pmdec, 2016, y))
            .map((q) => toSvg(q.ra, q.dec))
            .filter(Boolean) as { x: number; y: number }[];
          const q = overlay.year != null ? propagate(s.ra, s.dec, s.pmra, s.pmdec, 2016, overlay.year) : null;
          const now = q ? toSvg(q.ra, q.dec) : null;
          return (
            <g key={s.sourceId}>
              {pts.length > 1 && (
                <polyline points={pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#a78bfa" strokeOpacity={0.55} strokeWidth={0.8 * unit} />
              )}
              {now && (
                <rect x={now.x - 4 * unit} y={now.y - 4 * unit} width={8 * unit} height={8 * unit} fill="none" stroke="#a78bfa" strokeWidth={1 * unit} transform={`rotate(45 ${now.x} ${now.y})`} />
              )}
            </g>
          );
        })}
        {/* Connection between marked positions: not an observed path */}
        {pathPoints.length > 1 && (
          <polyline points={pathPoints.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#38bdf8" strokeOpacity={0.7} strokeWidth={0.8 * unit} strokeDasharray={`${3 * unit} ${3 * unit}`} />
        )}
        {sorted.map((m) => {
          const u = toSvg(m.user.ra, m.user.dec);
          const c = m.measured ? toSvg(m.measured.ra, m.measured.dec) : null;
          const active = m.epochId === overlay.currentEpochId;
          return (
            <g key={m.epochId} opacity={active ? 1 : 0.55}>
              {u && <circle cx={u.x} cy={u.y} r={(active ? 6 : 4) * unit} fill="none" stroke="#38bdf8" strokeWidth={1.2 * unit} />}
              {c && (
                <g stroke="#facc15" strokeWidth={1.2 * unit}>
                  <line x1={c.x - 4 * unit} x2={c.x + 4 * unit} y1={c.y} y2={c.y} />
                  <line x1={c.x} x2={c.x} y1={c.y - 4 * unit} y2={c.y + 4 * unit} />
                </g>
              )}
            </g>
          );
        })}
        {overlay.crosshair &&
          (() => {
            const p = toSvg(overlay.crosshair.ra, overlay.crosshair.dec);
            return p ? (
              <g stroke="#f472b6" strokeWidth={0.6 * unit} strokeOpacity={0.8}>
                <line x1={p.x - 10 * unit} x2={p.x - 3 * unit} y1={p.y} y2={p.y} />
                <line x1={p.x + 3 * unit} x2={p.x + 10 * unit} y1={p.y} y2={p.y} />
                <line x1={p.x} x2={p.x} y1={p.y - 10 * unit} y2={p.y - 3 * unit} />
                <line x1={p.x} x2={p.x} y1={p.y + 3 * unit} y2={p.y + 10 * unit} />
              </g>
            ) : null;
          })()}
        {/* Orientation */}
        <g fill="#fff" fillOpacity={0.75} fontSize={9 * unit}>
          <text x={grid.n - 14 * unit} y={14 * unit}>N↑</text>
          <text x={4 * unit} y={grid.n - 6 * unit}>←E</text>
        </g>
      </svg>
      {label && <div className="absolute top-1.5 left-1.5 rounded bg-black/65 px-1.5 py-0.5 font-mono text-[11px] text-white">{label}</div>}
      {children}
    </div>
  );
}

/** Flux-weighted centroid of positive (above-median) pixels within `radius` grid pixels of (i, r). */
export function centroidNear(grid: SkyGrid, data: Float32Array, i: number, r: number, radius: number) {
  const vals: number[] = [];
  const pix: [number, number, number][] = [];
  for (let rr = Math.round(r) - radius; rr <= Math.round(r) + radius; rr++) {
    for (let ii = Math.round(i) - radius; ii <= Math.round(i) + radius; ii++) {
      if (rr < 0 || ii < 0 || rr >= grid.n || ii >= grid.n) continue;
      if ((ii - i) ** 2 + (rr - r) ** 2 > radius * radius) continue;
      const v = data[rr * grid.n + ii];
      if (!Number.isFinite(v)) continue;
      vals.push(v);
      pix.push([ii, rr, v]);
    }
  }
  if (pix.length < 5) return null;
  const sorted = [...vals].sort((a, b) => a - b);
  const base = sorted[Math.floor(sorted.length / 2)];
  let sw = 0;
  let sx = 0;
  let sy = 0;
  for (const [ii, rr, v] of pix) {
    const w = v - base;
    if (w > 0) {
      sw += w;
      sx += w * ii;
      sy += w * rr;
    }
  }
  if (sw <= 0) return null;
  return gridToSky(grid, sx / sw, sy / sw);
}

export { mjdToYear };
