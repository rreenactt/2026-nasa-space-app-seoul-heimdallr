"use client";

import { ChevronDownIcon, CircleHelpIcon } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { cn } from "cn";
import { type Translate, useLocale, useT } from "@/app/_i18n/i18n-provider";
import type { MessageKey } from "@/app/_i18n/message-keys";
import { MOST_RATED_LIMIT, RATING_KEYS, type MostRatedPlace, type RatingState } from "@/app/_lib/ratings/types";
import { RatedSummary } from "./rating-section";
import { clearPlaces, type PlaceVisit, samePlace, usePlaceHistory } from "./place-history";
import { useCandidateBatch, useCandidates } from "./candidates-context";
import {
  type CandidateFilter,
  type CandidateMatch,
  type CandidateStatus,
  type MovementCandidate,
  type ReviewEntry,
} from "./review-queue";
import { angularDistance, type EquatorialCoordinates, formatDec, formatRa } from "./sky-coordinates";
import { STATUS_RULES } from "@/app/_lib/ratings/status";
import { MARK_LABEL_KEYS, type MarkKind, StatusMark } from "./status-mark";
import { findTestTarget } from "./test-targets";
import { useMostRated, useRatingSummary } from "./use-ratings";
import { useView } from "./view-store";

type Tab = "view" | "sky" | "recent" | "rated";
type Sort = "priority" | "snr" | "visits";

const TABS: { id: Tab; label: MessageKey }[] = [
  { id: "view", label: "review.tabInView" },
  { id: "sky", label: "review.tabWholeSky" },
  { id: "recent", label: "review.tabRecent" },
  { id: "rated", label: "review.tabMostRated" },
];

const SORTS: { id: Sort; label: MessageKey }[] = [
  { id: "priority", label: "review.sortPriority" },
  { id: "snr", label: "review.snr" },
  { id: "visits", label: "review.visits" },
];

export function markOf(candidate: MovementCandidate): MarkKind {
  if (candidate.match === "known") return "known";
  return candidate.status === "noteworthy" || candidate.status === "recommended" ? candidate.status : "needs-ratings";
}

/** What a row calls a candidate: the Gaia DR3 verdict, then the tallied status once there is one. */
export const MATCH_LABELS: Record<CandidateMatch, MessageKey> = {
  known: "status.knownMover",
  unidentified: "status.unidentified",
};

function candidateText(candidate: MovementCandidate, t: Translate) {
  const tallied =
    candidate.status && candidate.status !== "needs-ratings" ? t(MARK_LABEL_KEYS[markOf(candidate)]) : undefined;
  return [
    t(MATCH_LABELS[candidate.match]),
    candidate.match === "unidentified" && tallied,
    candidate.synthetic && t("review.synthetic"),
  ]
    .filter(Boolean)
    .join(", ");
}

/** SNR runs from about 20 to over 50,000, so large values are shown in thousands to fit the column. */
const snrText = (snr: number) => (snr >= 1000 ? `${Math.round(snr / 1000)}k` : snr >= 100 ? snr.toFixed(0) : snr.toFixed(1));

/** This browser's own rating, the only one shown before rating (decision #6). */
const ratedText = (rating: RatingState | undefined, t: Translate) =>
  rating?.mine ? t("review.rated", { rating: t(RATING_KEYS[rating.mine]) }) : undefined;


const count = (n: number) => n.toLocaleString("en-US");

type ReviewQueuePanelProps = {
  /** The review order with the current filter applied (review-queue.ts). */
  queue: ReviewEntry[];
  /** The entry whose analysis is open. */
  currentId: string | undefined;
  /** The entry picked with a click, N or P; Enter and "Open blink" open it (decision #49). */
  pickedId: string | undefined;
  filter: CandidateFilter;
  onFilterChange: (filter: CandidateFilter) => void;
  /** A row click: picks the row, or opens it when it is already picked. */
  onSelect: (entry: ReviewEntry) => void;
  onOpenPlace: (place: EquatorialCoordinates) => void;
  /** "Open blink": the picked place. Disabled with nothing picked. */
  onOpenPicked: () => void;
  /** "Previous" and "Next" through the review order. */
  onStep: (direction: 1 | -1) => void;
  /** The list that Previous, Next, N and P walk while a tab other than the review order is shown; null for the queue. */
  onStepListChange: (list: ReviewEntry[] | null) => void;
  onClose: () => void;
};

