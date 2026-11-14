"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { FLAG_CATEGORIES } from "@/app/_lib/fpl/flags";
import type { FplExposure, Judgment } from "@/app/_lib/fpl/types";
import { propagate } from "@/app/_lib/sky/wcs";
import { useSpherexSearch } from "./use-fpl-data";

export interface FplTarget {
  name: string;
  ra: number;
  dec: number;
  note: string;
}

/** Examples. Barnard's Star / ε Ind A are propagated from Gaia DR3 (2016.0) to 2025.8, the SPHEREx era. */
const at2025 = (ra: number, dec: number, pmra: number, pmdec: number) => propagate(ra, dec, pmra, pmdec, 2016, 2025.8);
const barnard = at2025(269.44850252544, 4.73942005111, -801.551, 10362.394);
const epsInd = at2025(330.8724078796, -56.79725466123, 3966.661, -2536.192);
export const FPL_EXAMPLES: FplTarget[] = [
  {
    name: "Bright star: Barnard's Star",
    ...barnard,
    note: "A bright, saturated star: expect saturation, bloom and transient flags on the core, and ghosts or persistence nearby.",
  },
  {
    name: "Ordinary field near Barnard's Star",
    ra: barnard.ra,
    dec: barnard.dec - 0.025,
    note: "1.5′ south of Barnard's Star. Click faint dots and compare their checks with the bright star's.",
  },
  {
    name: "Very bright star: ε Indi A",
    ...epsInd,
    note: "G ≈ 4.3. A strong source of ghosts and bloom; good for seeing what the flags look like around a very bright star.",
  },
];

export interface CandidateRecord {
  id: string;
  createdAt: string;
  candidate: { ra: number; dec: number };
  target: FplTarget;
  primaryKey: string;
  comparisonKeys: string[];
  verdict: string;
  checks: { label: string; status: string; summary: string }[];
  judgment: Judgment;
  note: string;
  evidence: unknown;
}

interface FplState {
  target: FplTarget;
  setTarget: (t: FplTarget) => void;
  search: ReturnType<typeof useSpherexSearch>;
  detector: string;
  setDetector: (d: string) => void;
  /** Exposures shown; the first one is the primary (measured) frame. */
  selected: FplExposure[];
  toggleExposure: (e: FplExposure) => void;
  setPrimary: (key: string) => void;
  candidate: { ra: number; dec: number } | null;
  setCandidate: (c: { ra: number; dec: number } | null) => void;
  layers: Record<string, boolean>;
  setLayer: (id: string, on: boolean) => void;
  opacity: number;
  setOpacity: (v: number) => void;
  records: CandidateRecord[];
  addRecord: (r: CandidateRecord) => void;
  removeRecord: (id: string) => void;
}

const Ctx = createContext<FplState | null>(null);

/** Groups exposures into visits (gap > 20 days). */
export function visitsOf(exposures: FplExposure[]) {
  const out: FplExposure[][] = [];
  for (const e of [...exposures].sort((a, b) => a.tStart - b.tStart)) {
    const last = out[out.length - 1];
    if (last && e.tStart - last[last.length - 1].tStart <= 20) last.push(e);
    else out.push([e]);
  }
  return out;
}

export function FplStateProvider({ initialTarget, children }: { initialTarget?: FplTarget; children: React.ReactNode }) {
  const [target, setTargetState] = useState<FplTarget>(initialTarget ?? FPL_EXAMPLES[0]);
  const search = useSpherexSearch(target.ra, target.dec);
  const [detector, setDetectorState] = useState<string>("");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [candidate, setCandidate] = useState<{ ra: number; dec: number } | null>(null);
  const [layers, setLayers] = useState<Record<string, boolean>>(
    Object.fromEntries(FLAG_CATEGORIES.map((c) => [c.id, c.role === "exclude" || c.role === "warning"])),
  );
  const [opacity, setOpacity] = useState(0.55);
  const [records, setRecords] = useState<CandidateRecord[]>([]);

  const exposures = useMemo(() => search.data?.exposures ?? [], [search.data]);

  // Defaults after a search: the detector with the most visits, and one exposure per visit (middle of the visit).
  useEffect(() => {
    if (!exposures.length || selectedKeys.length) return;
    const dets = [...new Set(exposures.map((e) => e.detector))].sort();
    const best = dets.reduce((a, d) => (visitsOf(exposures.filter((e) => e.detector === d)).length > visitsOf(exposures.filter((e) => e.detector === a)).length ? d : a), dets[0]);
    const picks = visitsOf(exposures.filter((e) => e.detector === best)).map((v) => v[Math.floor(v.length / 2)]);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time default selection when search results arrive
    setDetectorState(best);
    setSelectedKeys(picks.slice(0, 3).map((e) => e.key));
  }, [exposures, selectedKeys.length]);

  const selected = selectedKeys.map((k) => exposures.find((e) => e.key === k)).filter((e): e is FplExposure => Boolean(e));

  const value: FplState = {
    target,
    setTarget: (t) => {
      setTargetState(t);
      setSelectedKeys([]);
      setCandidate(null);
    },
    search,
    detector,
    setDetector: (d) => {
      setDetectorState(d);
      const picks = visitsOf(exposures.filter((e) => e.detector === d)).map((v) => v[Math.floor(v.length / 2)]);
      setSelectedKeys(picks.slice(0, 3).map((e) => e.key));
    },
    selected,
    toggleExposure: (e) =>
      setSelectedKeys((ks) => (ks.includes(e.key) ? ks.filter((k) => k !== e.key) : ks.length >= 4 ? ks : [...ks, e.key])),
    setPrimary: (key) => setSelectedKeys((ks) => [key, ...ks.filter((k) => k !== key)]),
    candidate,
    setCandidate,
    layers,
    setLayer: (id, on) => setLayers((l) => ({ ...l, [id]: on })),
    opacity,
    setOpacity,
    records,
    addRecord: (r) => setRecords((rs) => [r, ...rs]),
    removeRecord: (id) => setRecords((rs) => rs.filter((r) => r.id !== id)),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFpl() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useFpl must be used inside FplStateProvider");
  return v;
}

const MJD_EPOCH_MS = Date.UTC(1858, 10, 17);
export const mjdIso = (mjd: number) => new Date(MJD_EPOCH_MS + mjd * 86_400_000).toISOString().replace("T", " ").slice(0, 16) + " UTC";
