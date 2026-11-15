"use client";

import { XIcon } from "lucide-react";
import { cn } from "cn";
import type { GaiaStar } from "@/app/_lib/sky/types";
import { SKY_SURVEY } from "../constants";
import { formatDec, formatRa } from "../sky-coordinates";
import { GUIDE_MAX_FOV, GUIDE_MIN_PM, lightYears, SPHEREX_EPOCH, SPHEREX_PIXEL_ARCSEC, type StarGuideState, totalPm } from "./use-star-guide";

function formatLy(ly: number) {
  return ly < 100 ? `${ly.toFixed(ly < 10 ? 1 : 0)} light-years` : `${Math.round(ly / 10) * 10} light-years`;
}

type StarGuideCardProps = {
  state: StarGuideState;
  onHighlight: (rank: number | null) => void;
  /** Flies to the star's 2026 position and opens its analysis panel. */
  onOpen: (star: GaiaStar) => void;
  onClose: () => void;
};

/**
 * The star guide's card, bottom left while exploring: stars in the view that Gaia measured moving, as good places to
 * watch motion. Known stars only, in plain words; never presented as candidates.
 */
export function StarGuideCard({ state, onHighlight, onOpen, onClose }: StarGuideCardProps) {
  if (state.status === "off") return null;
  const { listed } = state;
  const sinceYears = SPHEREX_EPOCH - SKY_SURVEY.year;
  return (
    <section
      aria-label="Star guide"
      className="pointer-events-auto w-[320px] rounded-[2px] bg-ink/85 font-ui text-bone shadow-[0_0_0_1px_rgb(240_240_250/0.08)]"
    >
      <header className="flex h-9 items-center justify-between border-b border-rule pr-1.5 pl-3">
        <h2 className="text-[13px] font-medium text-paper">Star guide · stars that move</h2>
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
        {state.phase === "too-wide" && <p className="text-ash">Zoom in to {GUIDE_MAX_FOV}° or less to look up stars that move here.</p>}
        {state.phase === "waiting" && listed.length === 0 && <p className="text-ash">Hold the view still to look for stars that move.</p>}
        {state.phase === "loading" && <p className="text-ash">Looking up stars that Gaia measured moving…</p>}
        {state.phase === "error" && <p className="text-ash">The Gaia archive did not answer. Move the view a little to try again.</p>}
        {state.phase === "ready" && listed.length === 0 && (
          <p className="text-ash">
            No star on this screen moves {GUIDE_MIN_PM / 1000}″ a year or more, so motion would be hard to see. Try another
            part of the sky, such as Barnard&apos;s Star in the Review queue.
          </p>
        )}
        {listed.length > 0 && (
          <div className={cn("transition-opacity", state.moving && "opacity-60", state.phase === "loading" && "mt-1.5")}>
            <p>Good places to watch a star move, fastest first:</p>
            <ol className="mt-1.5 flex flex-col">
              {listed.map((star, index) => {
                const pm = totalPm(star) / 1000;
                const shift = pm * sinceYears;
                const ly = lightYears(star.parallax);
                return (
                  <li key={star.sourceId}>
                    <button
                      type="button"
                      onClick={() => onOpen(star)}
                      onPointerEnter={() => onHighlight(index + 1)}
                      onPointerLeave={() => onHighlight(null)}
                      onFocus={() => onHighlight(index + 1)}
                      onBlur={() => onHighlight(null)}
                      className="grid w-full grid-cols-[16px_1fr] gap-x-2 rounded-sm px-1 py-1.5 text-left hover:bg-paper/8 focus-visible:bg-paper/8"
                    >
                      <span className="font-data text-[11px] leading-[18px] text-[rgb(168,200,255)]">{index + 1}</span>
                      <span className="min-w-0">
                        <span className="block text-paper">
                          {pm.toFixed(pm >= 1 ? 1 : 2)}″ a year{ly ? ` · ${formatLy(ly)} away` : ""}
                        </span>
                        <span className="block text-[11.5px] leading-4 text-ash">
                          {shift.toFixed(0)}″ since {SKY_SURVEY.year}, about {(shift / SPHEREX_PIXEL_ARCSEC).toFixed(1)} SPHEREx pixels
                        </span>
                        <span className="block font-data text-[10.5px] leading-4 text-bone/70">
                          RA {formatRa(star.ra)} Dec {formatDec(star.dec)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <p className="mt-2 text-[11.5px] leading-4 text-ash">
              Click a star to open its SPHEREx images. Between two SPHEREx visits (six months) most stars move far less than
              a pixel, so the Sky Time Machine (25 years) shows the motion best.
            </p>
          </div>
        )}
      </div>
      <details className="border-t border-rule px-3 py-2 text-[11.5px] leading-4 text-ash">
        <summary className="cursor-pointer text-bone/80 hover:text-paper">What am I looking at?</summary>
        <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4">
          <li>
            These are known stars whose motion ESA&apos;s Gaia satellite measured (Gaia DR3), not new discoveries. Stars
            that move fastest across the sky are usually the closest ones.
          </li>
          <li>
            The square is where the star sits in this background picture ({SKY_SURVEY.shortName}, about {SKY_SURVEY.year}). The
            line shows where Gaia&apos;s motion puts it in {SPHEREX_EPOCH.toFixed(0)}, when SPHEREx observed.
          </li>
          <li>Coordinates are Gaia&apos;s 2016 positions. Listed: stars moving {GUIDE_MIN_PM / 1000}″ a year or more, about one SPHEREx pixel since {SKY_SURVEY.year}.</li>
        </ul>
      </details>
    </section>
  );
}