/**
 * The review queue (decision #39), laid out as Figma "I · Review, queue open" and "· recent places": candidates in
 * view, on the whole sky, or the places this browser opened. Status is the shape mark; the row carries the ID, status,
 * position, visits and SNR. Places opened before are faded.
 */
export function ReviewQueuePanel({
  queue,
  currentId,
  pickedId,
  filter,
  onFilterChange,
  onSelect,
  onOpenPlace,
  onOpenPicked,
  onStep,
  onStepListChange,
  onClose,
}: ReviewQueuePanelProps) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("view");
  const [sort, setSort] = useState<Sort>("priority");
  const view = useView();
  const ratings = useRatingSummary(queue.map((entry) => entry.point));
  const ratingOf = (entry: ReviewEntry) => ratings.data?.[queue.indexOf(entry)];
  const history = usePlaceHistory();
  const batch = useCandidateBatch();
  const all = useCandidates();

  const entries = useMemo(() => {
    const inView = (point: EquatorialCoordinates) => !view || angularDistance(view, point) <= view.fov / 2;
    const scoped = tab === "view" ? queue.filter((entry) => inView(entry.point)) : queue;
    if (sort === "priority") return scoped;
    const value = (entry: ReviewEntry) =>
      entry.kind === "candidate" ? (sort === "snr" ? entry.candidate.snr : entry.candidate.detections) : -1;
    return [...scoped].sort((a, b) => value(b) - value(a));
  }, [queue, tab, sort, view]);

  const candidates = entries.filter((entry) => entry.kind === "candidate");
  const tests = entries.filter((entry) => entry.kind === "test");
  const total = all.filter((candidate) => candidate.status !== "excluded").length;
  const summary =
    tab === "rated"
      ? t("review.ratedSubtitle", { n: MOST_RATED_LIMIT })
      : tab === "recent"
      ? t(history.length === 1 ? "review.placesOpenedOne" : "review.placesOpenedOther", { n: count(history.length) })
      : batch.state === "unavailable"
        ? t("review.loadFailed")
        : batch.state === "empty" || total === 0
          ? t("review.batchEmpty")
          : t("review.batchSummary", { total: count(total), searched: count(batch.pointsSearched) });

  return (
    <section
      aria-label={t("review.title")}
      className="flex h-full w-[372px] flex-col rounded-[2px] bg-ink/86 text-bone backdrop-blur-sm"
    >
      <header className="px-5 pt-[18px]">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-light tracking-[-0.01em] text-paper">{t("review.heading")}</h2>
          <button type="button" className="text-[13px] text-ash hover:text-paper" onClick={onClose}>
            {t("review.hide")}
          </button>
        </div>
        <p className="mt-0.5 text-xs text-ash">{summary}</p>
      </header>

      <div className="mt-3 flex items-center px-5">
        <div role="tablist" aria-label={t("review.tabsLabel")} className="flex shrink-0 gap-3">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                "border-b pb-0.5 text-[13px] whitespace-nowrap transition-colors",
                tab === item.id ? "border-paper font-medium text-paper" : "border-transparent text-ash hover:text-paper",
              )}
            >
              {t(item.label)}
            </button>
          ))}
        </div>
        {/* Four tabs leave no room for a visible "Sort" word (Figma "I · Review, queue open · real candidates"). */}
        {(tab === "view" || tab === "sky") && (
          <label className="ml-auto flex items-center gap-2 text-[13px]">
            <span className="sr-only">{t("review.sort")}</span>
            <span className="relative flex items-center">
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as Sort)}
                className="appearance-none bg-transparent pr-4 text-ash hover:text-paper [&>option]:bg-ink"
              >
                {SORTS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {t(item.label)}
                  </option>
                ))}
              </select>
              <ChevronDownIcon aria-hidden className="pointer-events-none absolute right-0 size-3.5 text-ash" />
            </span>
          </label>
        )}
      </div>

      {tab === "rated" ? (
        <MostRatedPlaces
          currentId={pickedId ?? currentId}
          onSelect={onSelect}
          onStepListChange={onStepListChange}
          actions={<QueueActions canOpen={!!pickedId} canStep onOpen={onOpenPicked} onStep={onStep} />}
        />
      ) : tab === "recent" ? (
        <RecentPlaces history={history} onOpen={onOpenPlace} />
      ) : (
        <>
          <MatchCounts candidates={all} filter={filter} onChange={onFilterChange} />
          <div className="grid grid-cols-[10px_minmax(0,1fr)_40px_40px] gap-x-2.5 border-t border-rule px-5 pt-2.5 pb-1 text-[11px] text-smoke">
            <span />
            <span>{t("review.columnCandidate")}</span>
            <span className="text-right">{t("review.visits")}</span>
            <span className="text-right">{t("review.snr")}</span>
          </div>
          <ol className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
            {batch.state === "unavailable" ? (
              <li className="px-5 py-3 text-xs leading-5 text-ash">
                {t("review.listUnavailable")}
              </li>
            ) : total === 0 ? (
              <li className="px-5 py-3 text-xs leading-5 text-ash">
                {t("review.listEmpty")}
              </li>
            ) : candidates.length === 0 ? (
              <li className="px-5 py-3 text-xs text-ash">
                {tab === "view" ? t("review.noneInView") : t("review.noneMatch")}
              </li>
            ) : null}
            {candidates.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                current={entry.id === (pickedId ?? currentId)}
                rating={ratingOf(entry)}
                seen={history.some((visit) => samePlace(visit, entry.point))}
                onSelect={onSelect}
              />
            ))}
            {tests.length > 0 && <li className="px-5 pt-3 pb-1 text-[11px] text-smoke">{t("common.testTargets")}</li>}
            {tests.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                current={entry.id === (pickedId ?? currentId)}
                rating={ratingOf(entry)}
                seen={history.some((visit) => samePlace(visit, entry.point))}
                onSelect={onSelect}
              />
            ))}
          </ol>
          <p className="px-5 py-2 text-[11px] text-smoke">{t("review.notDetections")}</p>
          <QueueActions canOpen={!!pickedId} canStep={queue.length > 0} onOpen={onOpenPicked} onStep={onStep} />
        </>
      )}
    </section>
  );
}

