"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/ky";
import { buildModel, type MotionModel } from "@/app/_lib/nim/motion";
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
}

function useCatalog() {
  return useQuery({
    queryKey: ["nim", "catalog"],
    queryFn: () => api.get("/api/nim/neighbors", { timeout: 65_000 }).json<NeighborCatalog>(),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  });
}

const Ctx = createContext<NimState | null>(null);

export function NimStateProvider({ children }: { children: React.ReactNode }) {
  const catalog = useCatalog();
  const [selectedId, setSelectedId] = useState("gaia:4472832130942575872");
  const [year, setYear] = useState(2025.8);
  const [mode, setModeState] = useState<RangeMode>("near");
  const [assumedRv, setAssumedRvState] = useState<Record<string, number>>({});
  const [showUncertainty, setShowUncertainty] = useState(false);

  const objects = useMemo(() => catalog.data?.objects ?? [], [catalog.data]);
  const models = useMemo(() => new Map(objects.map((o) => [o.id, buildModel(o, assumedRv[o.id] ?? 0)])), [objects, assumedRv]);

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
