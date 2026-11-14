"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { EXAMPLES, MISSION_ORDER, MISSIONS } from "@/app/_lib/sky/missions";
import { mjdToDate } from "@/app/_lib/sky/wcs";
import type { Epoch, MissionId, SkyGrid } from "@/app/_lib/sky/types";
import { useMissionSearches } from "./use-sky-data";

export const GRID_N = 256;

export interface Target {
  name: string;
  ra: number;
  dec: number;
  fovArcmin: number;
  source: string;
}

/** A position the user clicked, and optionally a centroid measured around it. Keyed by epoch id. */
export interface Mark {
  epochId: string;
  mjd: number;
  user: { ra: number; dec: number };
  measured: { ra: number; dec: number } | null;
}

interface StmState {
  target: Target;
  setTarget: (t: Target) => void;
  grid: SkyGrid;
  enabled: Record<MissionId, boolean>;
  setEnabled: (m: MissionId, on: boolean) => void;
  bands: Record<MissionId, string>;
  setBand: (m: MissionId, band: string) => void;
  searches: ReturnType<typeof useMissionSearches>;
  /** Epochs of enabled missions in the chosen band, in time order. */
  epochs: Epoch[];
  currentId: string | null;
  setCurrentId: (id: string) => void;
  current: Epoch | undefined;
  marks: Mark[];
  setMark: (m: Mark) => void;
  removeMark: (epochId: string) => void;
  clearMarks: () => void;
  showGaia: boolean;
  setShowGaia: (v: boolean) => void;
}

const Ctx = createContext<StmState | null>(null);

export function exampleTarget(id = "barnard"): Target {
  const e = EXAMPLES.find((x) => x.id === id) ?? EXAMPLES[0];
  return { name: e.name, ra: e.ra, dec: e.dec, fovArcmin: e.fovArcmin, source: e.source };
}

export function StmStateProvider({ initialTarget, children }: { initialTarget?: Target; children: React.ReactNode }) {
  const [target, setTargetState] = useState<Target>(initialTarget ?? exampleTarget());
  const [enabled, setEnabledState] = useState<Record<MissionId, boolean>>({ "2mass": true, wise: true, neowise: true, spherex: true });
  const [bands, setBands] = useState<Record<MissionId, string>>(
    Object.fromEntries(MISSION_ORDER.map((m) => [m, MISSIONS[m].defaultBand])) as Record<MissionId, string>,
  );
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [showGaia, setShowGaia] = useState(false);

  const grid = useMemo<SkyGrid>(() => ({ ra: target.ra, dec: target.dec, fovArcmin: target.fovArcmin, n: GRID_N }), [target]);
  const searches = useMissionSearches(MISSION_ORDER, grid);

  const epochs = useMemo(() => {
    const out: Epoch[] = [];
    MISSION_ORDER.forEach((m, i) => {
      if (!enabled[m]) return;
      for (const e of searches[i].data?.epochs ?? []) if (e.band === bands[m]) out.push(e);
    });
    return out.sort((a, b) => a.timeStart - b.timeStart);
  }, [searches, enabled, bands]);

  const current = epochs.find((e) => e.id === currentId) ?? epochs[0];

  const value: StmState = {
    target,
    setTarget: (t) => {
      setTargetState(t);
      setCurrentId(null);
      setMarks([]);
    },
    grid,
    enabled,
    setEnabled: (m, on) => setEnabledState((s) => ({ ...s, [m]: on })),
    bands,
    setBand: (m, b) => setBands((s) => ({ ...s, [m]: b })),
    searches,
    epochs,
    currentId: current?.id ?? null,
    setCurrentId,
    current,
    marks,
    setMark: (mark) => setMarks((s) => [...s.filter((x) => x.epochId !== mark.epochId), mark].sort((a, b) => a.mjd - b.mjd)),
    removeMark: (id) => setMarks((s) => s.filter((x) => x.epochId !== id)),
    clearMarks: () => setMarks([]),
    showGaia,
    setShowGaia,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStm() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStm must be used inside StmStateProvider");
  return v;
}

export function formatDate(mjd: number) {
  return mjdToDate(mjd).toISOString().slice(0, 10);
}

export function formatPeriod(start: number, end: number) {
  const a = formatDate(start);
  const b = formatDate(end);
  return a === b ? a : `${a} ~ ${b}`;
}

/** "3년 2개월" style elapsed time between two MJDs. */
export function formatElapsed(days: number) {
  const d = Math.abs(days);
  if (d < 1) return `${(d * 24).toFixed(1)}시간`;
  if (d < 60) return `${Math.round(d)}일`;
  const years = Math.floor(d / 365.25);
  const months = Math.round((d - years * 365.25) / 30.44);
  return years > 0 ? `${years}년${months ? ` ${months}개월` : ""}` : `${months}개월`;
}

export const MISSION_COLOR: Record<MissionId, string> = {
  "2mass": "var(--series-1)",
  wise: "var(--series-2)",
  neowise: "var(--series-3)",
  spherex: "var(--series-4)",
};
