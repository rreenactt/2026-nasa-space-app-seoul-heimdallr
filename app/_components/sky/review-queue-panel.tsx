"use client";

import { XIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "cn";
import { clearPlaces, type PlaceVisit, samePlace, usePlaceHistory } from "./place-history";
import {
  type CandidateFilter,
  type CandidateStatus,
  MOVEMENT_CANDIDATES,
  type MovementCandidate,
  type ReviewEntry,
} from "./review-queue";
import { angularDistance, type EquatorialCoordinates, formatDec, formatRa } from "./sky-coordinates";
import { MARK_LABELS, type MarkKind, StatusMark } from "./status-mark";
import { useView } from "./view-store";
import type { RatingState } from "@/app/_lib/ratings/types";
import { ratingSummary } from "./rating-section";
import { useRatingSummary } from "./use-ratings";

type Tab = "view" | "sky" | "recent";
type Sort = "priority" | "snr" | "visits";

const TABS: { id: Tab; label: string }[] = [
  { id: "view", label: "In view" },
  { id: "sky", label: "Whole sky" },
  { id: "recent", label: "Recent" },
];

const SORTS: { id: Sort; label: string }[] = [
  { id: "priority", label: "Review order" },
  { id: "snr", label: "SNR" },
  { id: "visits", label: "Visits" },
];

/** The three ratings and what each means (Figma design I, rating guide). */
export const RATING_GUIDE = [
  { label: "Moving", body: "It shifts between visits on the fixed sky grid, in a steady direction." },
  { label: "Not moving", body: "It stays in place. Its brightness may still change between visits." },
  { label: "Noise or artifact", body: "A hot pixel, cosmic ray, image edge or ghost, not a real source." },
];

export function markOf(candidate: MovementCandidate): MarkKind {
  if (candidate.knownAsteroid) return "known";
  return candidate.status === "noteworthy" || candidate.status === "recommended" ? candidate.status : "needs-ratings";
}

type ReviewQueuePanelProps = {
  /** The review order with the current filter applied (review-queue.ts). */
  queue: ReviewEntry[];
  currentId: string | undefined;
  filter: CandidateFilter;
  onFilterChange: (filter: CandidateFilter) => void;
  onSelect: (entry: ReviewEntry) => void;
  onOpenPlace: (place: EquatorialCoordinates) => void;
  onClose: () => void;
};

/**
 * The review queue (decision #39): candidates in view, on the whole sky, or the places this browser opened. No colored
 * tags: status is the shape mark, and the row carries the ID, position, visits and SNR. Opened places are faded.
 */
export function ReviewQueuePanel({
  queue,
  currentId,
  filter,
  onFilterChange,
  onSelect,
  onOpenPlace,
  onClose,
}: ReviewQueuePanelProps) {
  const [tab, setTab] = useState<Tab>("view");
  const [sort, setSort] = useState<Sort>("priority");
  const view = useView();
  // This browser's ratings of the listed places; others' tallies stay hidden until rated (decision #6).
  const ratings = useRatingSummary(queue.map((entry) => entry.point));
  const ratingOf = (entry: ReviewEntry) => ratings.data?.[queue.indexOf(entry)];
  const history = usePlaceHistory();

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

  return (
    <section
      aria-label="Review queue"
      className="flex h-full w-[372px] flex-col rounded-[2px] bg-ink/86 text-bone backdrop-blur-sm"
    >
      <header className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <h2 className="text-sm font-medium text-paper">
          Review queue <span className="ml-1 font-data text-xs text-ash">{MOVEMENT_CANDIDATES.length}</span>
        </h2>
        <button type="button" aria-label="Fold the review queue" className="text-ash hover:text-paper" onClick={onClose}>
          <XIcon className="size-4 stroke-[1.5]" />
        </button>
      </header>

      <div role="tablist" aria-label="Which places" className="flex gap-5 border-b border-rule px-4">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "-mb-px border-b py-2 text-[13px] transition-colors",
              tab === item.id ? "border-paper text-paper" : "border-transparent text-ash hover:text-paper",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "recent" ? (
        <RecentPlaces history={history} queue={queue} onOpen={onOpenPlace} />
      ) : (
        <>
          <StatusCounts filter={filter} onChange={onFilterChange} />
          <div className="flex items-center justify-between px-4 pb-2 text-xs text-ash">
            <span>
              {candidates.length} {candidates.length === 1 ? "candidate" : "candidates"}
              {tab === "view" ? " in view" : ""}
            </span>
            <label className="flex items-center gap-1.5">
              Sort
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as Sort)}
                className="rounded-sm border border-rule bg-transparent px-1 py-0.5 text-bone [&>option]:bg-ink"
              >
                {SORTS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ol className="min-h-0 flex-1 overflow-y-auto border-t border-rule">
            {MOVEMENT_CANDIDATES.length === 0 ? (
              <li className="px-4 py-3 text-xs leading-5 text-ash">
                No movement candidates yet. They appear here once the detection pipeline has run on a region.
              </li>
            ) : candidates.length === 0 ? (
              <li className="px-4 py-3 text-xs text-ash">
                {tab === "view" ? "No candidates in view. Try Whole sky or zoom out." : "No candidates match these filters."}
              </li>
            ) : null}
            {candidates.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                current={entry.id === currentId}
                rating={ratingOf(entry)}
                seen={history.some((visit) => samePlace(visit, entry.point))}
                onSelect={onSelect}
              />
            ))}
            {tests.length > 0 && (
              <li className="px-4 pt-3 pb-1 font-data text-[11px] tracking-[0.06em] text-smoke uppercase">
                Test targets
              </li>
            )}
            {tests.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                current={entry.id === currentId}
                rating={ratingOf(entry)}
                seen={history.some((visit) => samePlace(visit, entry.point))}
                onSelect={onSelect}
              />
            ))}
          </ol>
        </>
      )}

      <footer className="border-t border-rule px-4 py-2.5 text-xs text-smoke">Candidates, not detections</footer>
    </section>
  );
}