/** "Open blink", "Previous" and "Next" under a list of places to review. */
function QueueActions({
  canOpen,
  canStep,
  onOpen,
  onStep,
}: {
  canOpen: boolean;
  canStep: boolean;
  onOpen: () => void;
  onStep: (direction: 1 | -1) => void;
}) {
  const t = useT();
  return (
    <div className="flex items-center gap-2 border-t border-rule px-5 py-2.5">
      <button
        type="button"
        onClick={onOpen}
        disabled={!canOpen}
        className="h-8 w-[150px] rounded-[2px] bg-paper text-sm font-medium text-ink transition-colors hover:bg-bone disabled:opacity-40"
      >
        {t("review.openBlink")}
      </button>
      <button
        type="button"
        onClick={() => onStep(-1)}
        disabled={!canStep}
        className="ml-auto px-3 text-sm text-ash hover:text-paper disabled:opacity-40"
      >
        {t("review.previous")}
      </button>
      <button
        type="button"
        onClick={() => onStep(1)}
        disabled={!canStep}
        className="pl-3 text-sm font-medium text-paper hover:text-bone disabled:opacity-40"
      >
        {t("review.next")}
      </button>
    </div>
  );
}

/** A rated cell as a stop in the queue: the listed candidate it holds, or the cell itself. */
function ratedEntry(place: MostRatedPlace, candidates: MovementCandidate[], t: Translate): ReviewEntry {
  const listed = place.candidate && candidates.find((candidate) => samePlace(candidate, place.candidate!));
  if (listed) return { kind: "candidate", id: listed.id, name: listed.id, point: listed, candidate: listed };
  if (place.candidate) {
    // A candidate the page's list does not have (added since it loaded): still opened at its SPHEREx position.
    const { id, ra, dec } = place.candidate;
    return { kind: "place", id, name: id, point: { ra, dec } };
  }
  return { kind: "place", id: `cell ${place.ra} ${place.dec}`, name: t("review.skyCell"), point: { ra: place.ra, dec: place.dec } };
}

