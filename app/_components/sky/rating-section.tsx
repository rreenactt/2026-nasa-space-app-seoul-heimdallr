"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type Translate, useT } from "@/app/_i18n/i18n-provider";
import {
  MIN_RATINGS,
  movingShare,
  RATING_CHOICES,
  RATING_EMOJI,
  RATING_KEYS,
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
  const t = useT();
  const { selection, plan, usable } = useBlink();
  const state = useRating(selection);
  const rate = useRate(selection);

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
            onClick={() => mine !== choice && rate.mutate({ choice, visitCount })}
          >
            <span aria-hidden>{RATING_EMOJI[choice]}</span>
            {t(RATING_KEYS[choice])}
          </Button>
        ))}
      </div>
      {(state.isError || rate.isError) && (
        <p className="text-xs text-destructive">{(rate.error ?? state.error)?.message ?? t("rating.failed")}</p>
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

function Tally({ tally }: { tally: NonNullable<RatingState["tally"]> }) {
  const t = useT();
  const share = (n: number) => `${Math.round((n / tally.total) * 100)}%`;
  return (
    <div className="grid gap-1 text-sm">
      <p>
        {ratingCount(tally.total, t)}
        {tally.total < MIN_RATINGS && <span className="text-muted-foreground"> · {t("rating.tooFew")}</span>}
      </p>
      <p className="text-xs text-muted-foreground">
        <span aria-hidden>{RATING_EMOJI.moving}</span> {t(RATING_KEYS.moving)} {share(tally.moving)} ·{" "}
        <span aria-hidden>{RATING_EMOJI["not-moving"]}</span> {t(RATING_KEYS["not-moving"])} {share(tally.notMoving)} ·{" "}
        <span aria-hidden>{RATING_EMOJI["noise-or-artifact"]}</span> {t(RATING_KEYS["noise-or-artifact"])}{" "}
        {share(tally.noiseOrArtifact)}
      </p>
      <p className="text-xs text-muted-foreground">{t("rating.agreementNote")}</p>
    </div>
  );
}

/** "3 ratings" / "1 rating" (the same keys as the Most rated places rows). */
const ratingCount = (n: number, t: Translate) => t(n === 1 ? "rating.countOne" : "rating.countOther", { n });

/** One-line summary of a rating state: "You rated Moving · 3 ratings · 67% Moving", or null if not rated. */
export function ratingSummary(state: RatingState | undefined, t: Translate): string | null {
  if (!state?.mine) return null;
  const parts = [t("rating.youRated", { emoji: RATING_EMOJI[state.mine], rating: t(RATING_KEYS[state.mine]) })];
  if (state.tally) {
    parts.push(ratingCount(state.tally.total, t));
    parts.push(state.tally.total < MIN_RATINGS ? t("rating.tooFew") : t("rating.movingShare", { pct: movingShare(state.tally) }));
  }
  return parts.join(" · ");
}

/** Panel header badge: this browser's rating and the tally, or "Not rated yet". Loads without the blink images. */
export function RatingBadge({ point }: { point: EquatorialCoordinates }) {
  const t = useT();
  const state = useRating(point);
  if (!state.data) return null;
  const summary = ratingSummary(state.data, t);
  return (
    <Badge variant={summary ? "secondary" : "outline"} className="font-normal">
      {summary ?? t("rating.notRatedYet")}
    </Badge>
  );
}