const STATUS_FILTERS: { kind: MarkKind; status?: CandidateStatus; known?: boolean }[] = [
  { kind: "noteworthy", status: "noteworthy" },
  { kind: "needs-ratings", status: "needs-ratings" },
  { kind: "recommended", status: "recommended" },
  { kind: "known", known: true },
];

/** Counts per status over every candidate; each one filters the list (press again to clear). */
function StatusCounts({ filter, onChange }: { filter: CandidateFilter; onChange: (filter: CandidateFilter) => void }) {
  const listed = MOVEMENT_CANDIDATES.filter((candidate) => candidate.status !== "excluded");
  return (
    <div className="flex flex-wrap gap-x-3.5 gap-y-1 px-4 py-2.5">
      {STATUS_FILTERS.map(({ kind, status, known }) => {
        const count = listed.filter((candidate) => (known ? candidate.knownAsteroid : candidate.status === status)).length;
        const active = known ? filter.match === "known" : filter.status === status;
        return (
          <button
            key={kind}
            type="button"
            aria-pressed={active}
            onClick={() =>
              onChange(
                known
                  ? { ...filter, match: active ? "all" : "known" }
                  : { ...filter, status: active || !status ? "all" : status },
              )
            }
            className={cn(
              "flex items-center gap-1.5 rounded-sm text-xs transition-colors",
              active ? "text-paper underline underline-offset-4" : "text-ash hover:text-paper",
            )}
          >
            <StatusMark kind={kind} className="size-2.5" />
            {MARK_LABELS[kind]}
            <span className="font-data text-bone">{count}</span>
          </button>
        );
      })}
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
  const candidate = entry.kind === "candidate" ? entry.candidate : null;
  return (
    <li>
      <button
        type="button"
        aria-current={current || undefined}
        onClick={() => onSelect(entry)}
        className={cn(
          "grid w-full grid-cols-[12px_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2 text-left transition-colors hover:bg-paper/8",
          current && "bg-paper/12",
          seen && !current && "opacity-50",
        )}
      >
        <StatusMark kind={candidate ? markOf(candidate) : "test"} />
        <span className="min-w-0">
          <span className="block truncate font-data text-[12.5px] text-paper">
            {candidate ? candidate.id : entry.name}
          </span>
          <span className="block font-data text-[11px] text-ash">
            {formatRa(entry.point.ra)}&nbsp;&nbsp;{formatDec(entry.point.dec)}
          </span>
          {ratingSummary(rating) && (
            <span className="block truncate text-[11px] text-signal">{ratingSummary(rating)}</span>
          )}
        </span>
        <span className="text-right font-data text-[11px] leading-4 text-ash">
          {candidate ? (
            <>
              {candidate.detections} visits
              <br />
              SNR {candidate.snr.toFixed(1)}
            </>
          ) : (
            "test"
          )}
          {seen && <span className="sr-only">, opened before</span>}
        </span>
      </button>
    </li>
  );
}

function RecentPlaces({
  history,
  queue,
  onOpen,
}: {
  history: PlaceVisit[];
  queue: ReviewEntry[];
  onOpen: (place: EquatorialCoordinates) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between px-4 py-2.5 text-xs text-ash">
        <span>Kept in this browser only</span>
        <button
          type="button"
          disabled={history.length === 0}
          onClick={clearPlaces}
          className="text-bone hover:text-paper disabled:text-smoke"
        >
          Clear
        </button>
      </div>
      <ol className="min-h-0 flex-1 overflow-y-auto border-t border-rule">
        {history.length === 0 && (
          <li className="px-4 py-3 text-xs text-ash">Places you open appear here, newest first.</li>
        )}
        {history.map((visit) => {
          const name = visit.name ?? queue.find((entry) => samePlace(entry.point, visit))?.name;
          return (
            <li key={`${visit.ra},${visit.dec}`}>
              <button
                type="button"
                onClick={() => onOpen(visit)}
                className="grid w-full grid-cols-[12px_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2 text-left hover:bg-paper/8"
              >
                <StatusMark kind="opened" />
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] text-paper">{name ?? "Point on the sky"}</span>
                  <span className="block font-data text-[11px] text-ash">
                    {formatRa(visit.ra)}&nbsp;&nbsp;{formatDec(visit.dec)}
                  </span>
                </span>
                <span className="font-data text-[11px] text-ash">{timeAgo(visit.at)}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function timeAgo(at: number) {
  const minutes = Math.round((Date.now() - at) / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours}h` : `${Math.round(hours / 24)}d`;
}

/** "How to rate": the rating guide, only on demand (decision #38), at the top right of the frame while reviewing. */
export function RatingGuide() {
  return (
    <Popover>
      <PopoverTrigger className="flex h-7 items-center rounded-[2px] bg-ink/70 px-3 text-xs text-bone transition-colors hover:text-paper aria-expanded:text-paper">
        How to rate
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" sideOffset={8} className="w-72 rounded-sm border-0 bg-ink/95 p-4 text-bone ring-0">
        <p className="text-sm font-medium text-paper">How to rate</p>
        <dl className="mt-3 grid gap-3 text-xs leading-5">
          {RATING_GUIDE.map((rating) => (
            <div key={rating.label}>
              <dt className="text-paper">{rating.label}</dt>
              <dd className="text-ash">{rating.body}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-smoke">Other ratings stay hidden until you rate.</p>
      </PopoverContent>
    </Popover>
  );
}