/**
 * The "Most rated" tab (decision #58, Figma "I · Review, Most rated tab"): the sky cells with the most ratings. Only the
 * count is public; how people rated shows only where this browser rated too (decision #6). A cell holding a candidate
 * is named after it and opens at the candidate's SPHEREx position. Rows pick and open like the review order (#49).
 */
function MostRatedPlaces({
  currentId,
  onSelect,
  onStepListChange,
  actions,
}: {
  currentId: string | undefined;
  onSelect: (entry: ReviewEntry) => void;
  onStepListChange: (list: ReviewEntry[] | null) => void;
  actions: ReactNode;
}) {
  const t = useT();
  const places = useMostRated(true);
  const candidates = useCandidates();
  const rows = useMemo(
    () => (places.data ?? []).map((place) => ({ place, entry: ratedEntry(place, candidates, t) })),
    [places.data, candidates, t],
  );
  useEffect(() => {
    onStepListChange(rows.map((row) => row.entry));
    return () => onStepListChange(null);
  }, [rows, onStepListChange]);

  return (
    <>
      <div className="px-5 pt-3.5 pb-3 text-xs leading-[18px]">
        <p className="text-ash">{t("review.ratedCountNote")}</p>
        <p className="text-smoke">{t("review.ratedHiddenNote")}</p>
      </div>
      <div className="grid grid-cols-[12px_minmax(0,1fr)_48px] gap-x-2.5 border-t border-rule px-5 pt-2.5 pb-1 text-[11px] text-smoke">
        <span />
        <span>{t("review.ratedColumnPlace")}</span>
        <span className="text-right">{t("review.ratedColumnRatings")}</span>
      </div>
      <ol className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
        {places.isPending &&
          Array.from({ length: 4 }, (_, i) => (
            <li key={i} aria-hidden className="grid h-12 grid-cols-[12px_minmax(0,1fr)_48px] items-center gap-x-2.5 px-5">
              <span className="h-2.5 rounded-[2px] bg-paper/8" />
              <span className="h-2.5 w-44 rounded-[2px] bg-paper/8" />
              <span className="h-2.5 rounded-[2px] bg-paper/8" />
            </li>
          ))}
        {places.isError && (
          <li className="px-5 py-3 text-[13px] leading-5 text-red-400">
            {t("review.ratedLoadFailed")}
          </li>
        )}
        {places.data?.length === 0 && (
          <li className="px-5 py-3 text-[13px] leading-5 text-ash">
            {t("review.ratedEmpty")}
          </li>
        )}
        {rows.map(({ place, entry }, index) => (
          <RatedRow
            key={entry.id}
            rank={index + 1}
            place={place}
            entry={entry}
            current={entry.id === currentId}
            onSelect={onSelect}
          />
        ))}
      </ol>
      {rows.length > 0 && (
        <p className="px-5 py-2 text-[11px] text-smoke">{t("review.ratedFooter", { n: MOST_RATED_LIMIT })}</p>
      )}
      {actions}
    </>
  );
}

