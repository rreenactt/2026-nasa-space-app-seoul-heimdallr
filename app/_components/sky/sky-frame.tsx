import { cn } from "cn";
import "./sky-frame.css";

/**
 * The frame over the sky (decision #38), as in Figma "I · Frame states": with it on, the sky sits in an inset with
 * 2px corners (56px band on top, 12px at the sides and bottom) and everything outside is black. It is one box whose
 * huge shadow paints the outside, so the sky itself never resizes and its coordinates never move. It closes in over
 * 0.5 s ("like a cut to a scene") and opens out in 0.25 s so it never holds up a drag.
 *
 * - Off (landing, exploring, locked off): full-bleed, with soft fades at the top and bottom for legibility.
 * - On (flying to a target, reviewing): the inset.
 * - Analysis open: the inset plus a 45% darker sky, to focus on the images.
 */
export function SkyFrame({ on, dim }: { on: boolean; dim: boolean }) {
  const timing = on ? "duration-500" : "duration-250";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[5] overflow-hidden">
      <div
        className={cn(
          "absolute transition-[inset,border-radius] ease-out-expo",
          timing,
          on ? "inset-[56px_12px_12px_12px] rounded-[2px]" : "inset-0 rounded-none",
        )}
        style={{ boxShadow: "0 0 0 100vmax var(--color-ink)" }}
      >
        <div
          className={cn(
            "absolute inset-0 rounded-[inherit] bg-ink/45 transition-opacity duration-500",
            dim ? "opacity-100" : "opacity-0",
          )}
        />
      </div>
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-[120px] bg-linear-to-b from-ink/75 to-transparent transition-opacity",
          timing,
          on ? "opacity-0" : "opacity-100",
        )}
      />
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 h-[160px] bg-linear-to-t from-ink/70 to-transparent transition-opacity",
          timing,
          on ? "opacity-0" : "opacity-100",
        )}
      />
    </div>
  );
}
