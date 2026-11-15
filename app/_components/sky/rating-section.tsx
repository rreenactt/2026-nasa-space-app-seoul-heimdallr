"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MIN_RATINGS,
  movingShare,
  RATING_CHOICES,
  RATING_LABELS,
  type RatingState,
} from "@/app/_lib/ratings/types";
import { ratingStatus, STATUS_RULES } from "@/app/_lib/ratings/status";
import { useEffect, useState } from "react";
import { cn } from "cn";
import { useBlink } from "../blink/blink-context";
import { useCandidateAt, useCandidateUpdates } from "./candidates-context";
import type { MovementCandidate } from "./review-queue";
import type { EquatorialCoordinates } from "./sky-coordinates";
import { RatingIcon } from "./rating-icon";
import { StatusMark } from "./status-mark";
import { useRate, useRating } from "./use-ratings";

/**
 * Feature B (PLAN.md chapter 8): one anonymous rating per browser and sky cell. Others' ratings stay hidden until this
 * browser has rated; afterwards the count and shares show as agreement, never as a confirmed result.
 */
export function RatingSection() {
  const { selection, plan, usable } = useBlink();
  // Asked again every 10 s while the panel is open, so ratings from other browsers arrive (decision #57).
  const state = useRating(selection, { live: true });
  const rate = useRate(selection);
  const candidate = useCandidateAt(selection);
  const { setStatus } = useCandidateUpdates();
  const tallyNow = state.data?.tally ?? null;
  // The tally this browser saw when it rated, to tell how many ratings arrived since.
  const [ratedTotal, setRatedTotal] = useState<number | null>(null);

  // A fresh tally (this browser's rating or one read again) sets the candidate's status everywhere on screen at once.
  const candidateId = candidate?.id;
  const candidateMatch = candidate?.match;
  useEffect(() => {
    if (!candidateId || !candidateMatch || !tallyNow) return;
    setStatus(candidateId, ratingStatus(tallyNow, candidateMatch));
  }, [candidateId, candidateMatch, tallyNow, setStatus]);

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
            onClick={() =>
              mine !== choice &&
              rate.mutate({ choice, visitCount }, { onSuccess: (next) => setRatedTotal(next.tally?.total ?? null) })
            }
          >
            <RatingIcon choice={choice} />
            {RATING_LABELS[choice]}
          </Button>
        ))}
      </div>
      {(state.isError || rate.isError) && (
        <p className="text-xs text-destructive">{(rate.error ?? state.error)?.message ?? "Rating failed."}</p>
      )}
      {tally && candidate && (
        <CandidateStatusLine
          candidate={candidate}
          tally={tally}
          arrived={ratedTotal === null ? 0 : tally.total - ratedTotal}
        />
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

/**
 * What the ratings make of this candidate (decision #57, Figma "I · Ratings change status live"): its status as the
 * queue and the sky now show it, how far it is from a status, and how many ratings arrived since this browser rated.
 */
function CandidateStatusLine({
  candidate,
  tally,
  arrived,
}: {
  candidate: MovementCandidate;
  tally: NonNullable<RatingState["tally"]>;
  arrived: number;
}) {
  const status = ratingStatus(tally, candidate.match);
  const ratings = `${tally.total} ${tally.total === 1 ? "rating" : "ratings"}`;
  const share = `${movingShare(tally)}% Moving`;
  const missing = STATUS_RULES.minRatings - tally.total;
  const line =
    candidate.match === "known"
      ? { mark: "known" as const, text: `Known mover · ${ratings} · ${share}` }
      : status === "noteworthy"
        ? { mark: "noteworthy" as const, text: `Noteworthy · ${ratings} · ${share}` }
        : status === "recommended"
          ? { mark: "recommended" as const, text: `Recommended · ${ratings} · ${share}` }
          : status === "excluded"
            ? { mark: null, text: `Left out of the queue · ${ratings} · ${share}` }
            : { mark: "needs-ratings" as const, text: `Needs ratings · ${tally.total} of ${STATUS_RULES.minRatings}` };
  const note =
    missing > 0
      ? `${missing} more ${missing === 1 ? "rating gives" : "ratings give"} it a status.`
      : candidate.match === "known"
        ? `Answer key: Gaia DR3 says it moves. ${tally.moving} of ${tally.total} raters saw it move.`
        : status === "excluded"
          ? "Most raters see no motion or an artifact. It still opens from its coordinates."
          : null;
  return (
    <div className="grid gap-0.5">
      <div className="flex items-center gap-2 text-sm">
        {line.mark && <StatusMark kind={line.mark} className="size-2.5" />}
        <span className={cn("font-medium", line.mark === "noteworthy" && "text-signal")}>{line.text}</span>
        {arrived > 0 && <span className="ml-auto text-xs">+{arrived} since you rated</span>}
      </div>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
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
        <RatingIcon choice="moving" /> Moving {share(tally.moving)} · <RatingIcon choice="not-moving" /> Not moving{" "}
        {share(tally.notMoving)} · <RatingIcon choice="noise-or-artifact" /> Noise or artifact {share(tally.noiseOrArtifact)}
      </p>
      <p className="text-xs text-muted-foreground">This shows agreement among raters, not a confirmed discovery.</p>
    </div>
  );
}

/**
 * One-line summary of a rating state: "You rated [icon] Moving · 3 ratings · 67% Moving", or null if not rated. Shared
 * by the panel header badge and the queue rows.
 */
export function RatedSummary({ state }: { state: RatingState | undefined }) {
  if (!state?.mine) return null;
  const rest = state.tally
    ? [
        `${state.tally.total} ${state.tally.total === 1 ? "rating" : "ratings"}`,
        state.tally.total < MIN_RATINGS ? "Too few ratings" : `${movingShare(state.tally)}% Moving`,
      ]
    : [];
  return (
    <>
      You rated <RatingIcon choice={state.mine} /> {[RATING_LABELS[state.mine], ...rest].join(" · ")}
    </>
  );
}

/** Panel header badge: this browser's rating and the tally, or "Not rated yet". Loads without the blink images. */
export function RatingBadge({ point }: { point: EquatorialCoordinates }) {
  const state = useRating(point);
  if (!state.data) return null;
  return (
    <Badge variant={state.data.mine ? "secondary" : "outline"} className="font-normal">
      {state.data.mine ? <RatedSummary state={state.data} /> : "Not rated yet"}
    </Badge>
  );
}
