import type { SkyLayers } from "./sky-view";

/** Statuses that can be shown or hidden one by one in "Show on sky". */
export type StatusKey = "noteworthy" | "needs-ratings" | "recommended" | "known";

/**
 * Everything "Show on sky" switches (decision #40). `candidates` is the master switch the C key toggles;
 * status marks and the per-status boxes refine what it shows. The selected candidate stays visible regardless.
 */
export type SkyOverlays = SkyLayers & {
  candidates: boolean;
  marks: boolean;
  statuses: Record<StatusKey, boolean>;
  opened: boolean;
};

export const DEFAULT_OVERLAYS: SkyOverlays = {
  candidates: true,
  marks: true,
  // Known movers start on: they are the answer key to compare unidentified pairs with (decision #49). The coordinate
  // grid starts off (Figma "I · Explore, layers panel open").
  statuses: { noteworthy: true, "needs-ratings": true, recommended: true, known: true },
  opened: true,
  pins: true,
  constellations: true,
  grid: false,
};

/** The part Aladin Lite draws today. */
export function skyLayers({ pins, constellations, grid }: SkyOverlays): SkyLayers {
  return { pins, constellations, grid };
}
