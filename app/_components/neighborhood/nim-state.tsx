"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/ky";
import { buildModel, skyAt, type MotionModel } from "@/app/_lib/nim/motion";
import type { NeighborCatalog, NeighborObject } from "@/app/_lib/nim/types";

export type RangeMode = "near" | "extrapolation";
export const RANGES: Record<RangeMode, { min: number; max: number; step: number; label: string }> = {
  near: { min: 1800, max: 2250, step: 1, label: "1800–2250 (model near the observations)" },
  extrapolation: { min: -10000, max: 32000, step: 50, label: "10,000 BC – 32,000 AD (educational extrapolation)" },
};

interface NimState {
  catalog: ReturnType<typeof useCatalog>;
  objects: NeighborObject[];
  models: Map<string, MotionModel>;
  selected: NeighborObject | undefined;
  selectedId: string;
  setSelectedId: (id: string) => void;
  year: number;
  setYear: (y: number) => void;
  mode: RangeMode;
  setMode: (m: RangeMode) => void;
  /** Assumed radial velocity per object (only used when none is measured; never stored as a measurement). */
  assumedRv: Record<string, number>;
  setAssumedRv: (id: string, v: number) => void;
  showUncertainty: boolean;
  setShowUncertainty: (v: boolean) => void;
  /** Why the current object was (or was not) chosen when opened from the analysis panel. */
  focusNote: string | null;
}

export const catalogQuery = () => ({
  queryKey: ["nim", "catalog"] as const,
  queryFn: () => api.get("/api/nim/neighbors", { timeout: 65_000 }).json<NeighborCatalog>(),
  staleTime: Infinity,
  gcTime: 30 * 60_000,
});

function useCatalog() {
  return useQuery(catalogQuery());
}

const Ctx = createContext<NimState | null>(null);

export interface NimFocus {
  ra: number;
  dec: number;
  name?: string;
}

/** Nearest catalog object to a sky position, using each object's model position now (2025.8) and at its epoch. */
export function nearestObject(objects: NeighborObject[], models: Map<string, MotionModel>, f: NimFocus) {
  let best: { o: NeighborObject; sepDeg: number } | null = null;
  for (const o of objects) {
    const m = models.get(o.id);
    if (!m) continue;
    for (const p of [skyAt(m, 2025.8), { ra: o.ra, dec: o.dec }]) {
      const dRa = (((p.ra - f.ra + 540) % 360) - 180) * Math.cos((f.dec * Math.PI) / 180);
      const sep = Math.hypot(dRa, p.dec - f.dec);
      if (!best || sep < best.sepDeg) best = { o, sepDeg: sep };
    }
  }
  return best;
}

export function NimStateProvider({ focus, children }: { focus?: NimFocus; children: React.ReactNode }) {
  const catalog = useCatalog();
  const [selectedId, setSelectedId] = useState("gaia:4472832130942575872");
  const [year, setYear] = useState(2025.8);
  const [mode, setModeState] = useState<RangeMode>("near");
  const [assumedRv, setAssumedRvState] = useState<Record<string, number>>({});
  const [showUncertainty, setShowUncertainty] = useState(false);

  const objects = useMemo(() => catalog.data?.objects ?? [], [catalog.data]);
  const models = useMemo(() => new Map(objects.map((o) => [o.id, buildModel(o, assumedRv[o.id] ?? 0)])), [objects, assumedRv]);
  const [focusNote, setFocusNote] = useState<string | null>(null);
  const [focusApplied, setFocusApplied] = useState(false);

  // Opened from the analysis panel: select the object at that point, if there is one (within 0.1°).
  useEffect(() => {
    if (!focus || focusApplied || !objects.length) return;
    const near = nearestObject(objects, models, focus);
    /* eslint-disable react-hooks/set-state-in-effect -- one-time selection once the catalog arrives */
    setFocusApplied(true);
    if (near && near.sepDeg <= 0.1) {
      setSelectedId(near.o.id);
      setFocusNote(`Selected ${near.o.name}, ${(near.sepDeg * 3600).toFixed(0)}″ from the point you opened.`);
    } else {
      setFocusNote(
        `No object of this map (within about 3.6 pc) lies near the point you opened${focus.name ? ` (${focus.name})` : ""}${near ? `; the closest is ${near.o.name}, ${near.sepDeg.toFixed(1)}° away` : ""}.`,
      );
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [focus, focusApplied, objects, models]);

  const value: NimState = {
    catalog,
    objects,
    models,
    selected: objects.find((o) => o.id === selectedId),
    selectedId,
    setSelectedId,
    year,
    setYear,
    mode,
    setMode: (m) => {
      setModeState(m);
      setYear((y) => Math.min(RANGES[m].max, Math.max(RANGES[m].min, y)));
    },
    assumedRv,
    setAssumedRv: (id, v) => setAssumedRvState((s) => ({ ...s, [id]: v })),
    showUncertainty,
    setShowUncertainty,
    focusNote,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNim() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useNim must be used inside NimStateProvider");
  return v;
}

export function formatYear(y: number) {
  if (y > 1000 && y < 3000 && Math.abs(y - Math.round(y)) > 0.05) return `${y.toFixed(1)}`;
  const r = Math.round(y);
  return r <= 0 ? `${1 - r} BC` : `${r} AD`;
}
