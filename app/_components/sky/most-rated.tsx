"use client";

import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";
import { MOST_RATED_LIMIT } from "@/app/_lib/ratings/types";
import { ratingSummary } from "./rating-section";
import { formatDec, formatRa } from "./sky-coordinates";
import type { EquatorialCoordinates } from "./sky-coordinates";
import { useMostRated } from "./use-ratings";

/**
 * "Most rated places": the sky cells with the most ratings (PLAN.md chapter 8). Only the count is public; how people
 * rated shows only where this browser has rated too (decision #6). Choosing a place flies there and opens the panel.
 */
export function MostRated({ onSelect }: { onSelect: (point: EquatorialCoordinates) => void }) {
  const [open, setOpen] = useState(false);
  const places = useMostRated(open);

  return (
    <section className="dark w-96 rounded-md border border-white/10 bg-black/70 text-sm text-foreground backdrop-blur-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 text-left font-medium"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          <span aria-hidden>🏆 </span>Most rated places
        </span>
        <ChevronDownIcon className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div className="grid max-h-[40dvh] gap-1 overflow-y-auto border-t border-white/10 px-3 py-3">
          {places.isPending && <p className="text-xs text-muted-foreground">Loading…</p>}
          {places.isError && <p className="text-xs text-destructive">Could not load the ranking: {places.error.message}</p>}
          {places.data?.length === 0 && (
            <p className="text-xs text-muted-foreground">No ratings yet. Open a point and rate it to start the list.</p>
          )}
          {places.data?.map((place, i) => {
            const summary = ratingSummary(place.state);
            return (
              <button
                key={`${place.ra} ${place.dec}`}
                type="button"
                className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-baseline gap-x-2 rounded-md px-2 py-1.5 text-left hover:bg-white/10"
                onClick={() => onSelect({ ra: place.ra, dec: place.dec })}
              >
                <span className="text-muted-foreground tabular-nums">{i + 1}</span>
                <span className="truncate font-mono text-xs">
                  {formatRa(place.ra)} {formatDec(place.dec)}
                </span>
                <span className="tabular-nums">
                  {place.total} {place.total === 1 ? "rating" : "ratings"}
                </span>
                {summary && <span className="col-start-2 col-span-2 text-xs text-sky-300">{summary}</span>}
              </button>
            );
          })}
          {places.data && places.data.length > 0 && (
            <p className="pt-1 text-xs text-muted-foreground">
              Top {MOST_RATED_LIMIT} sky cells (about 1.7′) by number of ratings. A count is attention, not a result.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
