"use client";

import { cn } from "cn";
import { Keycap } from "../site/keycap";
import { formatDec, formatRa } from "./sky-coordinates";
import { useView } from "./view-store";

const ARMS = [
  [30, 6, 30, 16],
  [30, 44, 30, 54],
  [6, 30, 16, 30],
  [44, 30, 54, 30],
] as const;

/**
 * The view center while aiming with the frame off (decision #50, Figma "I · Explore, aiming (view center)"): a
 * crosshair with a 14px gap, so a target flown to the center stays visible, and the center's RA/Dec with the Enter key,
 * which analyzes this point. Shown from AIM_FOV in, where Enter opens the analysis instead of zooming.
 */
export function ViewCenter({ hidden }: { hidden: boolean }) {
  const view = useView();
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute top-1/2 left-1/2 z-10 size-[60px] -translate-x-1/2 -translate-y-1/2 transition-opacity duration-200",
        hidden || !view ? "opacity-0" : "opacity-100",
      )}
    >
      <svg viewBox="0 0 60 60" className="absolute inset-0 size-full">
        {[
          { stroke: "rgb(1 1 1 / 0.55)", width: 3 },
          { stroke: "var(--color-paper)", width: 1 },
        ].map(({ stroke, width }) => (
          <g key={width} stroke={stroke} strokeWidth={width}>
            {ARMS.map(([x1, y1, x2, y2]) => (
              <line key={`${x1} ${y1}`} x1={x1} y1={y1} x2={x2} y2={y2} />
            ))}
          </g>
        ))}
      </svg>
      {/* 18px right of and 16px below the center, as in Figma. */}
      <div className="absolute top-[46px] left-12 flex items-center gap-2 whitespace-nowrap">
        <span className="font-data text-[10.5px] leading-[13px] text-bone [text-shadow:0_1px_3px_rgb(0_0_0/0.9)]">
          {view ? `${formatRa(view.ra)}  ${formatDec(view.dec)}` : ""}
        </span>
        <Keycap>Enter</Keycap>
      </div>
    </div>
  );
}
