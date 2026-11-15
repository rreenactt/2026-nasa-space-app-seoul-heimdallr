"use client";

import { ChevronDownIcon, CircleHelpIcon } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { cn } from "cn";
import { RATING_LABELS, type RatingState } from "@/app/_lib/ratings/types";
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
import { findTestTarget } from "./test-targets";
import { useRatingSummary } from "./use-ratings";
import { useView } from "./view-store";

type Tab = "view" | "sky" | "recent";
type Sort = "priority" | "snr" | "visits";

const TABS: { id: Tab; label: string }[] = [
  { id: "view", label: "In view" },
  { id: "sky", label: "Whole sky" },
  { id: "recent", label: "Recent" },
];

const SORTS: { id: Sort; label: string }[] = [
  { id: "priority", label: "Priority" },
  { id: "snr", label: "SNR" },
  { id: "visits", label: "Visits" },
];

export function markOf(candidate: MovementCandidate): MarkKind {
  if (candidate.knownAsteroid) return "known";
  return candidate.status === "noteworthy" || candidate.status === "recommended" ? candidate.status : "needs-ratings";
}

/** This browser's own rating, the only one shown before rating (decision #6). */
const ratedText = (rating: RatingState | undefined) =>
  rating?.mine ? `rated ${RATING_LABELS[rating.mine]}` : undefined;

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
  onClose,
}: ReviewQueuePanelProps) {
  const [tab, setTab] = useState<Tab>("view");
  const [sort, setSort] = useState<Sort>("priority");
  const view = useView();
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
  const total = MOVEMENT_CANDIDATES.filter((candidate) => candidate.status !== "excluded").length;
  const summary =
    tab === "recent"
      ? `${count(history.length)} ${history.length === 1 ? "place" : "places"} opened in this browser`
      : total === 0
        ? "No candidates in the batch yet"
        : tab === "view"
          ? `${count(candidates.length)} in this view of ${count(total)} in the batch`
          : `${count(candidates.length)} of ${count(total)} in the batch`;

  return (
    <section
      aria-label="Review queue"
      className="flex h-full w-[372px] flex-col rounded-[2px] bg-ink/86 text-bone backdrop-blur-sm"
    >
      <header className="px-5 pt-[18px]">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-light tracking-[-0.01em] text-paper">Review queue</h2>
          <button type="button" className="text-[13px] text-ash hover:text-paper" onClick={onClose}>
            Hide
          </button>
        </div>
        <p className="mt-0.5 text-xs text-ash">{summary}</p>
      </header>

      <div className="mt-3 flex items-center px-5">
        <div role="tablist" aria-label="Which places" className="flex gap-3.5">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                "border-b pb-0.5 text-[13px] transition-colors",
                tab === item.id ? "border-paper font-medium text-paper" : "border-transparent text-ash hover:text-paper",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        {tab !== "recent" && (
          <label className="ml-auto flex items-center gap-2 text-[13px]">
            <span className="text-smoke">Sort</span>
            <span className="relative flex items-center">
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as Sort)}
                className="appearance-none bg-transparent pr-4 text-ash hover:text-paper [&>option]:bg-ink"
              >
                {SORTS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              <ChevronDownIcon aria-hidden className="pointer-events-none absolute right-0 size-3.5 text-ash" />
            </span>
          </label>
        )}
      </div>

      {tab === "recent" ? (
        <RecentPlaces history={history} onOpen={onOpenPlace} />
      ) : (
        <>
          <StatusCounts filter={filter} onChange={onFilterChange} />
          <div className="grid grid-cols-[10px_minmax(0,1fr)_40px_40px] gap-x-2.5 border-t border-rule px-5 pt-2.5 pb-1 text-[11px] text-smoke">
            <span />
            <span>Candidate, RA Dec</span>
            <span className="text-right">Visits</span>
            <span className="text-right">SNR</span>
          </div>
          <ol className="min-h-0 flex-1 overflow-y-auto">
            {total === 0 ? (
              <li className="px-5 py-3 text-xs leading-5 text-ash">
                No movement candidates yet. They appear here once the detection pipeline has run on a region.
              </li>
            ) : candidates.length === 0 ? (
              <li className="px-5 py-3 text-xs text-ash">
                {tab === "view" ? "No candidates in view. Try Whole sky or zoom out." : "No candidates match these filters."}
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
            {tests.length > 0 && <li className="px-5 pt-3 pb-1 text-[11px] text-smoke">Test targets</li>}
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
          <p className="px-5 py-2 text-[11px] text-smoke">Candidates, not detections.</p>
          <div className="flex items-center gap-2 border-t border-rule px-5 py-2.5">
            <button
              type="button"
              onClick={onOpenPicked}
              disabled={!pickedId}
              className="h-8 w-[150px] rounded-[2px] bg-paper text-sm font-medium text-ink transition-colors hover:bg-bone disabled:opacity-40"
            >
              Open blink
            </button>
            <button
              type="button"
              onClick={() => onStep(-1)}
              disabled={queue.length === 0}
              className="ml-auto px-3 text-sm text-ash hover:text-paper disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => onStep(1)}
              disabled={queue.length === 0}
              className="pl-3 text-sm font-medium text-paper hover:text-bone disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}

const STATUS_FILTERS: { kind: MarkKind; status: CandidateStatus }[] = [
  { kind: "noteworthy", status: "noteworthy" },
  { kind: "needs-ratings", status: "needs-ratings" },
  { kind: "recommended", status: "recommended" },
];

/** Counts per status over every candidate; each one filters the list (press again to clear). */
function StatusCounts({ filter, onChange }: { filter: CandidateFilter; onChange: (filter: CandidateFilter) => void }) {
  const listed = MOVEMENT_CANDIDATES.filter((candidate) => candidate.status !== "excluded");
  return (
    <div className="flex flex-wrap gap-x-3.5 gap-y-1 px-5 pt-3.5 pb-3">
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
            {MARK_LABELS[kind]}
            <span className="font-medium text-paper">{count(n)}</span>
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
  const status = [candidate ? MARK_LABELS[markOf(candidate)] : "Test target", seen && "seen", ratedText(rating)]
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
            <span className={cn("truncate text-sm font-medium", faded ? "text-ash" : "text-paper")}>
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
          {candidate ? candidate.snr.toFixed(1) : "—"}
        </span>
      </button>
    </li>
  );
}

/** What a recent place was: a candidate, a test target or a clicked point, with this browser's rating if any. */
function describeVisit(visit: PlaceVisit, rating: RatingState | undefined) {
  const candidate = MOVEMENT_CANDIDATES.find((item) => samePlace(item, visit));
  const target = findTestTarget(visit);
  const rated = ratedText(rating);
  if (candidate) {
    return {
      mark: markOf(candidate),
      name: candidate.id,
      note: `Candidate, ${rated ?? "not rated yet"}`,
    };
  }
  if (target) return { mark: "test" as const, name: target.name, note: ["Test target", rated].filter(Boolean).join(", ") };
  return {
    mark: "opened" as const,
    name: visit.name ?? "Clicked point",
    note: ["No candidate here", rated].filter(Boolean).join(", "),
  };
}

function clock(at: number) {
  const date = new Date(at);
  const today = new Date().toDateString() === date.toDateString();
  return today
    ? date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function RecentPlaces({ history, onOpen }: { history: PlaceVisit[]; onOpen: (place: EquatorialCoordinates) => void }) {
  const [picked, setPicked] = useState(0);
  const ratings = useRatingSummary(history.slice(0, 50));
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
          <li className="px-5 py-3 text-xs text-ash">Places you open appear here, newest first.</li>
        )}
        {history.map((visit, index) => {
          const { mark, name, note } = describeVisit(visit, ratings.data?.[index]);
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
                <span className="self-start pt-3 text-xs text-ash">{clock(visit.at)}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="flex items-center justify-between px-5 py-2.5">
        <span className="text-[11px] text-smoke">Kept in this browser only.</span>
        <button
          type="button"
          disabled={history.length === 0}
          onClick={clearPlaces}
          className="text-xs text-ash hover:text-paper disabled:text-smoke"
        >
          Clear
        </button>
      </div>
      <div className="flex items-center gap-2 border-t border-rule px-5 py-2.5">
        <button
          type="button"
          disabled={!selected}
          onClick={() => selected && onOpen(selected)}
          className="h-8 w-[150px] rounded-[2px] bg-paper text-sm font-medium text-ink transition-colors hover:bg-bone disabled:opacity-40"
        >
          Go to place
        </button>
        <button
          type="button"
          disabled={!selected}
          onClick={copy}
          className="ml-auto text-sm text-ash hover:text-paper disabled:opacity-40"
        >
          {copied ? "Copied" : "Copy coordinates"}
        </button>
      </div>
    </>
  );
}

/** The three ratings with a schematic of each (Figma "I · Review, rating guide open"). Drawings, not data. */
const RATING_GUIDE: { label: string; body: string; drawing: ReactNode }[] = [
  {
    label: "Moving",
    body: "A dot shifts between visits",
    drawing: (
      <>
        <circle cx="26.5" cy="58.5" r="2.5" className="fill-paper/30" />
        <circle cx="44.5" cy="46.5" r="2.5" className="fill-paper/60" />
        <circle cx="62.5" cy="34.5" r="2.5" className="fill-paper" />
      </>
    ),
  },
  {
    label: "Not moving",
    body: "Stays put; brightness may change",
    drawing: <circle cx="44" cy="44" r="4" className="fill-paper" />,
  },
  {
    label: "Noise or artifact",
    body: "One visit only, streak or ghost",
    drawing: <line x1="16" y1="72" x2="72" y2="16" className="stroke-paper/70" strokeWidth="1.5" />,
  },
];

/**
 * "How to rate" (decision #38): a button at the top right of the frame while reviewing; the guide opens in its place,
 * 316px wide, above the tool column.
 */
export function RatingGuide({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!open) {
    return (
      <button
        type="button"
        aria-expanded={false}
        onClick={() => onOpenChange(true)}
        className="flex h-7 items-center gap-1.5 rounded-[2px] bg-ink/70 px-2.5 text-[13px] font-medium text-mist transition-colors hover:text-paper"
      >
        <CircleHelpIcon className="size-4 stroke-[1.5]" aria-hidden />
        How to rate
      </button>
    );
  }
  return (
    <section
      aria-label="How to rate"
      onKeyDown={(event) => event.key === "Escape" && onOpenChange(false)}
      className="w-[316px] rounded-[2px] bg-ink/86 px-[18px] pt-4 pb-3.5 text-bone backdrop-blur-sm"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-paper">What does a moving object look like?</h2>
        <button type="button" autoFocus className="text-xs text-ash hover:text-paper" onClick={() => onOpenChange(false)}>
          Close
        </button>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {RATING_GUIDE.map((rating) => (
          <div key={rating.label}>
            <svg viewBox="0 0 88 88" aria-hidden className="size-[88px] rounded-[2px] border border-rule bg-[#0a0a0a]">
              {rating.drawing}
            </svg>
            <dt className="mt-2 text-[12.5px] font-medium whitespace-nowrap text-paper">{rating.label}</dt>
            <dd className="text-[11px] leading-[15px] text-ash">{rating.body}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
