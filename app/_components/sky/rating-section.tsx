"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type Translate, useT } from "@/app/_i18n/i18n-provider";
import {
  MIN_RATINGS,
  movingShare,
  RATING_CHOICES,
  RATING_KEYS,
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
import { MARK_LABEL_KEYS, StatusMark } from "./status-mark";
import { useRate, useRating } from "./use-ratings";

/**
 * Feature B (PLAN.md chapter 8): one anonymous rating per browser and sky cell. Others' ratings stay hidden until this
 * browser has rated; afterwards the count and shares show as agreement, never as a confirmed result.
 */
export function RatingSection() {
  const t = useT();
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
    return <p className="text-xs text-muted-foreground">{t("rating.noImages")}</p>;
  }

  const mine = state.data?.mine ?? null;
  const tally = state.data?.tally ?? null;
  const visitCount = usable.length;

  return (
    <div className="grid gap-2">
      <p className="text-xs text-muted-foreground">{t("rating.optionalAnalyses")}</p>
      {visitCount < 2 && (
        <p className="text-xs text-muted-foreground">{t("rating.oneVisit")}</p>
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
            {t(RATING_KEYS[choice])}
          </Button>
        ))}
      </div>
      {(state.isError || rate.isError) && (
        <p className="text-xs text-destructive">{(rate.error ?? state.error)?.message ?? t("rating.failed")}</p>
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
        <p className="text-xs text-muted-foreground">{t("rating.hiddenUntilRated")}</p>
      )}
      <p className="text-xs text-muted-foreground">{t("rating.pooled")}</p>
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
  const t = useT();
  const status = ratingStatus(tally, candidate.match);
  const facts = ` · ${ratingCount(tally.total, t)} · ${t("rating.movingShare", { pct: movingShare(tally) })}`;
  const missing = STATUS_RULES.minRatings - tally.total;
  const line =
    candidate.match === "known"
      ? { mark: "known" as const, text: t(MARK_LABEL_KEYS.known) + facts }
      : status === "noteworthy" || status === "recommended"
        ? { mark: status, text: t(MARK_LABEL_KEYS[status]) + facts }
        : status === "excluded"
          ? { mark: null, text: t("rating.leftOut") + facts }
          : {
              mark: "needs-ratings" as const,
              text: `${t(MARK_LABEL_KEYS["needs-ratings"])} · ${t("rating.nOfMin", { n: tally.total, min: STATUS_RULES.minRatings })}`,
            };
  const note =
    missing > 0
      ? t(missing === 1 ? "rating.moreOne" : "rating.moreOther", { n: missing })
      : candidate.match === "known"
        ? t("rating.knownNote", { moving: tally.moving, total: tally.total })
        : status === "excluded"
          ? t("rating.excludedNote")
          : null;
  return (
    <div className="grid gap-0.5">
      <div className="flex items-center gap-2 text-sm">
        {line.mark && <StatusMark kind={line.mark} className="size-2.5" />}
        <span className={cn("font-medium", line.mark === "noteworthy" && "text-signal")}>{line.text}</span>
        {arrived > 0 && <span className="ml-auto text-xs">{t("rating.arrivedSince", { n: arrived })}</span>}
      </div>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

function Tally({ tally }: { tally: NonNullable<RatingState["tally"]> }) {
  const t = useT();
  const share = (n: number) => `${Math.round((n / tally.total) * 100)}%`;
  return (
    <div data-tour="rating-tally" className="grid gap-1 text-sm">
      <p>
        {ratingCount(tally.total, t)}
        {tally.total < MIN_RATINGS && <span className="text-muted-foreground"> · {t("rating.tooFew")}</span>}
      </p>
      <p className="text-xs text-muted-foreground">
        <RatingIcon choice="moving" /> {t(RATING_KEYS.moving)} {share(tally.moving)} · <RatingIcon choice="not-moving" />{" "}
        {t(RATING_KEYS["not-moving"])} {share(tally.notMoving)} · <RatingIcon choice="noise-or-artifact" />{" "}
        {t(RATING_KEYS["noise-or-artifact"])} {share(tally.noiseOrArtifact)}
      </p>
      <p className="text-xs text-muted-foreground">{t("rating.agreementNote")}</p>
    </div>
  );
}

/** "3 ratings" / "1 rating" (the same keys as the Most rated places rows). */
const ratingCount = (n: number, t: Translate) => t(n === 1 ? "rating.countOne" : "rating.countOther", { n });

/**
 * One-line summary of a rating state: "You rated [icon] Moving · 3 ratings · 67% Moving", or nothing if not rated.
 * Shared by the panel header badge and the queue rows.
 */
export function RatedSummary({ state }: { state: RatingState | undefined }) {
  const t = useT();
  if (!state?.mine) return null;
  const parts = [t(RATING_KEYS[state.mine])];
  if (state.tally) {
    parts.push(ratingCount(state.tally.total, t));
    parts.push(state.tally.total < MIN_RATINGS ? t("rating.tooFew") : t("rating.movingShare", { pct: movingShare(state.tally) }));
  }
  return (
    <>
      {t("rating.youRated")} <RatingIcon choice={state.mine} /> {parts.join(" · ")}
    </>
  );
}

/** Panel header badge: this browser's rating and the tally, or "Not rated yet". Loads without the blink images. */
export function RatingBadge({ point }: { point: EquatorialCoordinates }) {
  const t = useT();
  const state = useRating(point);
  if (!state.data) return null;
  return (
    <Badge data-tour="rating-badge" variant={state.data.mine ? "secondary" : "outline"} className="font-normal">
      {state.data.mine ? <RatedSummary state={state.data} /> : t("rating.notRatedYet")}
    </Badge>
  );
}
