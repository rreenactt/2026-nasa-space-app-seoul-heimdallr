"use client";

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { samePlace } from "./place-history";
import type { CandidateBatch, MovementCandidate } from "./review-queue";
import type { EquatorialCoordinates } from "./sky-coordinates";

type CandidatesValue = {
  batch: CandidateBatch;
  candidates: MovementCandidate[];
  /** A candidate the search just read from the database: shown even if this page loaded before it was added. */
  remember: (candidate: MovementCandidate) => void;
  /** The database has no such candidate any more: hide the ones this page loaded that match. */
  forget: (matches: (candidate: MovementCandidate) => boolean) => void;
};

const NO_CANDIDATES: MovementCandidate[] = [];

const CandidatesContext = createContext<CandidatesValue>({
  batch: { state: "empty" },
  candidates: NO_CANDIDATES,
  remember: () => undefined,
  forget: () => undefined,
});

/**
 * The survey batch the page read on the server, for every part of the sky screen. The batch is at most a minute old
 * when the page loads; what the search learns from the database afterwards (a candidate added or removed) is laid over
 * it, so the open page agrees with the database without a reload.
 */
export function CandidatesProvider({ batch, children }: { batch: CandidateBatch; children: ReactNode }) {
  const [added, setAdded] = useState<MovementCandidate[]>([]);
  const [removed, setRemoved] = useState<MovementCandidate[]>([]);

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
    if (added.length === 0 && removed.length === 0) return loaded;
    const kept = loaded.filter(
      (candidate) =>
        !removed.includes(candidate) && !added.some((item) => samePlace(item, candidate)),
    );
    return [...kept, ...added];
  }, [batch, added, removed]);

  const value = useMemo(() => ({ batch, candidates, remember, forget }), [batch, candidates, remember, forget]);
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
  const { remember, forget } = useContext(CandidatesContext);
  return { remember, forget };
}

/** The candidate at a position, within one arcsecond. */
export function useCandidateAt(point: EquatorialCoordinates | null) {
  const candidates = useCandidates();
  return point ? candidates.find((candidate) => samePlace(candidate, point)) : undefined;
}
