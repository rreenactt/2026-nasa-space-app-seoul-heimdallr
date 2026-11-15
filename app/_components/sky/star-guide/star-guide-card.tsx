"use client";

import { XIcon } from "lucide-react";
import { cn } from "cn";
import { NUMBERED_STARS } from "./paint";
import type { GuideStar, StarGuideState } from "./use-star-guide";

function formatSize(arcsec: number) {
  return arcsec < 60 ? `${arcsec.toFixed(0)}″` : `${(arcsec / 60).toFixed(1)}′`;
}

const COLOR_TEXT: Record<GuideStar["color"], string | null> = { reddish: "Reddish", bluish: "Bluish", white: null };

type StarGuideCardProps = {
  state: StarGuideState;
  onHighlight: (rank: number | null) => void;
  /** Flies to the star and opens its analysis panel. */
  onOpen: (star: GuideStar) => void;
  onClose: () => void;
};

/**
 * The star guide's card, bottom left while exploring: what was measured on screen, in plain words. Educational only:
 * it compares how stars look on this screen and never suggests that a star moves.
 */
export function StarGuideCard({ state, onHighlight, onOpen, onClose }: StarGuideCardProps) {
  if (state.status === "off") return null;
  const numbered = state.status === "done" ? state.result.stars.filter((star) => star.rank <= NUMBERED_STARS) : [];
  return (
    <section
      aria-label="Star guide"
      className="pointer-events-auto w-[296px] rounded-[2px] bg-ink/85 font-ui text-bone shadow-[0_0_0_1px_rgb(240_240_250/0.08)]"
    >
      <header className="flex h-9 items-center justify-between border-b border-rule pr-1.5 pl-3">
        <h2 className="text-[13px] font-medium text-paper">Star guide</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Turn off the star guide"
          className="grid size-7 place-items-center rounded-sm text-ash hover:bg-paper/10 hover:text-paper [&_svg]:size-4"
        >
          <XIcon />
        </button>
      </header>
      <div aria-live="polite" className="px-3 py-2.5 text-[12.5px] leading-[18px]">
        {state.status === "waiting" && <p className="text-ash">Hold the view still for a moment to measure the stars on screen.</p>}
        {state.status === "measuring" && <p className="text-ash">Measuring the stars on screen…</p>}
        {state.status === "unreadable" && <p className="text-ash">This browser did not let the guide read the sky picture.</p>}
        {state.status === "done" && state.result.stars.length === 0 && (
          <p className={cn("text-ash", state.stale && "opacity-60")}>
            No star-like dots on this screen. Zoom in, or move to a busier part of the sky.
          </p>
        )}
        {state.status === "done" && state.result.stars.length > 0 && (
          <div className={cn("transition-opacity", state.stale && "opacity-60")}>
            <p>
              {state.result.approximate ? "About " : ""}
              {state.result.found} star{state.result.found === 1 ? "" : "s"} found on screen. The {numbered.length} brightest:
            </p>
            <ol className="mt-2 flex flex-col">
              {numbered.map((star) => (
                <li key={star.rank}>
                  <button
                    type="button"
                    onClick={() => onOpen(star)}
                    onPointerEnter={() => onHighlight(star.rank)}
                    onPointerLeave={() => onHighlight(null)}
                    onFocus={() => onHighlight(star.rank)}
                    onBlur={() => onHighlight(null)}
                    className="grid w-full grid-cols-[18px_1fr_auto] items-center gap-2 rounded-sm px-1 py-1 text-left hover:bg-paper/8 focus-visible:bg-paper/8"
                  >
                    <span className="font-data text-[11px] text-[rgb(168,200,255)]">{star.rank}</span>
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden
                        className="h-1.5 rounded-full bg-[rgb(168,200,255)]"
                        style={{ width: `${Math.max(star.relative * 64, 3)}px` }}
                      />
                      <span className="truncate text-ash">
                        {[star.saturated ? "Clipped white" : null, COLOR_TEXT[star.color]].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="font-data text-[11px] text-bone/80">
                      {Math.round(star.relative * 100)}% · {formatSize(star.fwhmArcsec)}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-[11.5px] leading-4 text-ash">
              Bar and % compare brightness with the brightest star here; the size is how wide it looks. Click a star to
              see its SPHEREx images.
            </p>
          </div>
        )}
      </div>
      <details className="border-t border-rule px-3 py-2 text-[11.5px] leading-4 text-ash">
        <summary className="cursor-pointer text-bone/80 hover:text-paper">What do these mean?</summary>
        <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4">
          <li>Measured on the picture you see, so the numbers change with the zoom and the background image. They compare stars on this screen only and are not real brightness.</li>
          <li>A star that looks bigger is usually brighter: its light spreads over more pixels. It is not closer.</li>
          <li>Clipped white: brighter than the screen can show, so its brightness here is a lower limit.</li>
          <li>Reddish: brighter at the longest infrared wavelengths in this picture, as cool stars and stars behind dust are.</li>
          <li>How a star looks does not tell whether it moves. Blinking its SPHEREx images does.</li>
        </ul>
      </details>
    </section>
  );
}
