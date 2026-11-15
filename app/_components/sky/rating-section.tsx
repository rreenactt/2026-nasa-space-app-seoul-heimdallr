"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MIN_RATINGS,
  movingShare,
  RATING_CHOICES,
  RATING_EMOJI,
  RATING_LABELS,
  type RatingState,
} from "@/app/_lib/ratings/types";
import { useBlink } from "../blink/blink-context";
import type { EquatorialCoordinates } from "./sky-coordinates";
import { useRate, useRating } from "./use-ratings";

/**
 * Feature B (PLAN.md chapter 8): one anonymous rating per browser and sky cell. Others' ratings stay hidden until this
 * browser has rated; afterwards the count and shares show as agreement, never as a confirmed result.
 */
export function RatingSection() {
  const { selection, plan, usable } = useBlink();
  const state = useRating(selection);
  const rate = useRate(selection);

  if (plan.data?.status === "no-observations") {
    return <p className="text-xs text-muted-foreground">No SPHEREx images to rate at this point.</p>;
  }

  const mine = state.data?.mine ?? null;
  const tally = state.data?.tally ?? null;
  const visitCount = usable.length;

  return (
    <div className="grid gap-2">
      <p className="text-xs text-muted-foreground">
        You can rate from the blink alone. Additional analyses are optional, and you can change your rating after them.
      </p>
      {visitCount < 2 && (
        <p className="text-xs text-muted-foreground">
          Only one SPHEREx visit here. Rating after the additional analyses is more accurate.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {RATING_CHOICES.map((choice) => (
          <Button
            key={choice}
            variant={mine === choice ? "default" : "outline"}
            size="sm"
            disabled={state.isPending || rate.isPending}
            aria-pressed={mine === choice}
            onClick={() => mine !== choice && rate.mutate({ choice, visitCount })}
          >
            <span aria-hidden>{RATING_EMOJI[choice]}</span>
            {RATING_LABELS[choice]}
          </Button>
        ))}
      </div>
      {(state.isError || rate.isError) && (
        <p className="text-xs text-destructive">{(rate.error ?? state.error)?.message ?? "Rating failed."}</p>
      )}
      {tally ? (
        <Tally tally={tally} />
      ) : (
        <p className="text-xs text-muted-foreground">Others&apos; ratings appear after you rate, so they do not sway you.</p>
      )}
      <p className="text-xs text-muted-foreground">
        Ratings are pooled over a fixed sky cell about 1.7′ across. One rating per browser; you can change it.
      </p>
    </div>
  );
}

function Tally({ tally }: { tally: NonNullable<RatingState["tally"]> }) {
  const share = (n: number) => `${Math.round((n / tally.total) * 100)}%`;
  return (
    <div className="grid gap-1 text-sm">
      <p>
        {tally.total} {tally.total === 1 ? "rating" : "ratings"}
        {tally.total < MIN_RATINGS && <span className="text-muted-foreground"> · Too few ratings</span>}
      </p>
      <p className="text-xs text-muted-foreground">
        <span aria-hidden>{RATING_EMOJI.moving}</span> Moving {share(tally.moving)} ·{" "}
        <span aria-hidden>{RATING_EMOJI["not-moving"]}</span> Not moving {share(tally.notMoving)} ·{" "}
        <span aria-hidden>{RATING_EMOJI["noise-or-artifact"]}</span> Noise or artifact {share(tally.noiseOrArtifact)}
      </p>
      <p className="text-xs text-muted-foreground">This shows agreement among raters, not a confirmed discovery.</p>
    </div>
  );
}

/** One-line summary of a rating state: "You rated Moving · 3 ratings · 67% Moving", or null if not rated. */
export function ratingSummary(state: RatingState | undefined): string | null {
  if (!state?.mine) return null;
  const parts = [`You rated ${RATING_EMOJI[state.mine]} ${RATING_LABELS[state.mine]}`];
  if (state.tally) {
    parts.push(`${state.tally.total} ${state.tally.total === 1 ? "rating" : "ratings"}`);
    parts.push(state.tally.total < MIN_RATINGS ? "Too few ratings" : `${movingShare(state.tally)}% Moving`);
  }
  return parts.join(" · ");
}

/** Panel header badge: this browser's rating and the tally, or "Not rated yet". Loads without the blink images. */
export function RatingBadge({ point }: { point: EquatorialCoordinates }) {
  const state = useRating(point);
  if (!state.data) return null;
  const summary = ratingSummary(state.data);
  return (
    <Badge variant={summary ? "secondary" : "outline"} className="font-normal">
      {summary ?? "Not rated yet"}
    </Badge>
  );
}