function RatedRow({
  rank,
  place,
  entry,
  current,
  onSelect,
}: {
  rank: number;
  place: MostRatedPlace;
  entry: ReviewEntry;
  current: boolean;
  onSelect: (entry: ReviewEntry) => void;
}) {
  const candidate = entry.kind === "candidate" ? entry.candidate : null;
  const match = candidate?.match ?? place.candidate?.match;
  const t = useT();
  return (
    <li className="relative after:absolute after:right-5 after:bottom-0 after:left-[50px] after:h-px after:bg-rule last:after:hidden">
      <button
        type="button"
        aria-current={current || undefined}
        onClick={() => onSelect(entry)}
        className={cn(
          "relative grid w-full grid-cols-[12px_minmax(0,1fr)_48px] items-start gap-x-2.5 px-5 py-2 text-left transition-colors hover:bg-paper/5",
          current && "bg-paper/7 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-paper",
        )}
      >
        <span className="pt-0.5 font-data text-xs text-smoke">{rank}</span>
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            {match && (
              <StatusMark kind={candidate ? markOf(candidate) : match === "known" ? "known" : "needs-ratings"} className="size-2.5 shrink-0" />
            )}
            <span className={cn("shrink-0 text-sm font-medium", match ? "text-paper" : "text-ash")}>{entry.name}</span>
            {match && <span className="truncate text-xs text-ash">{t(MATCH_LABELS[match])}</span>}
          </span>
          <span className="block font-data text-[10.5px] text-bone/80">
            {formatRa(entry.point.ra)}&nbsp;&nbsp;{formatDec(entry.point.dec)}
          </span>
          {/* "You rated [icon] Moving · 3 ratings · …", only where this browser rated (decision #6). */}
          {place.state?.mine && (
            <span className="mt-0.5 block truncate text-[11px] text-paper">
              <RatedSummary state={place.state} />
            </span>
          )}
        </span>
        <span className="text-right text-sm font-medium text-paper">{count(place.total)}</span>
      </button>
    </li>
  );
}

const STATUS_FILTERS: { kind: MarkKind; status: CandidateStatus }[] = [
  { kind: "noteworthy", status: "noteworthy" },
  { kind: "needs-ratings", status: "needs-ratings" },
  { kind: "recommended", status: "recommended" },
];

/** What each kind of candidate asks of the person reviewing it (Figma "I · Review, queue open · real candidates"). */
const MATCH_LINES: { match: CandidateMatch; kind: MarkKind; note: MessageKey }[] = [
  { match: "unidentified", kind: "needs-ratings", note: "review.yourCall" },
  { match: "known", kind: "known", note: "review.answerKey" },
];

/**
 * Counts per kind over every listed candidate; each one filters the list (press again to clear). Status counts join
 * them once ratings are tallied; before that every candidate needs ratings, which the kind lines already say.
 */
