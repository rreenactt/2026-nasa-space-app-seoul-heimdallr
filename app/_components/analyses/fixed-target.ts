"use client";

import { createContext, useContext } from "react";

/**
 * True when an analysis is shown inside the analysis panel, where the point is already chosen on the sky. Analyses
 * then hide their own example list and coordinate fields, so they always show the panel's point.
 */
export const FixedTargetContext = createContext(false);

export function useFixedTarget() {
  return useContext(FixedTargetContext);
}
