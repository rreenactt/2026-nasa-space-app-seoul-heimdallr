"use client";

import { createContext, type ReactNode, useContext } from "react";
import { samePlace } from "./place-history";
import type { CandidateBatch, MovementCandidate } from "./review-queue";
import type { EquatorialCoordinates } from "./sky-coordinates";

const NO_CANDIDATES: MovementCandidate[] = [];

const CandidatesContext = createContext<CandidateBatch>({ state: "empty" });

/** The survey batch the page read on the server, for every part of the sky screen. */
export function CandidatesProvider({ batch, children }: { batch: CandidateBatch; children: ReactNode }) {
  return <CandidatesContext.Provider value={batch}>{children}</CandidatesContext.Provider>;
}

export function useCandidateBatch() {
  return useContext(CandidatesContext);
}

/** The listed candidates (known movers and unidentified pairs); empty while there is no batch. */
export function useCandidates() {
  const batch = useContext(CandidatesContext);
  return batch.state === "ready" ? batch.candidates : NO_CANDIDATES;
}

/** The candidate at a position, within one arcsecond. */
export function useCandidateAt(point: EquatorialCoordinates | null) {
  const candidates = useCandidates();
  return point ? candidates.find((candidate) => samePlace(candidate, point)) : undefined;
}