function MatchCounts({
  candidates,
  filter,
  onChange,
}: {
  candidates: MovementCandidate[];
  filter: CandidateFilter;
  onChange: (filter: CandidateFilter) => void;
}) {
  const t = useT();
  const listed = candidates.filter((candidate) => candidate.status !== "excluded");
  const tallied = listed.some((candidate) => candidate.status !== undefined);
  return (
    <div className="px-5 pt-3.5 pb-3">
      <div className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-x-1.5 gap-y-1">
        {MATCH_LINES.map(({ match, kind, note }) => {
          const active = filter.match === match;
          return (
            <button
              key={match}
              type="button"
              aria-pressed={active}
              onClick={() => onChange({ ...filter, match: active ? "all" : match })}
              className={cn(
                "col-span-3 grid grid-cols-subgrid items-center text-left text-[11.5px] transition-colors",
                active ? "text-paper" : "text-ash hover:text-paper",
              )}
            >
              <span className={cn("flex items-center gap-1.5", active && "underline underline-offset-4")}>
                <StatusMark kind={kind} className="size-2.5" />
                {t(MATCH_LABELS[match])}
              </span>
              <span className="pr-1.5 font-medium text-paper">
                {count(listed.filter((candidate) => candidate.match === match).length)}
              </span>
              <span className="truncate text-smoke">{t(note)}</span>
            </button>
          );
        })}
      </div>
      {tallied && (
        <div className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1">
          {STATUS_FILTERS.map(({ kind, status }) => {
            const n = listed.filter((candidate) => candidate.status === status).length;
            const active = filter.status === status;
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ ...filter, status: active ? "all" : status })}
                className={cn(
                  "flex items-center gap-1.5 text-[11.5px] transition-colors",
                  active ? "text-paper underline underline-offset-4" : "text-ash hover:text-paper",
                )}
              >
                <StatusMark kind={kind} className="size-2.5" />
                {t(MARK_LABEL_KEYS[kind])}
                <span className="font-medium text-paper">{count(n)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EntryRow({
  entry,
  current,
  rating,
  seen,
  onSelect,
}: {
  entry: ReviewEntry;
  current: boolean;
  rating: RatingState | undefined;
  seen: boolean;
  onSelect: (entry: ReviewEntry) => void;
}) {
  const t = useT();
  const candidate = entry.kind === "candidate" ? entry.candidate : null;
  const status = [
    candidate ? candidateText(candidate, t) : t("status.testTarget"),
    seen && t("review.seen"),
    ratedText(rating, t),
  ]
    .filter(Boolean)
    .join(", ");
  const faded = seen && !current;
  return (
    <li className="relative after:absolute after:right-5 after:bottom-0 after:left-[50px] after:h-px after:bg-rule last:after:hidden">
      <button
        type="button"
        aria-current={current || undefined}
        onClick={() => onSelect(entry)}
        className={cn(
          "relative grid h-12 w-full grid-cols-[10px_minmax(0,1fr)_40px_40px] items-center gap-x-2.5 px-5 text-left transition-colors hover:bg-paper/5",
          current && "bg-paper/7 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-paper",
        )}
      >
        <StatusMark kind={candidate ? markOf(candidate) : "test"} className={cn("size-2.5", faded && "opacity-55")} />
        <span className="min-w-0">
          <span className="flex items-baseline gap-2">
            <span className={cn("shrink-0 text-sm font-medium", faded ? "text-ash" : "text-paper")}>
              {candidate ? candidate.id : entry.name}
            </span>
            <span className="truncate text-xs text-ash">{status}</span>
          </span>
          <span className={cn("block font-data text-[10.5px]", faded ? "text-bone/55" : "text-bone/80")}>
            {formatRa(entry.point.ra)}&nbsp;&nbsp;{formatDec(entry.point.dec)}
          </span>
        </span>
        <span className="text-right text-[13px] text-ash">{candidate ? candidate.detections : "—"}</span>
        <span className={cn("text-right text-sm font-medium", faded ? "text-ash" : "text-paper")}>
          {candidate ? snrText(candidate.snr) : "—"}
        </span>
      </button>
    </li>
  );
}

/** What a recent place was: a candidate, a test target or a clicked point, with this browser's rating if any. */
function describeVisit(
  visit: PlaceVisit,
  rating: RatingState | undefined,
  candidates: MovementCandidate[],
  t: Translate,
) {
  const candidate = candidates.find((item) => samePlace(item, visit));
  const target = findTestTarget(visit);
  const rated = ratedText(rating, t);
  if (candidate) {
    return {
      mark: markOf(candidate),
      name: candidate.id,
      note: `${candidateText(candidate, t)}, ${rated ?? t("review.notRatedYet")}`,
    };
  }
  if (target) return { mark: "test" as const, name: target.name, note: [t("status.testTarget"), rated].filter(Boolean).join(", ") };
  return {
    mark: "opened" as const,
    name: visit.name ?? t("review.clickedPoint"),
    note: [t("review.noCandidateHere"), rated].filter(Boolean).join(", "),
  };
}

function clock(at: number, korean: boolean) {
  const date = new Date(at);
  const today = new Date().toDateString() === date.toDateString();
  return today
    ? date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString(korean ? "ko-KR" : "en-US", { month: "short", day: "numeric" });
}

function RecentPlaces({ history, onOpen }: { history: PlaceVisit[]; onOpen: (place: EquatorialCoordinates) => void }) {
  const t = useT();
  const { locale } = useLocale();
  const [picked, setPicked] = useState(0);
  const ratings = useRatingSummary(history.slice(0, 50));
  const candidates = useCandidates();
  const selected = history[Math.min(picked, history.length - 1)];
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!selected) return;
    void navigator.clipboard
      .writeText(`${formatRa(selected.ra)} ${formatDec(selected.dec)}`)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => undefined);
  };
  return (
    <>
      <ol className="mt-3.5 min-h-0 flex-1 overflow-y-auto border-t border-rule">
        {history.length === 0 && (
          <li className="px-5 py-3 text-xs text-ash">{t("review.recentEmpty")}</li>
        )}
        {history.map((visit, index) => {
          const { mark, name, note } = describeVisit(visit, ratings.data?.[index], candidates, t);
          const current = visit === selected;
          return (
            <li
              key={`${visit.ra},${visit.dec}`}
              className="relative after:absolute after:right-5 after:bottom-0 after:left-[50px] after:h-px after:bg-rule"
            >
              <button
                type="button"
                aria-current={current || undefined}
                onClick={() => setPicked(index)}
                onDoubleClick={() => onOpen(visit)}
                className={cn(
                  "relative grid h-[62px] w-full grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-x-2.5 px-5 text-left transition-colors hover:bg-paper/5",
                  current && "bg-paper/7 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-paper",
                )}
              >
                <StatusMark kind={mark} className="size-2.5" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-paper">{name}</span>
                  <span className="block truncate text-xs text-ash">{note}</span>
                  <span className="block font-data text-[10.5px] text-bone/80">
                    {formatRa(visit.ra)}&nbsp;&nbsp;{formatDec(visit.dec)}
                  </span>
                </span>
                <span className="self-start pt-3 text-xs text-ash">{clock(visit.at, locale === "ko")}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="flex items-center justify-between px-5 py-2.5">
        <span className="text-[11px] text-smoke">{t("review.keptHere")}</span>
        <button
          type="button"
          disabled={history.length === 0}
          onClick={clearPlaces}
          className="text-xs text-ash hover:text-paper disabled:text-smoke"
        >
          {t("review.clear")}
        </button>
      </div>
      <div className="flex items-center gap-2 border-t border-rule px-5 py-2.5">
        <button
          type="button"
          disabled={!selected}
          onClick={() => selected && onOpen(selected)}
          className="h-8 w-[150px] rounded-[2px] bg-paper text-sm font-medium text-ink transition-colors hover:bg-bone disabled:opacity-40"
        >
          {t("review.goToPlace")}
        </button>
        <button
          type="button"
          disabled={!selected}
          onClick={copy}
          className="ml-auto text-sm text-ash hover:text-paper disabled:opacity-40"
        >
          {copied ? t("common.copied") : t("common.copyCoordinates")}
        </button>
      </div>
    </>
  );
}

/** The three ratings with a schematic of each (Figma "I · Review, rating guide open"). Drawings, not data. */
const RATING_GUIDE: { label: MessageKey; body: MessageKey; drawing: ReactNode }[] = [
  {
    label: "review.moving",
    body: "review.guideMoving",
    drawing: (
      <>
        <circle cx="26.5" cy="58.5" r="2.5" className="fill-paper/30" />
        <circle cx="44.5" cy="46.5" r="2.5" className="fill-paper/60" />
        <circle cx="62.5" cy="34.5" r="2.5" className="fill-paper" />
      </>
    ),
  },
  {
    label: "review.notMoving",
    body: "review.guideNotMoving",
    drawing: <circle cx="44" cy="44" r="4" className="fill-paper" />,
  },
  {
    label: "review.noiseOrArtifact",
    body: "review.guideNoise",
    drawing: <line x1="16" y1="72" x2="72" y2="16" className="stroke-paper/70" strokeWidth="1.5" />,
  },
];

/**
 * "How to rate" (decision #38): a button at the top right of the frame while reviewing; the guide opens in its place,
 * 316px wide, above the tool column.
 */
const percent = (share: number) => `${Math.round(share * 100)}%`;

/** How ratings become a status (decision #57); the numbers come from STATUS_RULES so the guide follows the rules. */
const RATING_NOTES: { key: MessageKey; values?: Record<string, string | number> }[] = [
  { key: "review.guideOnePerBrowser" },
  { key: "review.guidePooled" },
  { key: "review.guideHidden" },
  { key: "review.guideStatus", values: { n: STATUS_RULES.minRatings } },
];

/** What each mark on the sky and in the lists means (Figma "I · Review, rating guide open · ratings and marks"). */
const MARK_NOTES: { kind: MarkKind; key: MessageKey; values?: Record<string, string | number> }[] = [
  { kind: "needs-ratings", key: "review.guideMarkNeeds", values: { n: STATUS_RULES.minRatings } },
  { kind: "recommended", key: "review.guideMarkRecommended", values: { n: STATUS_RULES.minRatings } },
  {
    kind: "noteworthy",
    key: "review.guideMarkNoteworthy",
    values: { n: STATUS_RULES.noteworthyRatings, pct: percent(STATUS_RULES.noteworthyMoving) },
  },
  // Known movers keep their own mark whatever their status (decision #39).
  { kind: "known", key: "review.guideMarkKnown" },
  { kind: "test", key: "review.guideMarkTest" },
];

export function RatingGuide({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT();
  if (!open) {
    return (
      <button
        type="button"
        aria-expanded={false}
        onClick={() => onOpenChange(true)}
        className="flex h-7 items-center gap-1.5 rounded-[2px] bg-ink/70 px-2.5 text-[13px] font-medium text-mist transition-colors hover:text-paper"
      >
        <CircleHelpIcon className="size-4 stroke-[1.5]" aria-hidden />
        {t("review.howToRate")}
      </button>
    );
  }
  return (
    <section
      aria-label={t("review.howToRate")}
      onKeyDown={(event) => event.key === "Escape" && onOpenChange(false)}
      className="max-h-[calc(100dvh-8rem)] w-[316px] overflow-y-auto rounded-[2px] bg-ink/86 px-[18px] pt-4 pb-3.5 text-bone backdrop-blur-sm"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-paper">{t("review.guideTitle")}</h2>
        <button type="button" autoFocus className="text-xs text-ash hover:text-paper" onClick={() => onOpenChange(false)}>
          {t("common.close")}
        </button>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {RATING_GUIDE.map((rating) => (
          <div key={rating.label}>
            <svg viewBox="0 0 88 88" aria-hidden className="size-[88px] rounded-[2px] border border-rule bg-[#0a0a0a]">
              {rating.drawing}
            </svg>
            <dt className="mt-2 text-[12.5px] font-medium whitespace-nowrap text-paper">{t(rating.label)}</dt>
            <dd className="text-[11px] leading-[15px] text-ash">{t(rating.body)}</dd>
          </div>
        ))}
      </dl>
      <h3 className="mt-3 border-t border-rule pt-3 text-[10.5px] font-medium tracking-wide text-smoke uppercase">
        {t("review.guideRatingsHeading")}
      </h3>
      <ul className="mt-1.5 grid gap-0.5 text-[11px] leading-4 text-ash">
        {RATING_NOTES.map(({ key, values }) => (
          <li key={key} className="flex gap-1.5">
            <span aria-hidden>·</span>
            {t(key, values)}
          </li>
        ))}
      </ul>
      <h3 className="mt-3 border-t border-rule pt-3 text-[10.5px] font-medium tracking-wide text-smoke uppercase">
        {t("review.guideMarksHeading")}
      </h3>
      <dl className="mt-2 grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1.5">
        {MARK_NOTES.map(({ kind, key, values }) => (
          <div key={kind} className="col-span-3 grid grid-cols-subgrid items-center">
            <StatusMark kind={kind} className="size-2.5" />
            <dt className={cn("pr-2 text-xs font-medium", kind === "noteworthy" ? "text-signal" : "text-paper")}>
              {t(MARK_LABEL_KEYS[kind])}
            </dt>
            <dd className="text-[11px] text-ash">{t(key, values)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2.5 text-[10.5px] leading-[14px] text-smoke">
        {t("review.guideLeavesQueue", { pct: percent(STATUS_RULES.recommendMoving) })}
      </p>
    </section>
  );
}
