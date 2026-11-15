"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { ApertureParams, ObservationEntry, PeriodId } from "@/app/_lib/comet/types";
import type { MessageKey } from "@/app/_i18n/message-keys";
import { useObservationIndex } from "./use-comet-data";

/** Translated names for `PERIODS[p].label` (same English text). */
export const PERIOD_LABEL: Record<PeriodId, MessageKey> = { "2025-08": "comet.periodAug", "2025-12": "comet.periodDec" };

export type DetectorFilter = "all" | "D1" | "D2" | "D3" | "D4" | "D5" | "D6";

/** August paper: 12″ (~2 px) aperture, background annulus ≈ 1′–3′ (≈ 10–29 px at ~6.15″/px). */
export const DEFAULT_APERTURE: ApertureParams = { rAp: 2, rIn: 10, rOut: 29, maskSourcesInAnnulus: false };

interface CometState {
  entries: ObservationEntry[];
  listSource: string | null;
  period: PeriodId;
  setPeriod: (p: PeriodId) => void;
  detector: DetectorFilter;
  setDetector: (d: DetectorFilter) => void;
  /** Observations of the current period that pass the detector filter, in time order. */
  visible: ObservationEntry[];
  selected: ObservationEntry | undefined;
  selectKey: (key: string) => void;
  aperture: ApertureParams;
  setAperture: (a: ApertureParams) => void;
}

const Ctx = createContext<CometState | null>(null);

export function CometStateProvider({ children }: { children: React.ReactNode }) {
  const index = useObservationIndex();
  const [period, setPeriodState] = useState<PeriodId>("2025-08");
  const [detector, setDetector] = useState<DetectorFilter>("D3");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [aperture, setAperture] = useState<ApertureParams>(DEFAULT_APERTURE);

  const entries = useMemo(() => index.data?.entries ?? [], [index.data]);
  const visible = useMemo(
    () => entries.filter((e) => e.period === period && (detector === "all" || e.detector === detector)),
    [entries, period, detector],
  );
  const selected = entries.find((e) => e.key === selectedKey) ?? visible[0];

  const value = useMemo<CometState>(
    () => ({
      entries,
      listSource: index.data?.source ?? null,
      period,
      setPeriod: (p) => {
        setPeriodState(p);
        setSelectedKey(null);
      },
      detector,
      setDetector: (d) => {
        setDetector(d);
        if (selected && d !== "all" && selected.detector !== d) setSelectedKey(null);
      },
      visible,
      selected,
      selectKey: (key) => {
        const e = entries.find((x) => x.key === key);
        if (e?.period) setPeriodState(e.period);
        setSelectedKey(key);
      },
      aperture,
      setAperture,
    }),
    [entries, index.data, period, detector, visible, selected, aperture],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCometState() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCometState must be used inside CometStateProvider");
  return v;
}

export function formatUtc(iso: string) {
  return iso.replace("T", " ").slice(0, 16) + " UTC";
}
