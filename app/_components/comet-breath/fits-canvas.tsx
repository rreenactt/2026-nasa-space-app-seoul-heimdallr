"use client";

import { useEffect, useMemo, useRef } from "react";
import { APERTURE_BAD_FLAGS, maskFor } from "@/app/_lib/comet/photometry";
import type { ApertureParams } from "@/app/_lib/comet/types";
import type { DecodedFrame } from "./use-comet-data";

export type Stretch = "asinh" | "linear" | "log";

export interface DisplayRange {
  lo: number;
  hi: number;
}

/** Display-only pixel values (never fed into photometry). */
export function displayValues(frame: DecodedFrame, subtractZodi: boolean): Float32Array {
  if (!subtractZodi) return frame.image;
  const out = new Float32Array(frame.image.length);
  for (let i = 0; i < out.length; i++) out[i] = frame.image[i] - frame.zodi[i];
  return out;
}

export function percentileRange(values: Float32Array, lowPct: number, highPct: number): DisplayRange {
  const finite = Array.from(values).filter(Number.isFinite).sort((a, b) => a - b);
  if (finite.length === 0) return { lo: 0, hi: 1 };
  const at = (p: number) => finite[Math.min(finite.length - 1, Math.max(0, Math.round((p / 100) * (finite.length - 1))))];
  const lo = at(lowPct);
  const hi = at(highPct);
  return { lo, hi: hi > lo ? hi : lo + 1e-6 };
}

function stretchValue(t: number, stretch: Stretch): number {
  const c = Math.min(1, Math.max(0, t));
  if (stretch === "linear") return c;
  if (stretch === "log") return Math.log10(1 + 999 * c) / 3;
  return Math.asinh(10 * c) / Math.asinh(10);
}

interface Props {
  frame: DecodedFrame;
  values: Float32Array;
  range: DisplayRange;
  stretch: Stretch;
  showFlags: boolean;
  /** Comet position (0-based pixel, FITS orientation) or null when outside the frame. */
  comet: { x: number; y: number } | null;
  aperture?: ApertureParams;
  label?: string;
}

/** Renders a cutout at native resolution (FITS row 0 at the bottom) with SVG overlays. */
export function FitsCanvas({ frame, values, range, stretch, showFlags, comet, aperture, label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { width, height } = frame.payload;
  const badMask = useMemo(() => maskFor(frame.payload.flagBits, APERTURE_BAD_FLAGS), [frame.payload.flagBits]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const img = ctx.createImageData(width, height);
    const span = range.hi - range.lo;
    for (let j = 0; j < height; j++) {
      for (let i = 0; i < width; i++) {
        const k = j * width + i;
        const row = height - 1 - j; // flip: FITS origin is bottom-left
        const p = (row * width + i) * 4;
        const v = values[k];
        const g = Number.isFinite(v) ? Math.round(255 * stretchValue((v - range.lo) / span, stretch)) : 0;
        let [r, gg, b] = [g, g, g];
        if (showFlags && (frame.flags[k] >>> 0) & badMask) [r, gg, b] = [220, 50, 60];
        img.data[p] = r;
        img.data[p + 1] = gg;
        img.data[p + 2] = b;
        img.data[p + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [values, range, stretch, showFlags, width, height, frame.flags, badMask]);

  const svgX = (x: number) => x + 0.5;
  const svgY = (y: number) => height - y - 0.5;

  return (
    <figure className="relative w-full overflow-hidden rounded-md bg-black" style={{ aspectRatio: `${width} / ${height}` }}>
      <canvas ref={canvasRef} width={width} height={height} className="absolute inset-0 size-full [image-rendering:pixelated]" />
      <svg viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 size-full" aria-hidden>
        {comet && aperture && (
          <g fill="none" strokeWidth={0.35}>
            <circle cx={svgX(comet.x)} cy={svgY(comet.y)} r={aperture.rAp} stroke="#3cf" />
            <circle cx={svgX(comet.x)} cy={svgY(comet.y)} r={aperture.rIn} stroke="#fc3" strokeDasharray="1 1" />
            <circle cx={svgX(comet.x)} cy={svgY(comet.y)} r={aperture.rOut} stroke="#fc3" strokeDasharray="1 1" />
          </g>
        )}
        {comet && !aperture && (
          <g stroke="#3cf" strokeWidth={0.4}>
            <line x1={svgX(comet.x) - 4} x2={svgX(comet.x) - 1.5} y1={svgY(comet.y)} y2={svgY(comet.y)} />
            <line x1={svgX(comet.x) + 1.5} x2={svgX(comet.x) + 4} y1={svgY(comet.y)} y2={svgY(comet.y)} />
            <line y1={svgY(comet.y) - 4} y2={svgY(comet.y) - 1.5} x1={svgX(comet.x)} x2={svgX(comet.x)} />
            <line y1={svgY(comet.y) + 1.5} y2={svgY(comet.y) + 4} x1={svgX(comet.x)} x2={svgX(comet.x)} />
          </g>
        )}
      </svg>
      {label && (
        <figcaption className="absolute top-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[11px] text-white">{label}</figcaption>
      )}
      {!comet && (
        <div className="absolute right-1.5 bottom-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">Comet is outside this area</div>
      )}
    </figure>
  );
}
