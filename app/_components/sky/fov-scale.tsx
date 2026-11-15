"use client";

import { cn } from "cn";
import { AIM_FOV, MAX_FOV, MIN_FOV } from "./constants";
import { formatFov } from "./sky-tools";
import { useView } from "./view-store";

/** The labelled ticks, widest first; 5° is the aiming threshold (AIM_FOV). */
const MAJOR = [MAX_FOV, 30, AIM_FOV, 1, MIN_FOV];

/** Position on the scale, 0 at the widest view and 1 at the closest (log scale). */
function position(fov: number) {
  return Math.min(Math.max(Math.log(MAX_FOV / fov) / Math.log(MAX_FOV / MIN_FOV), 0), 1);
}

/** Tick labels as in Figma: whole degrees without decimals, and "5° aim" at the threshold. */
const label = (fov: number) => (fov === AIM_FOV ? `${fov}° aim` : `${fov}°`);

/**
 * What a click does and the field-of-view scale, at the bottom centre while exploring (Figma "I · Explore"): a 440px
 * log track from 120° to 0.05° with five labelled ticks, the aiming zone (5° and closer) as a brighter bar, and a dot
 * at the current view with its value above it. Hidden with the frame. The view store updates every animation frame,
 * so the dot follows the camera with no CSS transition (a transition restarts each frame and lags, then snaps).
 */
export function FovScale({ hidden, aiming }: { hidden: boolean; aiming: boolean }) {
  const view = useView();
  const at = view ? position(view.fov) : 0;
  return (
    <div
      aria-hidden={hidden}
      className={cn(
        "absolute bottom-[34px] left-1/2 w-[min(440px,calc(100vw-48px))] -translate-x-1/2 text-center transition-opacity duration-300 [text-shadow:0_1px_3px_rgb(0_0_0/0.9)]",
        hidden ? "pointer-events-none opacity-0" : "opacity-100",
      )}
    >
      <p className="text-[17px] leading-[23px] text-paper">
        {aiming ? "Click a point to analyze it" : "Click anywhere to zoom in"}
      </p>
      <p className="mt-px text-[12.5px] leading-[17px] text-ash">
        {aiming
          ? "Wider than 5° a click zooms in instead. Click a pin to analyze it."
          : "Below 5° you can aim at a point. Click a pin to analyze it."}
      </p>
      <div className="relative mt-[3px] h-[13px]">
        <span
          className="absolute -translate-x-1/2 font-data text-[11px] leading-[13px] tracking-[0.02em] text-paper"
          style={{ left: `${at * 100}%` }}
          aria-live="off"
        >
          {view ? formatFov(view.fov) : "—"}
        </span>
      </div>
      <div className="relative mt-[3px] h-[9px]">
        <span className="absolute inset-x-0 top-1 h-px bg-ash/50" />
        {/* The aiming zone: from 5° in, a click opens the analysis instead of zooming. */}
        <span
          className="absolute top-[3px] right-0 h-[3px] bg-paper/35"
          style={{ left: `${position(AIM_FOV) * 100}%` }}
          title="Aiming zone"
        />
        {MAJOR.map((fov) => (
          <span key={fov} className="absolute top-0 h-[9px] w-px bg-ash" style={{ left: `${position(fov) * 100}%` }} />
        ))}
        <span
          className="absolute top-[-0.5px] size-[10px] -translate-x-1/2 rounded-full border-2 border-ink bg-paper will-change-[left]"
          style={{ left: `${at * 100}%` }}
        />
      </div>
      <div className="relative mt-[5px] h-3">
        {MAJOR.map((fov) => (
          <span
            key={fov}
            className={cn(
              "absolute -translate-x-1/2 font-data text-[10px] leading-3 tracking-[0.02em] whitespace-nowrap",
              fov === AIM_FOV ? "text-paper" : "text-ash",
            )}
            style={{ left: `${position(fov) * 100}%` }}
          >
            {label(fov)}
          </span>
        ))}
      </div>
    </div>
  );
}
