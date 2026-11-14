"use client";

import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { cn } from "cn";
import {
  type CandidateFilter,
  type CandidateStatus,
  MOVEMENT_CANDIDATES,
  type ReviewEntry,
} from "./review-queue";

const STATUS_LABELS: Record<Exclude<CandidateStatus, "excluded">, string> = {
  noteworthy: "Noteworthy",
  "needs-ratings": "Needs ratings",
  recommended: "Recommended",
};

type TargetListProps = {
  queue: ReviewEntry[];
  /** The entry the analysis panel shows, if any. */
  currentId: string | undefined;
  filter: CandidateFilter;
  onFilterChange: (filter: CandidateFilter) => void;
  onSelect: (entry: ReviewEntry) => void;
};

/**
 * Places to analyze without searching the sky: the test targets, then the movement candidates in review order
 * (review-queue.ts). Basic layout only; its placement and look belong to the UI redesign.
 */
export function TargetList({ queue, currentId, filter, onFilterChange, onSelect }: TargetListProps) {
  const [open, setOpen] = useState(true);
  const tests = queue.filter((entry) => entry.kind === "test");
  const candidates = queue.filter((entry) => entry.kind === "candidate");

  return (
    <section className="dark w-96 rounded-md border border-white/10 bg-black/70 text-sm text-foreground backdrop-blur-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 text-left font-medium"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Places to analyze
        <ChevronDownIcon className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div className="grid max-h-[50dvh] gap-3 overflow-y-auto border-t border-white/10 px-3 py-3">
          <EntryGroup title={`Test targets (${tests.length})`}>
            {tests.map((entry) => (
              <EntryButton key={entry.id} entry={entry} current={entry.id === currentId} onSelect={onSelect} />
            ))}
          </EntryGroup>

          <EntryGroup title={`Movement candidates (${candidates.length})`}>
            {MOVEMENT_CANDIDATES.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                None yet. Candidates appear here once the detection pipeline has run on a region.
              </p>
            ) : (
              <>
                <CandidateFilters filter={filter} onChange={onFilterChange} />
                {candidates.length === 0 && (
                  <p className="text-xs text-muted-foreground">No candidates match these filters.</p>
                )}
                {candidates.map((entry) => (
                  <EntryButton key={entry.id} entry={entry} current={entry.id === currentId} onSelect={onSelect} />
                ))}
              </>
            )}
          </EntryGroup>
        </div>
      )}
    </section>
  );
}

function EntryGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </div>
  );
}

function EntryButton({
  entry,
  current,
  onSelect,
}: {
  entry: ReviewEntry;
  current: boolean;
  onSelect: (entry: ReviewEntry) => void;
}) {
  return (
    <button
      type="button"
      aria-current={current || undefined}
      className={cn(
        "grid gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-white/10",
        current && "bg-white/15",
      )}
      onClick={() => onSelect(entry)}
    >
      <span className="flex items-center gap-2">
        <span className="truncate">{entry.name}</span>
        {entry.kind === "candidate" && entry.candidate.status && entry.candidate.status !== "excluded" && (
          <Badge variant="secondary">{STATUS_LABELS[entry.candidate.status]}</Badge>
        )}
      </span>
      <span className="text-xs text-muted-foreground">
        {entry.kind === "test"
          ? entry.target.note
          : `${entry.candidate.knownAsteroid ? `Known asteroid ${entry.candidate.knownAsteroid}` : "Unidentified"} · ${entry.candidate.detections} epochs · SNR ${entry.candidate.snr.toFixed(1)}`}
      </span>
    </button>
  );
}

function CandidateFilters({ filter, onChange }: { filter: CandidateFilter; onChange: (filter: CandidateFilter) => void }) {
  return (
    <div className="flex gap-2 pb-1">
      <NativeSelect
        size="sm"
        aria-label="Filter candidates by status"
        value={filter.status}
        onChange={(event) => onChange({ ...filter, status: event.target.value as CandidateFilter["status"] })}
      >
        <NativeSelectOption value="all">Any status</NativeSelectOption>
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <NativeSelectOption key={value} value={value}>
            {label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect
        size="sm"
        aria-label="Filter candidates by known asteroid match"
        value={filter.match}
        onChange={(event) => onChange({ ...filter, match: event.target.value as CandidateFilter["match"] })}
      >
        <NativeSelectOption value="all">Known and unidentified</NativeSelectOption>
        <NativeSelectOption value="known">Known asteroids</NativeSelectOption>
        <NativeSelectOption value="unidentified">Unidentified</NativeSelectOption>
      </NativeSelect>
    </div>
  );
}
