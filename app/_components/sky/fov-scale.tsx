"use client";

import { cn } from "cn";
import { AIM_FOV, MAX_FOV, MIN_FOV } from "./constants";
import { formatFov } from "./sky-tools";
import { useView } from "./view-store";

const TICKS = 41;
const MAJOR = [120, 30, 10, 1, 10 / 60, 1 / 60, 3 / 3600];

/** Position on the scale, 0 at the widest view and 1 at the closest (log scale). */
function position(fov: number) {
  return Math.log(MAX_FOV / fov) / Math.log(MAX_FOV / MIN_FOV);
}

/**
 * Field-of-view scale along the bottom (decision #38, from mockup C): a log ruler from the whole sky to the closest
 * zoom with a needle at the current view and the aiming zone (5° and closer) underlined. Always shown without the
 * frame, hidden with it.
 */
export function FovScale({ hidden }: { hidden: boolean }) {
  const view = useView();
  const at = view ? position(view.fov) : 0;
  return (
    <div
      aria-hidden={hidden}
      className={cn(
        "absolute bottom-4 left-1/2 w-[min(420px,60vw)] -translate-x-1/2 transition-opacity duration-300 [text-shadow:0_1px_3px_rgb(0_0_0/0.9)]",
        hidden ? "opacity-0" : "opacity-100",
      )}
    >
      <p className="mb-1.5 text-center font-data text-[12px] tracking-[0.04em] text-paper" aria-live="off">
        FOV {view ? formatFov(view.fov) : "—"}
      </p>
      <div className="relative h-3">
        {/* The aiming zone: from 5° in, a click opens the analysis instead of zooming. */}
        <span
          className="absolute bottom-0 h-[3px] bg-paper/25"
          style={{ left: `${position(AIM_FOV) * 100}%`, right: 0 }}
          title="Aiming zone"
        />
        {Array.from({ length: TICKS }, (_, index) => (
          <span
            key={index}
            className={cn("absolute bottom-0 w-px bg-ash/60", index % 5 === 0 ? "h-2" : "h-1")}
            style={{ left: `${(index / (TICKS - 1)) * 100}%` }}
          />
        ))}
        {/* No CSS transition: the view store updates every animation frame, so the needle follows the camera exactly. A
            transition here restarts on each frame and lags behind, then snaps when the zoom stops. */}
        <span
          className="absolute bottom-0 h-3 w-px bg-signal will-change-[left]"
          style={{ left: `${at * 100}%` }}
        />
      </div>
      <div className="relative mt-1 h-3 font-data text-[10px] text-smoke">
        {MAJOR.map((fov) => (
          <span key={fov} className="absolute -translate-x-1/2" style={{ left: `${position(fov) * 100}%` }}>
            {formatFov(fov)}
          </span>
        ))}
      </div>
    </div>
  );
}
