"use client";

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { samePlace } from "./place-history";
import type { CandidateBatch, CandidateStatus, MovementCandidate } from "./review-queue";
import type { EquatorialCoordinates } from "./sky-coordinates";

type CandidatesValue = {
  batch: CandidateBatch;
  candidates: MovementCandidate[];
  /** A candidate the search just read from the database: shown even if this page loaded before it was added. */
  remember: (candidate: MovementCandidate) => void;
  /** The database has no such candidate any more: hide the ones this page loaded that match. */
  forget: (matches: (candidate: MovementCandidate) => boolean) => void;
  /**
   * The status a fresh tally gives a candidate (a rating just made here, or one read again from the server), laid over
   * the list so the badge, the queue and the sky mark change at once (decision #57).
   */
  setStatus: (id: string, status: CandidateStatus | undefined) => void;
};

const NO_CANDIDATES: MovementCandidate[] = [];

const CandidatesContext = createContext<CandidatesValue>({
  batch: { state: "empty" },
  candidates: NO_CANDIDATES,
  remember: () => undefined,
  forget: () => undefined,
  setStatus: () => undefined,
});

/**
 * The survey batch the page read on the server, for every part of the sky screen. The batch is at most a minute old
 * when the page loads; what the search learns from the database afterwards (a candidate added or removed) is laid over
 * it, so the open page agrees with the database without a reload.
 */
export function CandidatesProvider({ batch, children }: { batch: CandidateBatch; children: ReactNode }) {
  const [added, setAdded] = useState<MovementCandidate[]>([]);
  const [removed, setRemoved] = useState<MovementCandidate[]>([]);
  const [statuses, setStatuses] = useState<ReadonlyMap<string, CandidateStatus | undefined>>(new Map());
  const setStatus = useCallback((id: string, status: CandidateStatus | undefined) => {
    setStatuses((map) => (map.has(id) && map.get(id) === status ? map : new Map(map).set(id, status)));
  }, []);

  const remember = useCallback((candidate: MovementCandidate) => {
    setRemoved((list) => list.filter((item) => !samePlace(item, candidate)));
    setAdded((list) => [...list.filter((item) => !samePlace(item, candidate)), candidate]);
  }, []);
  const forget = useCallback(
    (matches: (candidate: MovementCandidate) => boolean) => {
      const loaded = batch.state === "ready" ? batch.candidates : NO_CANDIDATES;
      setAdded((list) => list.filter((item) => !matches(item)));
      setRemoved((list) => [...list, ...loaded.filter(matches)]);
    },
    [batch],
  );

  const candidates = useMemo(() => {
    const loaded = batch.state === "ready" ? batch.candidates : NO_CANDIDATES;
    const listed =
      added.length === 0 && removed.length === 0
        ? loaded
        : [
            ...loaded.filter((candidate) => !removed.includes(candidate) && !added.some((item) => samePlace(item, candidate))),
            ...added,
          ];
    if (statuses.size === 0) return listed;
    return listed.map((candidate) =>
      statuses.has(candidate.id) && statuses.get(candidate.id) !== candidate.status
        ? { ...candidate, status: statuses.get(candidate.id) }
        : candidate,
    );
  }, [batch, added, removed, statuses]);

  const value = useMemo(
    () => ({ batch, candidates, remember, forget, setStatus }),
    [batch, candidates, remember, forget, setStatus],
  );
  return <CandidatesContext.Provider value={value}>{children}</CandidatesContext.Provider>;
}

export function useCandidateBatch() {
  return useContext(CandidatesContext).batch;
}

/** The listed candidates (known movers and unidentified pairs); empty while there is no batch. */
export function useCandidates() {
  return useContext(CandidatesContext).candidates;
}

/** Lets the search bring the page in line with what the database said. */
export function useCandidateUpdates() {
  const { remember, forget, setStatus } = useContext(CandidatesContext);
  return { remember, forget, setStatus };
}

/** The candidate at a position, within one arcsecond. */
export function useCandidateAt(point: EquatorialCoordinates | null) {
  const candidates = useCandidates();
  return point ? candidates.find((candidate) => samePlace(candidate, point)) : undefined;
}
